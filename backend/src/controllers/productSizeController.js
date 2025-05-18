"use strict";

const { ProductSize } = require("../models");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");

/**
 * Create a new product size
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const createProductSize = async (req, res) => {
  try {
    const { size_label, rate_per_kg } = req.body;

    if (!size_label || rate_per_kg === undefined) {
      return error(res, 400, "Size label and rate per kg are required");
    }

    const productSize = await ProductSize.create({
      size_label,
      rate_per_kg: parseFloat(rate_per_kg),
    });

    return success(res, 201, "Product size created successfully", productSize);
  } catch (err) {
    console.error("Error creating product size:", err);
    return error(res, 500, "Failed to create product size", err.message);
  }
};

/**
 * Get all product sizes
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getAllProductSizes = async (req, res) => {
  try {
    const { label } = req.query;
    let whereClause = {
      is_archived: false,
    };

    if (label) {
      whereClause.size_label = {
        [Op.iLike]: `%${label}%`,
      };
    }

    const productSizes = await ProductSize.findAll({
      where: whereClause,
      order: [["size_label", "ASC"]],
    });

    return success(res, 200, "Product sizes retrieved successfully", productSizes);
  } catch (err) {
    console.error("Error retrieving product sizes:", err);
    return error(res, 500, "Failed to retrieve product sizes", err.message);
  }
};

/**
 * Get a product size by ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getProductSizeById = async (req, res) => {
  try {
    const { id } = req.params;

    const productSize = await ProductSize.findOne({
      where: {
        id,
        is_archived: false,
      },
    });

    if (!productSize) {
      return error(res, 404, "Product size not found");
    }

    return success(res, 200, "Product size retrieved successfully", productSize);
  } catch (err) {
    console.error("Error retrieving product size:", err);
    return error(res, 500, "Failed to retrieve product size", err.message);
  }
};

/**
 * Update a product size
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const updateProductSize = async (req, res) => {
  try {
    const { id } = req.params;
    const { size_label, rate_per_kg } = req.body;

    if (!size_label || rate_per_kg === undefined) {
      return error(res, 400, "Size label and rate per kg are required");
    }

    const productSize = await ProductSize.findOne({
      where: {
        id,
        is_archived: false,
      },
    });

    if (!productSize) {
      return error(res, 404, "Product size not found");
    }

    await productSize.update({
      size_label,
      rate_per_kg: parseFloat(rate_per_kg),
    });

    return success(res, 200, "Product size updated successfully", productSize);
  } catch (err) {
    console.error("Error updating product size:", err);
    return error(res, 500, "Failed to update product size", err.message);
  }
};

/**
 * Delete a product size (soft delete)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const deleteProductSize = async (req, res) => {
  try {
    const { id } = req.params;

    const productSize = await ProductSize.findOne({
      where: {
        id,
        is_archived: false,
      },
    });

    if (!productSize) {
      return error(res, 404, "Product size not found");
    }

    await productSize.update({ is_archived: true });

    return success(res, 200, "Product size deleted successfully");
  } catch (err) {
    console.error("Error deleting product size:", err);
    return error(res, 500, "Failed to delete product size", err.message);
  }
};

module.exports = {
  createProductSize,
  getAllProductSizes,
  getProductSizeById,
  updateProductSize,
  deleteProductSize,
};
