"use strict";

const { ExpenseCategory, Expense } = require("../models");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");

/**
 * Create a new expense category
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const createExpenseCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return error(res, 400, "Category name is required");
    }

    // Check if category with the same name already exists
    const existingCategory = await ExpenseCategory.findOne({
      where: {
        name: {
          [Op.iLike]: name
        },
        is_archived: false
      }
    });

    if (existingCategory) {
      return error(res, 400, "A category with this name already exists");
    }

    const expenseCategory = await ExpenseCategory.create({ name });

    return success(res, 201, "Expense category created successfully", expenseCategory);
  } catch (err) {
    console.error("Error creating expense category:", err);
    return error(res, 500, "Failed to create expense category", err.message);
  }
};

/**
 * Get all expense categories
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getAllExpenseCategories = async (req, res) => {
  try {
    const { name } = req.query;
    let whereClause = {
      is_archived: false,
    };

    if (name) {
      whereClause.name = {
        [Op.iLike]: `%${name}%`,
      };
    }

    const expenseCategories = await ExpenseCategory.findAll({
      where: whereClause,
      order: [["name", "ASC"]],
    });

    return success(res, 200, "Expense categories retrieved successfully", expenseCategories);
  } catch (err) {
    console.error("Error retrieving expense categories:", err);
    return error(res, 500, "Failed to retrieve expense categories", err.message);
  }
};

/**
 * Get an expense category by ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getExpenseCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const expenseCategory = await ExpenseCategory.findOne({
      where: {
        id,
        is_archived: false,
      },
    });

    if (!expenseCategory) {
      return error(res, 404, "Expense category not found");
    }

    return success(res, 200, "Expense category retrieved successfully", expenseCategory);
  } catch (err) {
    console.error("Error retrieving expense category:", err);
    return error(res, 500, "Failed to retrieve expense category", err.message);
  }
};

/**
 * Update an expense category
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const updateExpenseCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return error(res, 400, "Category name is required");
    }

    const expenseCategory = await ExpenseCategory.findOne({
      where: {
        id,
        is_archived: false,
      },
    });

    if (!expenseCategory) {
      return error(res, 404, "Expense category not found");
    }

    // Check if another category with the same name already exists
    const existingCategory = await ExpenseCategory.findOne({
      where: {
        name: {
          [Op.iLike]: name
        },
        id: {
          [Op.ne]: id
        },
        is_archived: false
      }
    });

    if (existingCategory) {
      return error(res, 400, "Another category with this name already exists");
    }

    await expenseCategory.update({ name });

    return success(res, 200, "Expense category updated successfully", expenseCategory);
  } catch (err) {
    console.error("Error updating expense category:", err);
    return error(res, 500, "Failed to update expense category", err.message);
  }
};

/**
 * Delete an expense category (soft delete)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const deleteExpenseCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const expenseCategory = await ExpenseCategory.findOne({
      where: {
        id,
        is_archived: false,
      },
    });

    if (!expenseCategory) {
      return error(res, 404, "Expense category not found");
    }

    // Check if the category is being used by any expenses
    const expensesCount = await Expense.count({
      where: {
        category_id: id,
        is_archived: false,
      },
    });

    if (expensesCount > 0) {
      return error(
        res,
        400,
        "Cannot delete this category as it is being used by expenses"
      );
    }

    await expenseCategory.update({ is_archived: true });

    return success(res, 200, "Expense category deleted successfully");
  } catch (err) {
    console.error("Error deleting expense category:", err);
    return error(res, 500, "Failed to delete expense category", err.message);
  }
};

module.exports = {
  createExpenseCategory,
  getAllExpenseCategories,
  getExpenseCategoryById,
  updateExpenseCategory,
  deleteExpenseCategory,
};
