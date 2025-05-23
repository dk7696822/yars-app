"use strict";

const { Customer } = require("../models");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");

/**
 * Create a new customer
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const createCustomer = async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;

    if (!name) {
      return error(res, 400, "Customer name is required");
    }

    // Create metadata object with optional fields
    const metadata = {};
    if (email) metadata.email = email;
    if (phone) metadata.phone = phone;
    if (address) metadata.address = address;

    const customer = await Customer.create({
      name,
      metadata,
    });

    return success(res, 201, "Customer created successfully", customer);
  } catch (err) {
    console.error("Error creating customer:", err);
    return error(res, 500, "Failed to create customer", err.message);
  }
};

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
    const { id } = req.params;
    const { name, email, phone, address } = req.body;

    if (!name) {
      return error(res, 400, "Customer name is required");
    }

    const customer = await Customer.findOne({
      where: {
        id,
        is_archived: false,
      },
    });

    if (!customer) {
      return error(res, 404, "Customer not found");
    }

    // Get current metadata or initialize empty object
    const currentMetadata = customer.metadata || {};

    // Update metadata with new values or keep existing ones
    const updatedMetadata = {
      ...currentMetadata,
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
    };

    // Remove properties that are explicitly set to null or empty string
    if (email === null || email === "") delete updatedMetadata.email;
    if (phone === null || phone === "") delete updatedMetadata.phone;
    if (address === null || address === "") delete updatedMetadata.address;

    await customer.update({
      name,
      metadata: updatedMetadata,
    });

    return success(res, 200, "Customer updated successfully", customer);
  } catch (err) {
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

module.exports = {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
};
