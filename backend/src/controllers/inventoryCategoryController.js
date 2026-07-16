"use strict";

const { InventoryCategory, InventoryItem } = require("../models");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");

const createInventoryCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return error(res, 400, "Category name is required");
    }

    const existing = await InventoryCategory.findOne({
      where: { name: { [Op.iLike]: name }, is_archived: false },
    });

    if (existing) {
      return error(res, 400, "A category with this name already exists");
    }

    const category = await InventoryCategory.create({ name });

    return success(res, 201, "Inventory category created successfully", category);
  } catch (err) {
    console.error("Error creating inventory category:", err);
    return error(res, 500, "Failed to create inventory category", err.message);
  }
};

const getAllInventoryCategories = async (req, res) => {
  try {
    const { name } = req.query;
    const whereClause = { is_archived: false };

    if (name) {
      whereClause.name = { [Op.iLike]: `%${name}%` };
    }

    const categories = await InventoryCategory.findAll({
      where: whereClause,
      order: [["name", "ASC"]],
    });

    return success(res, 200, "Inventory categories retrieved successfully", categories);
  } catch (err) {
    console.error("Error retrieving inventory categories:", err);
    return error(res, 500, "Failed to retrieve inventory categories", err.message);
  }
};

const getInventoryCategoryById = async (req, res) => {
  try {
    const category = await InventoryCategory.findOne({
      where: { id: req.params.id, is_archived: false },
    });

    if (!category) {
      return error(res, 404, "Inventory category not found");
    }

    return success(res, 200, "Inventory category retrieved successfully", category);
  } catch (err) {
    console.error("Error retrieving inventory category:", err);
    return error(res, 500, "Failed to retrieve inventory category", err.message);
  }
};

const updateInventoryCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return error(res, 400, "Category name is required");
    }

    const category = await InventoryCategory.findOne({ where: { id, is_archived: false } });

    if (!category) {
      return error(res, 404, "Inventory category not found");
    }

    const duplicate = await InventoryCategory.findOne({
      where: { name: { [Op.iLike]: name }, id: { [Op.ne]: id }, is_archived: false },
    });

    if (duplicate) {
      return error(res, 400, "Another category with this name already exists");
    }

    await category.update({ name });

    return success(res, 200, "Inventory category updated successfully", category);
  } catch (err) {
    console.error("Error updating inventory category:", err);
    return error(res, 500, "Failed to update inventory category", err.message);
  }
};

const deleteInventoryCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await InventoryCategory.findOne({ where: { id, is_archived: false } });

    if (!category) {
      return error(res, 404, "Inventory category not found");
    }

    // Never orphan an item by deleting its category.
    const itemCount = await InventoryItem.count({
      where: { category_id: id, is_archived: false },
    });

    if (itemCount > 0) {
      return error(res, 400, "Cannot delete this category as it is being used by inventory items");
    }

    await category.update({ is_archived: true });

    return success(res, 200, "Inventory category deleted successfully");
  } catch (err) {
    console.error("Error deleting inventory category:", err);
    return error(res, 500, "Failed to delete inventory category", err.message);
  }
};

module.exports = {
  createInventoryCategory,
  getAllInventoryCategories,
  getInventoryCategoryById,
  updateInventoryCategory,
  deleteInventoryCategory,
};
