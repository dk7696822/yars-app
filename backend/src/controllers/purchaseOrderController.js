"use strict";

const {
  PurchaseOrder,
  PurchaseOrderItem,
  InventoryItem,
  Supplier,
  GoodsReceipt,
  GoodsReceiptItem,
  AuditLog,
  sequelize,
} = require("../models");
const { createAuditLog } = require("../services/auditService");
const { success, error } = require("../utils/response");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
const { generateDocumentNumber } = require("../services/documentNumber");
const stockService = require("../services/stockService");
const { Op } = require("sequelize");

const PO_STATUSES = ["PENDING", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"];

const PO_INCLUDES = [
  { model: Supplier, as: "supplier", attributes: ["id", "name", "phone"] },
  {
    model: PurchaseOrderItem,
    as: "items",
    include: [{ model: InventoryItem, as: "item", attributes: ["id", "name", "unit", "item_code"] }],
  },
];

const isPositiveNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0;
};

/** DATEONLY columns expect "YYYY-MM-DD"; reject anything else up front instead of 500ing. */
const isDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value));

/** Calendar year without timezone-sensitive Date parsing (same as stockService). */
const yearFromDateString = (dateStr) => Number(String(dateStr).slice(0, 4));

/** Returns a human-readable problem with the order lines, or null if they are fine. */
const validateOrderLines = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return "A purchase order must have at least one item";
  }
  for (const line of items) {
    if (!line.item_id) return "Every line must reference an inventory item";
    if (!isPositiveNumber(line.quantity_ordered)) {
      return "Ordered quantity must be greater than zero";
    }
    if (!isPositiveNumber(line.rate)) return "Rate must be greater than zero";
  }
  return null;
};

/** All referenced items must exist and be active — a clean 400 beats an FK 500. */
const findMissingItemId = async (itemIds) => {
  const uniqueIds = [...new Set(itemIds)];
  const found = await InventoryItem.findAll({
    where: { id: uniqueIds, is_archived: false },
    attributes: ["id"],
  });
  const foundIds = new Set(found.map((item) => item.id));
  return uniqueIds.find((id) => !foundIds.has(id)) || null;
};

const createPurchaseOrder = async (req, res) => {
  try {
    const { supplier_id, order_date, expected_date, notes, items } = req.body;

    if (!supplier_id || !order_date) {
      return error(res, 400, "Supplier and order date are required");
    }

    if (!isDateString(order_date)) {
      return error(res, 400, "Order date must be a YYYY-MM-DD date");
    }

    const lineProblem = validateOrderLines(items);
    if (lineProblem) {
      return error(res, 400, lineProblem);
    }

    const supplier = await Supplier.findOne({ where: { id: supplier_id, is_archived: false } });
    if (!supplier) {
      return error(res, 400, "Invalid supplier");
    }

    const missingItemId = await findMissingItemId(items.map((line) => line.item_id));
    if (missingItemId) {
      return error(res, 400, `Inventory item not found: ${missingItemId}`);
    }

    const purchaseOrder = await sequelize.transaction(async (transaction) => {
      const year = yearFromDateString(order_date);
      const poNumber = await generateDocumentNumber(
        PurchaseOrder,
        "po_number",
        "PO",
        year,
        transaction
      );

      const po = await PurchaseOrder.create(
        {
          po_number: poNumber,
          supplier_id,
          order_date,
          expected_date: expected_date || null,
          notes: notes || null,
        },
        { transaction }
      );

      for (const line of items) {
        await PurchaseOrderItem.create(
          {
            purchase_order_id: po.id,
            item_id: line.item_id,
            quantity_ordered: parseFloat(line.quantity_ordered),
            rate: parseFloat(line.rate),
          },
          { transaction }
        );
      }

      return po;
    });

    // Audit AFTER the transaction commits — an audit row for a rolled-back PO
    // would be a lie. createAuditLog swallows its own errors by design.
    await createAuditLog(AuditLog, {
      entityType: "PURCHASE_ORDER",
      entityId: purchaseOrder.id,
      action: "CREATE",
      newValues: {
        po_number: purchaseOrder.po_number,
        supplier_id,
        order_date,
        expected_date: expected_date || null,
      },
      metadata: {
        supplier_name: supplier.name,
        item_count: items.length,
        total_value: items.reduce(
          (sum, line) => sum + parseFloat(line.quantity_ordered) * parseFloat(line.rate),
          0
        ),
      },
    });

    const created = await PurchaseOrder.findByPk(purchaseOrder.id, { include: PO_INCLUDES });

    return success(res, 201, "Purchase order created successfully", created);
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      // Near-impossible thanks to the advisory lock in generateDocumentNumber,
      // but a number race should read as "try again", not a server fault.
      return error(res, 400, "Purchase order number collision — please try again");
    }
    console.error("Error creating purchase order:", err);
    return error(res, 500, "Failed to create purchase order", err.message);
  }
};

const getAllPurchaseOrders = async (req, res) => {
  try {
    const { search, supplier_id, status, from_date, to_date } = req.query;
    const whereClause = { is_archived: false };

    if (supplier_id) whereClause.supplier_id = supplier_id;

    if (status) {
      if (!PO_STATUSES.includes(status)) {
        return error(res, 400, `Status must be one of: ${PO_STATUSES.join(", ")}`);
      }
      whereClause.status = status;
    }

    if (from_date && to_date) {
      whereClause.order_date = { [Op.between]: [from_date, to_date] };
    } else if (from_date) {
      whereClause.order_date = { [Op.gte]: from_date };
    } else if (to_date) {
      whereClause.order_date = { [Op.lte]: to_date };
    }

    if (search) {
      whereClause.po_number = { [Op.iLike]: `%${search}%` };
    }

    const pagination = getPagination(req.query);

    const { rows, count } = await PurchaseOrder.findAndCountAll({
      where: whereClause,
      include: PO_INCLUDES,
      order: [["order_date", "DESC"], ["created_at", "DESC"]],
      limit: pagination.limit,
      offset: pagination.offset,
      distinct: true, // without this, the include inflates `count`
    });

    // Attach a total value per PO for the list view.
    const data = rows.map((po) => {
      const plain = po.toJSON();
      plain.total_amount = plain.items.reduce(
        (sum, line) => sum + parseFloat(line.quantity_ordered) * parseFloat(line.rate),
        0
      );
      return plain;
    });

    return success(
      res,
      200,
      "Purchase orders retrieved successfully",
      buildPaginatedResponse(data, count, pagination)
    );
  } catch (err) {
    console.error("Error retrieving purchase orders:", err);
    return error(res, 500, "Failed to retrieve purchase orders", err.message);
  }
};

const getPurchaseOrderById = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({
      where: { id: req.params.id, is_archived: false },
      include: [
        ...PO_INCLUDES,
        {
          model: GoodsReceipt,
          as: "receipts",
          where: { is_archived: false },
          required: false,
          include: [{ model: GoodsReceiptItem, as: "items" }],
        },
      ],
    });

    if (!po) {
      return error(res, 404, "Purchase order not found");
    }

    const plain = po.toJSON();
    plain.total_amount = plain.items.reduce(
      (sum, line) => sum + parseFloat(line.quantity_ordered) * parseFloat(line.rate),
      0
    );
    // Per-line shortfall drives the "ordered vs received" view.
    plain.items = plain.items.map((line) => ({
      ...line,
      quantity_pending: Math.max(
        0,
        parseFloat(line.quantity_ordered) - parseFloat(line.quantity_received)
      ),
    }));

    return success(res, 200, "Purchase order retrieved successfully", plain);
  } catch (err) {
    console.error("Error retrieving purchase order:", err);
    return error(res, 500, "Failed to retrieve purchase order", err.message);
  }
};

const updatePurchaseOrder = async (req, res) => {
  try {
    const { supplier_id, order_date, expected_date, notes, items } = req.body;

    const po = await PurchaseOrder.findOne({
      where: { id: req.params.id, is_archived: false },
      include: [{ model: PurchaseOrderItem, as: "items" }],
    });

    if (!po) {
      return error(res, 404, "Purchase order not found");
    }

    // Once material has arrived (or the PO is cancelled), the document is
    // history — editing it would desync quantity_received from the batches
    // that were actually created. Status changes go through /:id/cancel or
    // the receive flow, never through this endpoint.
    if (po.status !== "PENDING") {
      return error(res, 409, "Only pending purchase orders can be edited");
    }

    if (order_date !== undefined && !isDateString(order_date)) {
      return error(res, 400, "Order date must be a YYYY-MM-DD date");
    }

    if (supplier_id && supplier_id !== po.supplier_id) {
      const supplier = await Supplier.findOne({ where: { id: supplier_id, is_archived: false } });
      if (!supplier) {
        return error(res, 400, "Invalid supplier");
      }
    }

    if (items !== undefined) {
      const lineProblem = validateOrderLines(items);
      if (lineProblem) {
        return error(res, 400, lineProblem);
      }

      const missingItemId = await findMissingItemId(items.map((line) => line.item_id));
      if (missingItemId) {
        return error(res, 400, `Inventory item not found: ${missingItemId}`);
      }

      // Belt-and-braces behind the PENDING check above: never rewrite lines
      // that already carry received quantities.
      const hasReceipts = po.items.some((line) => parseFloat(line.quantity_received) > 0);
      if (hasReceipts) {
        return error(
          res,
          409,
          "Cannot change the items on a purchase order that has already received material"
        );
      }
    }

    await sequelize.transaction(async (transaction) => {
      await po.update(
        {
          supplier_id: supplier_id ?? po.supplier_id,
          order_date: order_date ?? po.order_date,
          expected_date: expected_date !== undefined ? expected_date : po.expected_date,
          notes: notes !== undefined ? notes : po.notes,
        },
        { transaction }
      );

      if (items !== undefined) {
        await PurchaseOrderItem.destroy({ where: { purchase_order_id: po.id }, transaction });

        for (const line of items) {
          await PurchaseOrderItem.create(
            {
              purchase_order_id: po.id,
              item_id: line.item_id,
              quantity_ordered: parseFloat(line.quantity_ordered),
              rate: parseFloat(line.rate),
            },
            { transaction }
          );
        }
      }
    });

    const updated = await PurchaseOrder.findByPk(po.id, { include: PO_INCLUDES });

    return success(res, 200, "Purchase order updated successfully", updated);
  } catch (err) {
    console.error("Error updating purchase order:", err);
    return error(res, 500, "Failed to update purchase order", err.message);
  }
};

/**
 * Cancel a PO that never received anything. Once a receipt exists the PO is a
 * live document with batches behind it — cancellation would lie about history.
 */
const cancelPurchaseOrder = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({
      where: { id: req.params.id, is_archived: false },
    });

    if (!po) {
      return error(res, 404, "Purchase order not found");
    }

    if (po.status === "CANCELLED") {
      return error(res, 409, "Purchase order is already cancelled");
    }

    const receiptCount = await GoodsReceipt.count({
      where: { purchase_order_id: po.id, is_archived: false },
    });

    if (receiptCount > 0) {
      return error(res, 409, "Cannot cancel a purchase order that has already received material");
    }

    await po.update({ status: "CANCELLED" });

    return success(res, 200, "Purchase order cancelled successfully", po);
  } catch (err) {
    console.error("Error cancelling purchase order:", err);
    return error(res, 500, "Failed to cancel purchase order", err.message);
  }
};

const deletePurchaseOrder = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({
      where: { id: req.params.id, is_archived: false },
      include: [{ model: PurchaseOrderItem, as: "items" }],
    });

    if (!po) {
      return error(res, 404, "Purchase order not found");
    }

    const receiptCount = await GoodsReceipt.count({
      where: { purchase_order_id: po.id, is_archived: false },
    });
    const hasReceivedQuantity = po.items.some(
      (line) => parseFloat(line.quantity_received) > 0
    );

    if (receiptCount > 0 || hasReceivedQuantity) {
      return error(
        res,
        409,
        "Cannot delete a purchase order that has received material. Cancel it instead."
      );
    }

    await po.update({ is_archived: true });

    return success(res, 200, "Purchase order deleted successfully");
  } catch (err) {
    console.error("Error deleting purchase order:", err);
    return error(res, 500, "Failed to delete purchase order", err.message);
  }
};

/**
 * Receive material against this PO. Delegates entirely to stockService, which
 * owns the transaction, the batch creation, and the PO status recompute.
 * Over-receiving is deliberately allowed — suppliers over-deliver.
 */
const receivePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { receipt_date, supplier_bill_ref, notes, items } = req.body;

    const po = await PurchaseOrder.findOne({
      where: { id, is_archived: false },
      include: [{ model: PurchaseOrderItem, as: "items" }],
    });

    if (!po) {
      return error(res, 404, "Purchase order not found");
    }

    if (po.status === "CANCELLED") {
      return error(res, 409, "Cannot receive material against a cancelled purchase order");
    }

    if (!receipt_date) {
      return error(res, 400, "Receipt date is required");
    }

    if (!isDateString(receipt_date)) {
      return error(res, 400, "Receipt date must be a YYYY-MM-DD date");
    }

    if (!Array.isArray(items) || items.length === 0) {
      return error(res, 400, "At least one item must be received");
    }

    // Resolve each request line against the PO's own lines so
    // quantity_received can never accumulate onto another PO's line.
    const poLinesById = new Map(po.items.map((line) => [line.id, line]));
    const lines = [];

    for (const line of items) {
      let itemId = line.item_id;

      if (line.purchase_order_item_id) {
        const poLine = poLinesById.get(line.purchase_order_item_id);
        if (!poLine) {
          return error(res, 400, "One of the lines does not belong to this purchase order");
        }
        if (itemId && itemId !== poLine.item_id) {
          return error(res, 400, "A line's item does not match its purchase order line");
        }
        itemId = poLine.item_id;
      }

      if (!itemId) {
        return error(res, 400, "Every line must reference an inventory item");
      }
      if (!isPositiveNumber(line.quantity_received)) {
        return error(res, 400, "Received quantity must be greater than zero");
      }
      if (!isPositiveNumber(line.rate)) {
        return error(res, 400, "Rate must be greater than zero");
      }

      lines.push({
        purchase_order_item_id: line.purchase_order_item_id || null,
        item_id: itemId,
        quantity_received: line.quantity_received,
        rate: line.rate,
      });
    }

    const missingItemId = await findMissingItemId(lines.map((line) => line.item_id));
    if (missingItemId) {
      return error(res, 400, `Inventory item not found: ${missingItemId}`);
    }

    const receipt = await stockService.receiveStock({
      purchase_order_id: po.id,
      supplier_id: po.supplier_id,
      receipt_date,
      supplier_bill_ref: supplier_bill_ref || null,
      notes: notes || null,
      items: lines,
    });

    return success(res, 201, "Material received successfully", receipt);
  } catch (err) {
    if (err instanceof stockService.InsufficientStockError) {
      // Cannot happen on a receipt, but map it defensively.
      return error(res, 400, err.message);
    }
    if (err instanceof stockService.StockReconciliationError) {
      console.error("Stock reconciliation failure while receiving purchase order:", err);
      return error(res, 500, err.message);
    }
    if (err.name === "SequelizeUniqueConstraintError") {
      return error(res, 400, "Receipt number collision — please try again");
    }
    console.error("Error receiving purchase order:", err);
    return error(res, 500, "Failed to receive material", err.message);
  }
};

module.exports = {
  createPurchaseOrder,
  getAllPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  cancelPurchaseOrder,
  deletePurchaseOrder,
  receivePurchaseOrder,
};
