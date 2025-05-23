"use strict";

const { Expense, ExpenseCategory, sequelize } = require("../models");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");

/**
 * Create a new expense
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const createExpense = async (req, res) => {
  try {
    const {
      bill_date,
      category_id,
      description,
      vendor,
      quantity,
      unit_cost,
      total_cost,
      due_date,
      payment_status,
    } = req.body;

    // Validate required fields
    if (!bill_date || !category_id || !description || !vendor || !unit_cost) {
      return error(
        res,
        400,
        "Bill date, category, description, vendor, and unit cost are required"
      );
    }

    // Validate category exists
    const category = await ExpenseCategory.findOne({
      where: {
        id: category_id,
        is_archived: false,
      },
    });

    if (!category) {
      return error(res, 400, "Invalid expense category");
    }

    // Calculate total cost if not provided
    const calculatedTotalCost = total_cost || (quantity || 1) * parseFloat(unit_cost);

    const expense = await Expense.create({
      bill_date,
      category_id,
      description,
      vendor,
      quantity: quantity || 1,
      unit_cost: parseFloat(unit_cost),
      total_cost: calculatedTotalCost,
      due_date: due_date || null,
      payment_status: payment_status || "UNPAID",
    });

    return success(res, 201, "Expense created successfully", expense);
  } catch (err) {
    console.error("Error creating expense:", err);
    return error(res, 500, "Failed to create expense", err.message);
  }
};

/**
 * Get all expenses with filtering options
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getAllExpenses = async (req, res) => {
  try {
    const {
      category_id,
      from_date,
      to_date,
      payment_status,
      vendor,
      search,
    } = req.query;

    let whereClause = {
      is_archived: false,
    };

    // Apply filters
    if (category_id) {
      whereClause.category_id = category_id;
    }

    if (from_date && to_date) {
      whereClause.bill_date = {
        [Op.between]: [from_date, to_date],
      };
    } else if (from_date) {
      whereClause.bill_date = {
        [Op.gte]: from_date,
      };
    } else if (to_date) {
      whereClause.bill_date = {
        [Op.lte]: to_date,
      };
    }

    if (payment_status) {
      whereClause.payment_status = payment_status;
    }

    if (vendor) {
      whereClause.vendor = {
        [Op.iLike]: `%${vendor}%`,
      };
    }

    if (search) {
      whereClause[Op.or] = [
        { description: { [Op.iLike]: `%${search}%` } },
        { vendor: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const expenses = await Expense.findAll({
      where: whereClause,
      include: [
        {
          model: ExpenseCategory,
          as: "category",
          where: {
            is_archived: false,
          },
        },
      ],
      order: [["bill_date", "DESC"]],
    });

    return success(res, 200, "Expenses retrieved successfully", expenses);
  } catch (err) {
    console.error("Error retrieving expenses:", err);
    return error(res, 500, "Failed to retrieve expenses", err.message);
  }
};

/**
 * Get an expense by ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findOne({
      where: {
        id,
        is_archived: false,
      },
      include: [
        {
          model: ExpenseCategory,
          as: "category",
          where: {
            is_archived: false,
          },
        },
      ],
    });

    if (!expense) {
      return error(res, 404, "Expense not found");
    }

    return success(res, 200, "Expense retrieved successfully", expense);
  } catch (err) {
    console.error("Error retrieving expense:", err);
    return error(res, 500, "Failed to retrieve expense", err.message);
  }
};

/**
 * Update an expense
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      bill_date,
      category_id,
      description,
      vendor,
      quantity,
      unit_cost,
      total_cost,
      due_date,
      payment_status,
    } = req.body;

    const expense = await Expense.findOne({
      where: {
        id,
        is_archived: false,
      },
    });

    if (!expense) {
      return error(res, 404, "Expense not found");
    }

    // Validate category if provided
    if (category_id) {
      const category = await ExpenseCategory.findOne({
        where: {
          id: category_id,
          is_archived: false,
        },
      });

      if (!category) {
        return error(res, 400, "Invalid expense category");
      }
    }

    // Calculate total cost if unit_cost or quantity is updated
    let calculatedTotalCost = total_cost;
    if (unit_cost !== undefined || quantity !== undefined) {
      const newUnitCost = unit_cost !== undefined ? parseFloat(unit_cost) : expense.unit_cost;
      const newQuantity = quantity !== undefined ? quantity : expense.quantity;
      calculatedTotalCost = newQuantity * newUnitCost;
    }

    await expense.update({
      bill_date: bill_date || expense.bill_date,
      category_id: category_id || expense.category_id,
      description: description || expense.description,
      vendor: vendor || expense.vendor,
      quantity: quantity !== undefined ? quantity : expense.quantity,
      unit_cost: unit_cost !== undefined ? parseFloat(unit_cost) : expense.unit_cost,
      total_cost: calculatedTotalCost,
      due_date: due_date !== undefined ? due_date : expense.due_date,
      payment_status: payment_status || expense.payment_status,
    });

    return success(res, 200, "Expense updated successfully", expense);
  } catch (err) {
    console.error("Error updating expense:", err);
    return error(res, 500, "Failed to update expense", err.message);
  }
};

/**
 * Delete an expense (soft delete)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findOne({
      where: {
        id,
        is_archived: false,
      },
    });

    if (!expense) {
      return error(res, 404, "Expense not found");
    }

    await expense.update({ is_archived: true });

    return success(res, 200, "Expense deleted successfully");
  } catch (err) {
    console.error("Error deleting expense:", err);
    return error(res, 500, "Failed to delete expense", err.message);
  }
};

/**
 * Get expense summary grouped by category or month
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getExpenseSummary = async (req, res) => {
  try {
    const { group_by, from_date, to_date } = req.query;

    let whereClause = {
      is_archived: false,
    };

    if (from_date && to_date) {
      whereClause.bill_date = {
        [Op.between]: [from_date, to_date],
      };
    } else if (from_date) {
      whereClause.bill_date = {
        [Op.gte]: from_date,
      };
    } else if (to_date) {
      whereClause.bill_date = {
        [Op.lte]: to_date,
      };
    }

    let summary;

    if (group_by === 'category') {
      summary = await Expense.findAll({
        attributes: [
          [sequelize.fn('SUM', sequelize.col('total_cost')), 'total'],
        ],
        include: [
          {
            model: ExpenseCategory,
            as: 'category',
            attributes: ['id', 'name'],
            where: {
              is_archived: false,
            },
          },
        ],
        where: whereClause,
        group: ['category.id', 'category.name'],
        order: [[sequelize.fn('SUM', sequelize.col('total_cost')), 'DESC']],
      });
    } else if (group_by === 'month') {
      summary = await Expense.findAll({
        attributes: [
          [sequelize.fn('date_trunc', 'month', sequelize.col('bill_date')), 'month'],
          [sequelize.fn('SUM', sequelize.col('total_cost')), 'total'],
        ],
        where: whereClause,
        group: [sequelize.fn('date_trunc', 'month', sequelize.col('bill_date'))],
        order: [[sequelize.fn('date_trunc', 'month', sequelize.col('bill_date')), 'DESC']],
      });
    } else {
      // Default summary - total expenses
      summary = await Expense.findAll({
        attributes: [
          [sequelize.fn('SUM', sequelize.col('total_cost')), 'total'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        where: whereClause,
      });
    }

    return success(res, 200, "Expense summary retrieved successfully", summary);
  } catch (err) {
    console.error("Error retrieving expense summary:", err);
    return error(res, 500, "Failed to retrieve expense summary", err.message);
  }
};

module.exports = {
  createExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
};
