"use strict";

const {
  GoodsReceipt,
  GoodsReceiptItem,
  InventoryItem,
  Supplier,
  PurchaseOrder,
} = require("../models");
const { success, error } = require("../utils/response");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
const stockService = require("../services/stockService");
const { Op } = require("sequelize");

const RECEIPT_INCLUDES = [
  { model: Supplier, as: "supplier", attributes: ["id", "name"] },
  { model: PurchaseOrder, as: "purchaseOrder", attributes: ["id", "po_number"] },
  {
    model: GoodsReceiptItem,
    as: "items",
    include: [{ model: InventoryItem, as: "item", attributes: ["id", "name", "unit"] }],
  },
];

const isPositiveNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0;
};

/** DATEONLY columns expect "YYYY-MM-DD"; reject anything else up front instead of 500ing. */
const isDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value));

/**
 * Direct receipt: material that turned up with no purchase order behind it.
 * Receipts AGAINST a PO come in via POST /purchase-orders/:id/receive.
 *
 * There is deliberately no update or delete for goods receipts. A receipt has
 * batches and ledger movements behind it (stock_movements.reference_id is a
 * polymorphic reference with no FK), so removing one would leave the ledger
 * dangling. A wrong receipt is corrected with an ADJUSTMENT_OUT.
 */
const createGoodsReceipt = async (req, res) => {
  try {
    const { supplier_id, receipt_date, supplier_bill_ref, notes, items } = req.body;

    if (!supplier_id || !receipt_date) {
      return error(res, 400, "Supplier and receipt date are required");
    }

    if (!isDateString(receipt_date)) {
      return error(res, 400, "Receipt date must be a YYYY-MM-DD date");
    }

    if (!Array.isArray(items) || items.length === 0) {
      return error(res, 400, "At least one item is required");
    }

    for (const line of items) {
      if (!line.item_id) {
        return error(res, 400, "Every line must reference an inventory item");
      }
      if (!isPositiveNumber(line.quantity_received)) {
        return error(res, 400, "Received quantity must be greater than zero");
      }
      if (!isPositiveNumber(line.rate)) {
        return error(res, 400, "Rate must be greater than zero");
      }
    }

    const supplier = await Supplier.findOne({ where: { id: supplier_id, is_archived: false } });
    if (!supplier) {
      return error(res, 400, "Invalid supplier");
    }

    const itemIds = [...new Set(items.map((line) => line.item_id))];
    const foundItems = await InventoryItem.findAll({
      where: { id: itemIds, is_archived: false },
      attributes: ["id"],
    });
    if (foundItems.length !== itemIds.length) {
      const foundIds = new Set(foundItems.map((item) => item.id));
      const missing = itemIds.find((id) => !foundIds.has(id));
      return error(res, 400, `Inventory item not found: ${missing}`);
    }

    const receipt = await stockService.receiveStock({
      purchase_order_id: null,
      supplier_id,
      receipt_date,
      supplier_bill_ref: supplier_bill_ref || null,
      notes: notes || null,
      items: items.map((line) => ({
        purchase_order_item_id: null, // direct receipt — no PO line to accumulate onto
        item_id: line.item_id,
        quantity_received: line.quantity_received,
        rate: line.rate,
      })),
    });

    return success(res, 201, "Goods receipt created successfully", receipt);
  } catch (err) {
    if (err instanceof stockService.InsufficientStockError) {
      // Cannot happen on a receipt, but map it defensively.
      return error(res, 400, err.message);
    }
    if (err instanceof stockService.StockReconciliationError) {
      console.error("Stock reconciliation failure while creating goods receipt:", err);
      return error(res, 500, err.message);
    }
    if (err.name === "SequelizeUniqueConstraintError") {
      return error(res, 400, "Receipt number collision — please try again");
    }
    console.error("Error creating goods receipt:", err);
    return error(res, 500, "Failed to create goods receipt", err.message);
  }
};

const getAllGoodsReceipts = async (req, res) => {
  try {
    const { search, supplier_id, from_date, to_date } = req.query;
    const whereClause = { is_archived: false };

    if (supplier_id) whereClause.supplier_id = supplier_id;

    if (from_date && to_date) {
      whereClause.receipt_date = { [Op.between]: [from_date, to_date] };
    } else if (from_date) {
      whereClause.receipt_date = { [Op.gte]: from_date };
    } else if (to_date) {
      whereClause.receipt_date = { [Op.lte]: to_date };
    }

    if (search) {
      whereClause[Op.or] = [
        { receipt_number: { [Op.iLike]: `%${search}%` } },
        { supplier_bill_ref: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const pagination = getPagination(req.query);

    const { rows, count } = await GoodsReceipt.findAndCountAll({
      where: whereClause,
      include: RECEIPT_INCLUDES,
      order: [["receipt_date", "DESC"], ["created_at", "DESC"]],
      limit: pagination.limit,
      offset: pagination.offset,
      distinct: true, // without this, the include inflates `count`
    });

    const data = rows.map((receipt) => {
      const plain = receipt.toJSON();
      plain.total_amount = plain.items.reduce(
        (sum, line) => sum + parseFloat(line.quantity_received) * parseFloat(line.rate),
        0
      );
      return plain;
    });

    return success(
      res,
      200,
      "Goods receipts retrieved successfully",
      buildPaginatedResponse(data, count, pagination)
    );
  } catch (err) {
    console.error("Error retrieving goods receipts:", err);
    return error(res, 500, "Failed to retrieve goods receipts", err.message);
  }
};

const getGoodsReceiptById = async (req, res) => {
  try {
    const receipt = await GoodsReceipt.findOne({
      where: { id: req.params.id, is_archived: false },
      include: RECEIPT_INCLUDES,
    });

    if (!receipt) {
      return error(res, 404, "Goods receipt not found");
    }

    const plain = receipt.toJSON();
    plain.total_amount = plain.items.reduce(
      (sum, line) => sum + parseFloat(line.quantity_received) * parseFloat(line.rate),
      0
    );

    return success(res, 200, "Goods receipt retrieved successfully", plain);
  } catch (err) {
    console.error("Error retrieving goods receipt:", err);
    return error(res, 500, "Failed to retrieve goods receipt", err.message);
  }
};

module.exports = {
  createGoodsReceipt,
  getAllGoodsReceipts,
  getGoodsReceiptById,
};
