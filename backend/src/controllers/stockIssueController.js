"use strict";

const { StockIssue, StockIssueItem, InventoryItem, Order, Customer } = require("../models");
const { success, error } = require("../utils/response");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
const stockService = require("../services/stockService");
const { Op } = require("sequelize");

const ISSUE_TYPES = ["ISSUE", "WASTAGE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"];

/** DATEONLY columns expect "YYYY-MM-DD"; reject anything else up front instead of 500ing. */
const isDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value));

const ISSUE_INCLUDES = [
  {
    model: StockIssueItem,
    as: "items",
    include: [{ model: InventoryItem, as: "item", attributes: ["id", "name", "unit"] }],
  },
  {
    model: Order,
    as: "order",
    attributes: ["id", "order_date"],
    include: [{ model: Customer, as: "customer", attributes: ["id", "name"] }],
    required: false,
  },
];

/**
 * Create an issue, wastage write-off, or adjustment.
 * Routes to the right stockService entry point based on issue_type — adjustments
 * go through adjustStock so the mandatory-reason rule cannot be bypassed.
 * Availability itself is checked inside stockService, under the row locks.
 */
const createStockIssue = async (req, res) => {
  try {
    const { issue_date, issue_type = "ISSUE", order_id, reason, notes, items } = req.body;

    if (!issue_date) {
      return error(res, 400, "Issue date is required");
    }

    if (!isDateString(issue_date)) {
      return error(res, 400, "Issue date must be a YYYY-MM-DD date");
    }

    if (!ISSUE_TYPES.includes(issue_type)) {
      return error(res, 400, `Issue type must be one of: ${ISSUE_TYPES.join(", ")}`);
    }

    if (!Array.isArray(items) || items.length === 0) {
      return error(res, 400, "At least one item is required");
    }

    const isAdjustment = ["ADJUSTMENT_IN", "ADJUSTMENT_OUT"].includes(issue_type);

    if (isAdjustment && (!reason || !reason.trim())) {
      return error(res, 400, "A reason is required for a stock adjustment");
    }

    const issue = isAdjustment
      ? await stockService.adjustStock({ issue_date, issue_type, reason, notes, items })
      : await stockService.issueStock({
          issue_date,
          issue_type,
          order_id: order_id || null,
          notes,
          items,
        });

    const created = await StockIssue.findByPk(issue.id, { include: ISSUE_INCLUDES });

    return success(res, 201, "Stock issue recorded successfully", created);
  } catch (err) {
    // Insufficient stock is a user error, not a server error. Say so clearly —
    // this is the message the factory user will actually see on their phone.
    if (err instanceof stockService.InsufficientStockError) {
      return error(res, 400, err.message);
    }
    if (err instanceof stockService.StockReconciliationError) {
      console.error("Stock reconciliation failure while recording stock issue:", err);
      return error(res, 500, err.message);
    }
    if (err.name === "SequelizeUniqueConstraintError") {
      return error(res, 400, "Issue number collision — please try again");
    }

    console.error("Error creating stock issue:", err);
    return error(res, 500, "Failed to record stock issue", err.message);
  }
};

const getAllStockIssues = async (req, res) => {
  try {
    const { search, issue_type, order_id, from_date, to_date } = req.query;
    const whereClause = { is_archived: false };

    if (issue_type) {
      if (!ISSUE_TYPES.includes(issue_type)) {
        return error(res, 400, `Issue type must be one of: ${ISSUE_TYPES.join(", ")}`);
      }
      whereClause.issue_type = issue_type;
    }
    if (order_id) whereClause.order_id = order_id;

    if (from_date && to_date) {
      whereClause.issue_date = { [Op.between]: [from_date, to_date] };
    } else if (from_date) {
      whereClause.issue_date = { [Op.gte]: from_date };
    } else if (to_date) {
      whereClause.issue_date = { [Op.lte]: to_date };
    }

    if (search) {
      whereClause.issue_number = { [Op.iLike]: `%${search}%` };
    }

    const pagination = getPagination(req.query);

    const { rows, count } = await StockIssue.findAndCountAll({
      where: whereClause,
      include: ISSUE_INCLUDES,
      order: [["issue_date", "DESC"], ["created_at", "DESC"]],
      limit: pagination.limit,
      offset: pagination.offset,
      distinct: true, // without this, the include inflates `count`
    });

    // Attach document totals for the list view. DECIMALs arrive as strings.
    const data = rows.map((issue) => {
      const plain = issue.toJSON();
      plain.total_cost = plain.items.reduce((sum, line) => sum + parseFloat(line.total_cost), 0);
      plain.total_wastage_cost = plain.items.reduce(
        (sum, line) => sum + parseFloat(line.wastage_cost || 0),
        0
      );
      return plain;
    });

    return success(
      res,
      200,
      "Stock issues retrieved successfully",
      buildPaginatedResponse(data, count, pagination)
    );
  } catch (err) {
    console.error("Error retrieving stock issues:", err);
    return error(res, 500, "Failed to retrieve stock issues", err.message);
  }
};

const getStockIssueById = async (req, res) => {
  try {
    const issue = await StockIssue.findOne({
      where: { id: req.params.id, is_archived: false },
      include: ISSUE_INCLUDES,
    });

    if (!issue) {
      return error(res, 404, "Stock issue not found");
    }

    return success(res, 200, "Stock issue retrieved successfully", issue);
  } catch (err) {
    console.error("Error retrieving stock issue:", err);
    return error(res, 500, "Failed to retrieve stock issue", err.message);
  }
};

module.exports = {
  createStockIssue,
  getAllStockIssues,
  getStockIssueById,
};
