"use strict";

const {
  InventoryItem,
  InventoryCategory,
  ItemAttribute,
  ItemAttributeValue,
  InventoryItemAttributeValue,
  StockBatch,
  PurchaseOrderItem,
  sequelize,
} = require("../models");
const { success, error } = require("../utils/response");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
const { Op } = require("sequelize");

const VALID_UNITS = ["KG", "PCS", "METRE", "ROLL", "LITRE"];

const ITEM_INCLUDES = [
  { model: InventoryCategory, as: "category", attributes: ["id", "name"] },
  {
    model: InventoryItemAttributeValue,
    as: "attributeValues",
    include: [
      { model: ItemAttribute, as: "attribute", attributes: ["id", "name"] },
      { model: ItemAttributeValue, as: "value", attributes: ["id", "value"] },
    ],
  },
];

/** Flatten the nested link rows into a friendly `attributes` array on the response. */
const withAttributes = (item) => {
  const plain = item.toJSON();
  plain.attributes = (plain.attributeValues || []).map((link) => ({
    attribute_id: link.attribute.id,
    attribute_name: link.attribute.name,
    value_id: link.value.id,
    value: link.value.value,
  }));
  delete plain.attributeValues;
  return plain;
};

/**
 * Validate a set of attribute_value_ids: every value must exist and be
 * non-archived, and no two values may belong to the same attribute — an item
 * holds at most ONE value per attribute.
 *
 * The database backstops two of these rules (the UNIQUE(item_id, attribute_id)
 * constraint, and the composite FK that makes an attribute/value mismatch
 * impossible) — this function exists to turn those into friendly 400s instead
 * of constraint errors. The archived check is different: **the schema cannot
 * express "no linking to an archived value", so this filter is the ONLY
 * enforcement.** Do not remove the `is_archived: false` conditions.
 *
 * @returns the loaded ItemAttributeValue rows (with their attribute)
 * @throws Error with a user-facing message on any violation
 */
const resolveAttributeValues = async (attributeValueIds) => {
  const ids = [...new Set(attributeValueIds)];

  const values = await ItemAttributeValue.findAll({
    where: { id: { [Op.in]: ids }, is_archived: false },
    include: [
      { model: ItemAttribute, as: "attribute", attributes: ["id", "name"], where: { is_archived: false } },
    ],
  });

  if (values.length !== ids.length) {
    throw new Error("One or more attribute values are invalid or archived");
  }

  const seenAttributes = new Set();
  for (const value of values) {
    if (seenAttributes.has(value.attribute_id)) {
      throw new Error(`Only one ${value.attribute.name} value can be chosen per item`);
    }
    seenAttributes.add(value.attribute_id);
  }

  return values;
};

const createInventoryItem = async (req, res) => {
  try {
    const { name, item_code, category_id, unit, reorder_level, reorder_target, notes, attribute_value_ids } = req.body;

    if (!name || !category_id || !unit) {
      return error(res, 400, "Name, category, and unit are required");
    }

    if (!VALID_UNITS.includes(unit)) {
      return error(res, 400, `Unit must be one of: ${VALID_UNITS.join(", ")}`);
    }

    const category = await InventoryCategory.findOne({
      where: { id: category_id, is_archived: false },
    });

    if (!category) {
      return error(res, 400, "Invalid inventory category");
    }

    let attributeValues = [];
    if (attribute_value_ids && attribute_value_ids.length > 0) {
      try {
        attributeValues = await resolveAttributeValues(attribute_value_ids);
      } catch (validationErr) {
        return error(res, 400, validationErr.message);
      }
    }

    const item = await sequelize.transaction(async (transaction) => {
      const created = await InventoryItem.create(
        {
          name,
          item_code: item_code || null,
          category_id,
          unit,
          reorder_level: reorder_level || 0,
          reorder_target: reorder_target || null,
          notes: notes || null,
        },
        { transaction }
      );

      for (const value of attributeValues) {
        await InventoryItemAttributeValue.create(
          {
            item_id: created.id,
            attribute_id: value.attribute_id, // from the value row, never from the client
            attribute_value_id: value.id,
          },
          { transaction }
        );
      }

      return created;
    });

    const created = await InventoryItem.findByPk(item.id, { include: ITEM_INCLUDES });

    return success(res, 201, "Inventory item created successfully", withAttributes(created));
  } catch (err) {
    console.error("Error creating inventory item:", err);
    return error(res, 500, "Failed to create inventory item", err.message);
  }
};

const getAllInventoryItems = async (req, res) => {
  try {
    const { search, category_id, attribute_value_id, all } = req.query;
    const whereClause = { is_archived: false };

    if (category_id) {
      whereClause.category_id = category_id;
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { item_code: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Filter to items carrying one specific attribute value (e.g. all W Cut).
    if (attribute_value_id) {
      const links = await InventoryItemAttributeValue.findAll({
        where: { attribute_value_id },
        attributes: ["item_id"],
      });
      whereClause.id = { [Op.in]: links.map((link) => link.item_id) };
    }

    // `all=true` skips pagination — used to populate item pickers.
    if (all === "true") {
      const items = await InventoryItem.findAll({
        where: whereClause,
        include: ITEM_INCLUDES,
        order: [["name", "ASC"]],
      });
      return success(res, 200, "Inventory items retrieved successfully", items.map(withAttributes));
    }

    const pagination = getPagination(req.query);

    const { rows, count } = await InventoryItem.findAndCountAll({
      where: whereClause,
      include: ITEM_INCLUDES,
      order: [["name", "ASC"]],
      limit: pagination.limit,
      offset: pagination.offset,
      distinct: true, // the attributeValues include would inflate `count` otherwise
    });

    return success(
      res,
      200,
      "Inventory items retrieved successfully",
      buildPaginatedResponse(rows.map(withAttributes), count, pagination)
    );
  } catch (err) {
    console.error("Error retrieving inventory items:", err);
    return error(res, 500, "Failed to retrieve inventory items", err.message);
  }
};

const getInventoryItemById = async (req, res) => {
  try {
    const item = await InventoryItem.findOne({
      where: { id: req.params.id, is_archived: false },
      include: ITEM_INCLUDES,
    });

    if (!item) {
      return error(res, 404, "Inventory item not found");
    }

    return success(res, 200, "Inventory item retrieved successfully", withAttributes(item));
  } catch (err) {
    console.error("Error retrieving inventory item:", err);
    return error(res, 500, "Failed to retrieve inventory item", err.message);
  }
};

const updateInventoryItem = async (req, res) => {
  try {
    const { name, item_code, category_id, unit, reorder_level, reorder_target, notes, attribute_value_ids } = req.body;

    const item = await InventoryItem.findOne({
      where: { id: req.params.id, is_archived: false },
    });

    if (!item) {
      return error(res, 404, "Inventory item not found");
    }

    if (unit && !VALID_UNITS.includes(unit)) {
      return error(res, 400, `Unit must be one of: ${VALID_UNITS.join(", ")}`);
    }

    if (category_id) {
      const category = await InventoryCategory.findOne({
        where: { id: category_id, is_archived: false },
      });
      if (!category) {
        return error(res, 400, "Invalid inventory category");
      }
    }

    // undefined = leave attributes alone; an array (even []) = replace them.
    let attributeValues = null;
    if (attribute_value_ids !== undefined) {
      try {
        attributeValues = attribute_value_ids.length > 0 ? await resolveAttributeValues(attribute_value_ids) : [];
      } catch (validationErr) {
        return error(res, 400, validationErr.message);
      }
    }

    await sequelize.transaction(async (transaction) => {
      await item.update(
        {
          name: name ?? item.name,
          item_code: item_code ?? item.item_code,
          category_id: category_id ?? item.category_id,
          unit: unit ?? item.unit,
          reorder_level: reorder_level ?? item.reorder_level,
          reorder_target: reorder_target ?? item.reorder_target,
          notes: notes ?? item.notes,
        },
        { transaction }
      );

      if (attributeValues !== null) {
        await InventoryItemAttributeValue.destroy({ where: { item_id: item.id }, transaction });

        for (const value of attributeValues) {
          await InventoryItemAttributeValue.create(
            {
              item_id: item.id,
              attribute_id: value.attribute_id,
              attribute_value_id: value.id,
            },
            { transaction }
          );
        }
      }
    });

    const updated = await InventoryItem.findByPk(item.id, { include: ITEM_INCLUDES });

    return success(res, 200, "Inventory item updated successfully", withAttributes(updated));
  } catch (err) {
    console.error("Error updating inventory item:", err);
    return error(res, 500, "Failed to update inventory item", err.message);
  }
};

const deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await InventoryItem.findOne({ where: { id, is_archived: false } });

    if (!item) {
      return error(res, 404, "Inventory item not found");
    }

    // Refuse to archive an item that still physically exists in stock — that
    // would silently make the stock value wrong.
    const batches = await StockBatch.findAll({
      where: { item_id: id, quantity_remaining: { [Op.gt]: 0 } },
    });

    if (batches.length > 0) {
      return error(res, 400, "Cannot delete this item as it still has stock on hand");
    }

    // Comparing two COLUMNS, not a column to a value. Op.lt with col() does not
    // do this reliably in Sequelize 6 — use an explicit literal.
    const openPoLines = await PurchaseOrderItem.count({
      where: {
        item_id: id,
        [Op.and]: [sequelize.literal("quantity_received < quantity_ordered")],
      },
    });

    if (openPoLines > 0) {
      return error(res, 400, "Cannot delete this item as it is on an open purchase order");
    }

    await item.update({ is_archived: true });

    return success(res, 200, "Inventory item deleted successfully");
  } catch (err) {
    console.error("Error deleting inventory item:", err);
    return error(res, 500, "Failed to delete inventory item", err.message);
  }
};

module.exports = {
  createInventoryItem,
  getAllInventoryItems,
  getInventoryItemById,
  updateInventoryItem,
  deleteInventoryItem,
};
