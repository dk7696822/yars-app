"use strict";

const models = require("../models");
const { Customer } = models;
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");
const { loadOrders } = require("../services/dashboard/ledger");
const { todayIST } = require("../services/dashboard/dateRanges");
const { buildDirectory, buildCustomerSummary, customerStats } = require("../services/lists/customerDirectory");
const { ListError } = require("../services/lists/orderList");
const { findSimilar } = require("../services/customerSimilar");
const { readCustomerBody, CustomerFieldError } = require("../services/customerFields");
const { httpRoute } = require("../commands/httpRoute");
const createCustomerCommand = require("../commands/customers/createCustomer");

const liveCustomers = async () =>
  (await Customer.findAll({ where: { is_archived: false }, attributes: ["id", "name", "metadata", "created_at"] })).map((c) => c.toJSON());

/**
 * Create a new customer
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
/** Add a customer (POST /customers) — the save is the customers.create command. */
const createCustomer = httpRoute(createCustomerCommand, {
  respond: async ({ id }) => ({ status: 201, message: "Customer created successfully", data: await Customer.findByPk(id) }),
  failMessage: "Failed to create customer",
});

/**
 * Get all customers
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getAllCustomers = async (req, res) => {
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

    const customers = await Customer.findAll({
      where: whereClause,
      order: [["name", "ASC"]],
    });

    return success(res, 200, "Customers retrieved successfully", customers);
  } catch (err) {
    console.error("Error retrieving customers:", err);
    return error(res, 500, "Failed to retrieve customers", err.message);
  }
};

/** Customers screen: A–Z (or owing / recent), with dues from orderFacts. */
const getDirectory = async (req, res) => {
  try {
    const [customers, orders] = await Promise.all([liveCustomers(), loadOrders(models)]);
    return success(res, 200, "Customer directory", buildDirectory(customers, orders, req.query, todayIST()));
  } catch (err) {
    if (err instanceof ListError) return error(res, 400, err.message);
    console.error("Error loading customer directory:", err);
    return error(res, 500, "Failed to load customers", err.message);
  }
};

/** Customer page: matched by customer_id — never by name. */
const getCustomerSummary = async (req, res) => {
  try {
    const customer = await Customer.findOne({ where: { id: req.params.id, is_archived: false } });
    if (!customer) return error(res, 404, "Customer not found");
    const orders = await loadOrders(models, { is_archived: false, customer_id: customer.id });
    return success(res, 200, "Customer summary", buildCustomerSummary(customer.toJSON(), orders, todayIST()));
  } catch (err) {
    console.error("Error loading customer summary:", err);
    return error(res, 500, "Failed to load customer", err.message);
  }
};

/** "Already a customer?" suggestions while typing a name. */
const getSimilar = async (req, res) => {
  try {
    const matches = findSimilar(String(req.query.name || ""), await liveCustomers(), req.query.excludeId);
    if (!matches.length) return success(res, 200, "Similar customers", []);
    const orders = await loadOrders(models, { is_archived: false, customer_id: { [Op.in]: matches.map((c) => c.id) } });
    const stats = customerStats(orders, todayIST());
    return success(res, 200, "Similar customers", matches.map((c) => ({
      id: c.id, name: c.name, phone: c.metadata?.phone || null, due: (stats.get(c.id)?.duePaise || 0) / 100,
    })));
  } catch (err) {
    console.error("Error finding similar customers:", err);
    return error(res, 500, "Failed to check customer names", err.message);
  }
};

/**
 * Get a customer by ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findOne({
      where: {
        id,
        is_archived: false,
      },
    });

    if (!customer) {
      return error(res, 404, "Customer not found");
    }

    return success(res, 200, "Customer retrieved successfully", customer);
  } catch (err) {
    console.error("Error retrieving customer:", err);
    return error(res, 500, "Failed to retrieve customer", err.message);
  }
};

/**
 * Update a customer
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const updateCustomer = async (req, res) => {
  try {
    const { name, patch, remove } = readCustomerBody(req.body);
    const customer = await Customer.findOne({ where: { id: req.params.id, is_archived: false } });
    if (!customer) return error(res, 404, "Customer not found");
    const metadata = { ...(customer.metadata || {}), ...patch };
    for (const key of remove) delete metadata[key];
    await customer.update({ name, metadata });
    return success(res, 200, "Customer updated successfully", customer);
  } catch (err) {
    if (err instanceof CustomerFieldError) return error(res, 400, err.message);
    console.error("Error updating customer:", err);
    return error(res, 500, "Failed to update customer", err.message);
  }
};

/**
 * Delete a customer (soft delete)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findOne({
      where: {
        id,
        is_archived: false,
      },
    });

    if (!customer) {
      return error(res, 404, "Customer not found");
    }

    await customer.update({ is_archived: true });

    return success(res, 200, "Customer deleted successfully");
  } catch (err) {
    console.error("Error deleting customer:", err);
    return error(res, 500, "Failed to delete customer", err.message);
  }
};

module.exports = { createCustomer, getAllCustomers, getDirectory, getSimilar, getCustomerSummary, getCustomerById, updateCustomer, deleteCustomer };
