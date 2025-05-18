"use strict";

const { PlateType } = require("../models");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");

/**
 * Create a new plate type
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const createPlateType = async (req, res) => {
  try {
    const { type_name, charge } = req.body;

    if (!type_name || charge === undefined) {
      return error(res, 400, "Plate type name and charge are required");
    }

    const plateType = await PlateType.create({
      type_name,
      charge: parseFloat(charge),
    });

    return success(res, 201, "Plate type created successfully", plateType);
  } catch (err) {
    console.error("Error creating plate type:", err);
    return error(res, 500, "Failed to create plate type", err.message);
  }
};

/**
 * Get all plate types
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getAllPlateTypes = async (req, res) => {
  try {
    const { name } = req.query;
    let whereClause = {
      is_archived: false,
    };

    if (name) {
      whereClause.type_name = {
        [Op.iLike]: `%${name}%`,
      };
    }

    const plateTypes = await PlateType.findAll({
      where: whereClause,
      order: [["type_name", "ASC"]],
    });

    return success(res, 200, "Plate types retrieved successfully", plateTypes);
  } catch (err) {
    console.error("Error retrieving plate types:", err);
    return error(res, 500, "Failed to retrieve plate types", err.message);
  }
};

/**
 * Get a plate type by ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getPlateTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    const plateType = await PlateType.findOne({
      where: {
        id,
        is_archived: false,
      },
    });

    if (!plateType) {
      return error(res, 404, "Plate type not found");
    }

    return success(res, 200, "Plate type retrieved successfully", plateType);
  } catch (err) {
    console.error("Error retrieving plate type:", err);
    return error(res, 500, "Failed to retrieve plate type", err.message);
  }
};

/**
 * Update a plate type
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const updatePlateType = async (req, res) => {
  try {
    const { id } = req.params;
    const { type_name, charge } = req.body;

    if (!type_name || charge === undefined) {
      return error(res, 400, "Plate type name and charge are required");
    }

    const plateType = await PlateType.findOne({
      where: {
        id,
        is_archived: false,
      },
    });

    if (!plateType) {
      return error(res, 404, "Plate type not found");
    }

    await plateType.update({
      type_name,
      charge: parseFloat(charge),
    });

    return success(res, 200, "Plate type updated successfully", plateType);
  } catch (err) {
    console.error("Error updating plate type:", err);
    return error(res, 500, "Failed to update plate type", err.message);
  }
};

/**
 * Delete a plate type (soft delete)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const deletePlateType = async (req, res) => {
  try {
    const { id } = req.params;

    const plateType = await PlateType.findOne({
      where: {
        id,
        is_archived: false,
      },
    });

    if (!plateType) {
      return error(res, 404, "Plate type not found");
    }

    await plateType.update({ is_archived: true });

    return success(res, 200, "Plate type deleted successfully");
  } catch (err) {
    console.error("Error deleting plate type:", err);
    return error(res, 500, "Failed to delete plate type", err.message);
  }
};

module.exports = {
  createPlateType,
  getAllPlateTypes,
  getPlateTypeById,
  updatePlateType,
  deletePlateType,
};
