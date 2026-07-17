"use strict";

const {
  InventoryItem,
  InventoryCategory,
  ItemAttribute,
  ItemAttributeValue,
  InventoryItemAttributeValue,
  StockBatch,
  StockMovement,
  Supplier,
  sequelize,
} = require("../models");
const { success, error } = require("../utils/response");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
const { Op, QueryTypes } = require("sequelize");

/**
 * Stock-on-hand list: one row per item, with quantity, value, on-order, and a
 * low-stock flag. Aggregates are done in SQL — pulling every batch into Node to
 * sum it would not scale and the database does it better. All user input goes
 * through bind replacements, never string interpolation.
 */
const getStock = async (req, res) => {
  try {
    const { search, category_id, attribute_value_id, low_stock_only, sort_by = "name" } = req.query;
    const pagination = getPagination(req.query);

    const conditions = ["i.is_archived = false"];
    const replacements = { limit: pagination.limit, offset: pagination.offset };

    if (category_id) {
      conditions.push("i.category_id = :category_id");
      replacements.category_id = category_id;
    }

    if (search) {
      conditions.push("(i.name ILIKE :search OR i.item_code ILIKE :search)");
      replacements.search = `%${search}%`;
    }

    // Filter to items carrying one specific attribute value (e.g. all W Cut).
    // Goes through the inventory_item_attribute_values link table — the
    // composite FK there guarantees the value belongs to its attribute.
    if (attribute_value_id) {
      conditions.push(`EXISTS (
        SELECT 1 FROM inventory_item_attribute_values iav
        WHERE iav.item_id = i.id AND iav.attribute_value_id = :attribute_value_id
      )`);
      replacements.attribute_value_id = attribute_value_id;
    }

    const whereSql = conditions.join(" AND ");

    // Low stock: at or below the reorder level. Items with a reorder_level of 0
    // are never "low" — the user has not asked to track a minimum for them.
    const havingSql =
      low_stock_only === "true"
        ? "HAVING COALESCE(SUM(b.quantity_remaining), 0) <= i.reorder_level AND i.reorder_level > 0"
        : "";

    // Whitelist, never interpolate the raw query param into ORDER BY.
    const sortColumns = {
      name: "i.name ASC",
      stock: "in_stock DESC",
      value: "stock_value DESC",
    };
    const orderSql = sortColumns[sort_by] || sortColumns.name;

    const rowsSql = `
      SELECT
        i.id,
        i.name,
        i.item_code,
        i.unit,
        i.reorder_level,
        i.reorder_target,
        c.id   AS category_id,
        c.name AS category_name,
        COALESCE((
          SELECT json_agg(
                   json_build_object(
                     'attribute_id', a.id,
                     'attribute_name', a.name,
                     'value_id', v.id,
                     'value', v.value
                   ) ORDER BY a.name
                 )
          FROM inventory_item_attribute_values iav
          JOIN item_attributes a ON a.id = iav.attribute_id
          JOIN item_attribute_values v ON v.id = iav.attribute_value_id
          WHERE iav.item_id = i.id
        ), '[]'::json)                                    AS attributes,
        COALESCE(SUM(b.quantity_remaining), 0)            AS in_stock,
        COALESCE(SUM(b.quantity_remaining * b.rate), 0)   AS stock_value,
        COALESCE((
          SELECT SUM(poi.quantity_ordered - poi.quantity_received)
          FROM purchase_order_items poi
          JOIN purchase_orders po ON po.id = poi.purchase_order_id
          WHERE poi.item_id = i.id
            AND po.is_archived = false
            AND po.status IN ('PENDING', 'PARTIALLY_RECEIVED')
            AND poi.quantity_ordered > poi.quantity_received
        ), 0) AS on_order
      FROM inventory_items i
      JOIN inventory_categories c ON c.id = i.category_id
      LEFT JOIN stock_batches b ON b.item_id = i.id AND b.quantity_remaining > 0
      WHERE ${whereSql}
      GROUP BY i.id, c.id
      ${havingSql}
      ORDER BY ${orderSql}
      LIMIT :limit OFFSET :offset
    `;

    const countSql = `
      SELECT COUNT(*) FROM (
        SELECT i.id
        FROM inventory_items i
        LEFT JOIN stock_batches b ON b.item_id = i.id AND b.quantity_remaining > 0
        WHERE ${whereSql}
        GROUP BY i.id
        ${havingSql}
      ) AS counted
    `;

    const rows = await sequelize.query(rowsSql, { replacements, type: QueryTypes.SELECT });
    const countResult = await sequelize.query(countSql, { replacements, type: QueryTypes.SELECT });
    const total = parseInt(countResult[0].count, 10);

    const data = rows.map((row) => {
      const inStock = parseFloat(row.in_stock);
      const reorderLevel = parseFloat(row.reorder_level);
      const reorderTarget = row.reorder_target === null ? null : parseFloat(row.reorder_target);

      const isLowStock = reorderLevel > 0 && inStock <= reorderLevel;
      // Top back up to the target; if no target is set, back up to the reorder level.
      const topUpTo = reorderTarget !== null ? reorderTarget : reorderLevel;

      return {
        id: row.id,
        name: row.name,
        item_code: row.item_code,
        unit: row.unit,
        attributes: row.attributes, // [{ attribute_id, attribute_name, value_id, value }]
        category: { id: row.category_id, name: row.category_name },
        in_stock: inStock,
        stock_value: parseFloat(row.stock_value),
        on_order: parseFloat(row.on_order),
        reorder_level: reorderLevel,
        reorder_target: reorderTarget,
        is_low_stock: isLowStock,
        suggested_quantity: isLowStock ? Math.max(0, topUpTo - inStock) : 0,
      };
    });

    return success(
      res,
      200,
      "Stock retrieved successfully",
      buildPaginatedResponse(data, total, pagination)
    );
  } catch (err) {
    console.error("Error retrieving stock:", err);
    return error(res, 500, "Failed to retrieve stock", err.message);
  }
};

/** Headline numbers for the top of the Stock page. */
const getStockSummary = async (req, res) => {
  try {
    const [valueRow] = await sequelize.query(
      `SELECT COALESCE(SUM(quantity_remaining * rate), 0) AS total_value
       FROM stock_batches WHERE quantity_remaining > 0`,
      { type: QueryTypes.SELECT }
    );

    const [lowStockRow] = await sequelize.query(
      `SELECT COUNT(*) AS low_stock_count FROM (
         SELECT i.id
         FROM inventory_items i
         LEFT JOIN stock_batches b ON b.item_id = i.id AND b.quantity_remaining > 0
         WHERE i.is_archived = false AND i.reorder_level > 0
         GROUP BY i.id
         HAVING COALESCE(SUM(b.quantity_remaining), 0) <= i.reorder_level
       ) AS low`,
      { type: QueryTypes.SELECT }
    );

    // "This month" = calendar month to date.
    const [monthRow] = await sequelize.query(
      `SELECT
         COALESCE(SUM(CASE WHEN movement_type = 'RECEIPT' THEN total_cost ELSE 0 END), 0) AS received_value,
         COALESCE(SUM(CASE WHEN movement_type = 'ISSUE'   THEN total_cost ELSE 0 END), 0) AS consumed_value,
         COALESCE(SUM(CASE WHEN movement_type = 'WASTAGE' THEN total_cost ELSE 0 END), 0) AS wastage_value
       FROM stock_movements
       WHERE movement_date >= date_trunc('month', CURRENT_DATE)`,
      { type: QueryTypes.SELECT }
    );

    const [itemCountRow] = await sequelize.query(
      `SELECT COUNT(*) AS item_count FROM inventory_items WHERE is_archived = false`,
      { type: QueryTypes.SELECT }
    );

    return success(res, 200, "Stock summary retrieved successfully", {
      total_stock_value: parseFloat(valueRow.total_value),
      low_stock_count: parseInt(lowStockRow.low_stock_count, 10),
      item_count: parseInt(itemCountRow.item_count, 10),
      received_value_this_month: parseFloat(monthRow.received_value),
      consumed_value_this_month: parseFloat(monthRow.consumed_value),
      wastage_value_this_month: parseFloat(monthRow.wastage_value),
    });
  } catch (err) {
    console.error("Error retrieving stock summary:", err);
    return error(res, 500, "Failed to retrieve stock summary", err.message);
  }
};

/** One item: its details, its open FIFO batches, and its current stock/value. */
const getItemStock = async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await InventoryItem.findOne({
      where: { id: itemId, is_archived: false },
      include: [
        { model: InventoryCategory, as: "category", attributes: ["id", "name"] },
        {
          model: InventoryItemAttributeValue,
          as: "attributeValues",
          include: [
            { model: ItemAttribute, as: "attribute", attributes: ["id", "name"] },
            { model: ItemAttributeValue, as: "value", attributes: ["id", "value"] },
          ],
        },
      ],
    });

    if (!item) {
      return error(res, 404, "Inventory item not found");
    }

    // Flatten the attribute link rows into the same shape the item API uses.
    const plainItem = item.toJSON();
    plainItem.attributes = (plainItem.attributeValues || []).map((link) => ({
      attribute_id: link.attribute.id,
      attribute_name: link.attribute.name,
      value_id: link.value.id,
      value: link.value.value,
    }));
    delete plainItem.attributeValues;

    const batches = await StockBatch.findAll({
      where: { item_id: itemId, quantity_remaining: { [Op.gt]: 0 } },
      order: [["received_date", "ASC"], ["sequence_number", "ASC"]], // FIFO order
      include: [
        {
          association: "goodsReceiptItem",
          required: false,
          include: [
            {
              association: "goodsReceipt",
              required: false,
              include: [{ model: Supplier, as: "supplier", attributes: ["id", "name"] }],
            },
          ],
        },
      ],
    });

    const openBatches = batches.map((batch) => {
      const plain = batch.toJSON();
      const remaining = parseFloat(plain.quantity_remaining);
      const rate = parseFloat(plain.rate);

      return {
        id: plain.id,
        received_date: plain.received_date,
        quantity_received: parseFloat(plain.quantity_received),
        quantity_remaining: remaining,
        rate,
        value: remaining * rate,
        supplier: plain.goodsReceiptItem?.goodsReceipt?.supplier || null,
        receipt_number: plain.goodsReceiptItem?.goodsReceipt?.receipt_number || null,
      };
    });

    const inStock = openBatches.reduce((sum, b) => sum + b.quantity_remaining, 0);
    const stockValue = openBatches.reduce((sum, b) => sum + b.value, 0);

    return success(res, 200, "Item stock retrieved successfully", {
      item: plainItem,
      in_stock: inStock,
      stock_value: stockValue,
      batches: openBatches,
    });
  } catch (err) {
    console.error("Error retrieving item stock:", err);
    return error(res, 500, "Failed to retrieve item stock", err.message);
  }
};

/** Paginated movement history for one item. The ledger grows forever — always paginate. */
const getItemMovements = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { movement_type, from_date, to_date } = req.query;
    const pagination = getPagination(req.query);

    const whereClause = { item_id: itemId };

    if (movement_type) whereClause.movement_type = movement_type;

    if (from_date && to_date) {
      whereClause.movement_date = { [Op.between]: [from_date, to_date] };
    } else if (from_date) {
      whereClause.movement_date = { [Op.gte]: from_date };
    } else if (to_date) {
      whereClause.movement_date = { [Op.lte]: to_date };
    }

    const { rows, count } = await StockMovement.findAndCountAll({
      where: whereClause,
      order: [["movement_date", "DESC"], ["created_at", "DESC"]],
      limit: pagination.limit,
      offset: pagination.offset,
    });

    return success(
      res,
      200,
      "Stock movements retrieved successfully",
      buildPaginatedResponse(rows, count, pagination)
    );
  } catch (err) {
    console.error("Error retrieving stock movements:", err);
    return error(res, 500, "Failed to retrieve stock movements", err.message);
  }
};

module.exports = {
  getStock,
  getStockSummary,
  getItemStock,
  getItemMovements,
};
