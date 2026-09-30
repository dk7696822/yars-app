"use strict";

const { ProductSize, OrderProductSize, sequelize } = require("../models");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");
const { isBlank, parsePair } = require("../services/pieceFields");

/**
 * Validate the pricing fields shared by create and update.
 * Returns { fields } ready for the model, or { error }.
 */
const parsePricing = (body) => {
  const rate = isBlank(body.rate_per_kg) ? null : Number(body.rate_per_kg);
  if (rate !== null && (!Number.isFinite(rate) || rate < 0)) return { error: "Rate per kg must be 0 or more" };
  const price = parsePair(body.piece_price_amount, body.piece_price_count, "Piece price", { positive: false });
  if (price.error) return { error: price.error };
  const weight = parsePair(body.weight_kg, body.weight_pieces_count, "Weight", { positive: true });
  if (weight.error) return { error: weight.error };
  if (rate === null && !price.value) return { error: "Enter a rate per kg or a piece price (or both)" };
  return {
    fields: {
      rate_per_kg: rate,
      piece_price_amount: price.value ? price.value.amount : null,
      piece_price_count: price.value ? price.value.count : null,
      weight_kg: weight.value ? weight.value.amount : null,
      weight_pieces_count: weight.value ? weight.value.count : null,
    },
  };
};

/**
 * Create a new product size
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const createProductSize = async (req, res) => {
  try {
    const { size_label } = req.body;
    if (!size_label) {
      return error(res, 400, "Size label is required");
    }
    const pricing = parsePricing(req.body);
    if (pricing.error) {
      return error(res, 400, pricing.error);
    }

    const productSize = await ProductSize.create({ size_label, ...pricing.fields });

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
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { size_label } = req.body;

    if (!size_label) {
      await transaction.rollback();
      return error(res, 400, "Size label is required");
    }
    const pricing = parsePricing(req.body);
    if (pricing.error) {
      await transaction.rollback();
      return error(res, 400, pricing.error);
    }

    const productSize = await ProductSize.findOne({ where: { id, is_archived: false }, transaction });
    if (!productSize) {
      await transaction.rollback();
      return error(res, 404, "Product size not found");
    }

    await productSize.update({ size_label, ...pricing.fields }, { transaction });

    // Back-fill (spec §3): pieces lines of this size that have NO weight pick
    // up the new weight once. Lines with any weight — copied earlier or
    // measured — are never overwritten. Money columns are never touched.
    let backfilled = 0;
    if (pricing.fields.weight_kg !== null) {
      [backfilled] = await OrderProductSize.update(
        { weight_kg: pricing.fields.weight_kg, weight_pieces_count: pricing.fields.weight_pieces_count, weight_source: "SIZE" },
        { where: { product_size_id: id, unit: "PIECES", weight_kg: null }, transaction }
      );
    }

    await transaction.commit();
    return success(res, 200, "Product size updated successfully", { ...productSize.toJSON(), backfilled_lines: backfilled });
  } catch (err) {
    await transaction.rollback();
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
