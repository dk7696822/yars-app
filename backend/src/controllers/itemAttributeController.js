"use strict";

const {
  ItemAttribute,
  ItemAttributeValue,
  InventoryItemAttributeValue,
  InventoryItem,
} = require("../models");
const { success, error } = require("../utils/response");
const { Op, fn, col, where } = require("sequelize");

/** Case-insensitive EQUALITY on a column — never iLike, whose %/_ are wildcards. */
const equalsInsensitive = (column, text) => where(fn("lower", col(column)), text.toLowerCase());

/** Count non-archived items still using any of these value ids. */
const countItemsUsingValues = async (valueIds) => {
  if (valueIds.length === 0) return 0;

  return InventoryItemAttributeValue.count({
    where: { attribute_value_id: { [Op.in]: valueIds } },
    include: [{ model: InventoryItem, as: "item", where: { is_archived: false }, required: true }],
  });
};

const createItemAttribute = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return error(res, 400, "Attribute name is required");
    }

    const existing = await ItemAttribute.findOne({
      where: { [Op.and]: [equalsInsensitive("name", name.trim())], is_archived: false },
    });

    if (existing) {
      return error(res, 400, "An attribute with this name already exists");
    }

    const attribute = await ItemAttribute.create({ name: name.trim() });

    return success(res, 201, "Item attribute created successfully", attribute);
  } catch (err) {
    console.error("Error creating item attribute:", err);
    return error(res, 500, "Failed to create item attribute", err.message);
  }
};

/** Every non-archived attribute with its non-archived values nested. Not paginated — small master list. */
const getAllItemAttributes = async (req, res) => {
  try {
    const attributes = await ItemAttribute.findAll({
      where: { is_archived: false },
      include: [
        {
          model: ItemAttributeValue,
          as: "values",
          where: { is_archived: false },
          required: false,
          separate: true,
          order: [["value", "ASC"]],
        },
      ],
      order: [["name", "ASC"]],
    });

    return success(res, 200, "Item attributes retrieved successfully", attributes);
  } catch (err) {
    console.error("Error retrieving item attributes:", err);
    return error(res, 500, "Failed to retrieve item attributes", err.message);
  }
};

const updateItemAttribute = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return error(res, 400, "Attribute name is required");
    }

    const attribute = await ItemAttribute.findOne({ where: { id, is_archived: false } });

    if (!attribute) {
      return error(res, 404, "Item attribute not found");
    }

    const duplicate = await ItemAttribute.findOne({
      where: { [Op.and]: [equalsInsensitive("name", name.trim())], id: { [Op.ne]: id }, is_archived: false },
    });

    if (duplicate) {
      return error(res, 400, "Another attribute with this name already exists");
    }

    await attribute.update({ name: name.trim() });

    return success(res, 200, "Item attribute updated successfully", attribute);
  } catch (err) {
    console.error("Error updating item attribute:", err);
    return error(res, 500, "Failed to update item attribute", err.message);
  }
};

const deleteItemAttribute = async (req, res) => {
  try {
    const { id } = req.params;

    const attribute = await ItemAttribute.findOne({ where: { id, is_archived: false } });

    if (!attribute) {
      return error(res, 404, "Item attribute not found");
    }

    // Refuse while any live item still carries one of this attribute's values —
    // deleting it would silently strip meaning from those items.
    // Check-then-act race tolerated: single-user app, worst case is a stale refusal.
    const values = await ItemAttributeValue.findAll({
      where: { attribute_id: id },
      attributes: ["id"],
    });
    const inUse = await countItemsUsingValues(values.map((value) => value.id));

    if (inUse > 0) {
      return error(res, 409, "Cannot delete this attribute as it is being used by inventory items");
    }

    // Soft-delete the values along with their attribute, so nothing orphaned
    // ever surfaces in a dropdown.
    await ItemAttributeValue.update({ is_archived: true }, { where: { attribute_id: id } });
    await attribute.update({ is_archived: true });

    return success(res, 200, "Item attribute deleted successfully");
  } catch (err) {
    console.error("Error deleting item attribute:", err);
    return error(res, 500, "Failed to delete item attribute", err.message);
  }
};

const createItemAttributeValue = async (req, res) => {
  try {
    const { id } = req.params; // attribute id
    const { value } = req.body;

    if (!value || !String(value).trim()) {
      return error(res, 400, "Value is required");
    }

    const attribute = await ItemAttribute.findOne({ where: { id, is_archived: false } });

    if (!attribute) {
      return error(res, 404, "Item attribute not found");
    }

    const existing = await ItemAttributeValue.findOne({
      where: {
        attribute_id: id,
        [Op.and]: [equalsInsensitive("value", String(value).trim())],
        is_archived: false,
      },
    });

    if (existing) {
      return error(res, 400, `"${String(value).trim()}" already exists under ${attribute.name}`);
    }

    const created = await ItemAttributeValue.create({
      attribute_id: id,
      value: String(value).trim(),
    });

    return success(res, 201, "Attribute value created successfully", created);
  } catch (err) {
    console.error("Error creating attribute value:", err);
    return error(res, 500, "Failed to create attribute value", err.message);
  }
};

const updateItemAttributeValue = async (req, res) => {
  try {
    const { valueId } = req.params;
    const { value } = req.body;

    if (!value || !String(value).trim()) {
      return error(res, 400, "Value is required");
    }

    const attributeValue = await ItemAttributeValue.findOne({
      where: { id: valueId, is_archived: false },
    });

    if (!attributeValue) {
      return error(res, 404, "Attribute value not found");
    }

    const duplicate = await ItemAttributeValue.findOne({
      where: {
        attribute_id: attributeValue.attribute_id,
        [Op.and]: [equalsInsensitive("value", String(value).trim())],
        id: { [Op.ne]: valueId },
        is_archived: false,
      },
    });

    if (duplicate) {
      return error(res, 400, "Another value with this name already exists under this attribute");
    }

    await attributeValue.update({ value: String(value).trim() });

    return success(res, 200, "Attribute value updated successfully", attributeValue);
  } catch (err) {
    console.error("Error updating attribute value:", err);
    return error(res, 500, "Failed to update attribute value", err.message);
  }
};

const deleteItemAttributeValue = async (req, res) => {
  try {
    const { valueId } = req.params;

    const attributeValue = await ItemAttributeValue.findOne({
      where: { id: valueId, is_archived: false },
    });

    if (!attributeValue) {
      return error(res, 404, "Attribute value not found");
    }

    // Check-then-act race tolerated: single-user app, worst case is a stale refusal.
    const inUse = await countItemsUsingValues([valueId]);

    if (inUse > 0) {
      return error(res, 409, "Cannot delete this value as it is being used by inventory items");
    }

    await attributeValue.update({ is_archived: true });

    return success(res, 200, "Attribute value deleted successfully");
  } catch (err) {
    console.error("Error deleting attribute value:", err);
    return error(res, 500, "Failed to delete attribute value", err.message);
  }
};

module.exports = {
  createItemAttribute,
  getAllItemAttributes,
  updateItemAttribute,
  deleteItemAttribute,
  createItemAttributeValue,
  updateItemAttributeValue,
  deleteItemAttributeValue,
};
