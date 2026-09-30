"use strict";

const { AuditLog } = require("../models");
const { success, error } = require("../utils/response");
const { auditWhere, AuditFilterError } = require("../services/auditFilters");

/**
 * Get all audit logs with filtering and pagination
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getAllAuditLogs = async (req, res) => {
  try {
    const { entity_type, action, from_date, to_date, page = 1, limit = 20, entity_id } = req.query;

    let where;
    try {
      where = auditWhere({ entity_type, action, from_date, to_date, entity_id });
    } catch (err) {
      if (err instanceof AuditFilterError) return error(res, 400, err.message);
      throw err;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset,
    });

    return success(res, 200, "Audit logs retrieved successfully", {
      logs: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Error retrieving audit logs:", err);
    return error(res, 500, "Failed to retrieve audit logs", err.message);
  }
};

/**
 * Get audit log by ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getAuditLogById = async (req, res) => {
  try {
    const { id } = req.params;

    const auditLog = await AuditLog.findByPk(id);

    if (!auditLog) {
      return error(res, 404, "Audit log not found");
    }

    return success(res, 200, "Audit log retrieved successfully", auditLog);
  } catch (err) {
    console.error("Error retrieving audit log:", err);
    return error(res, 500, "Failed to retrieve audit log", err.message);
  }
};

/**
 * Get audit history for a specific entity
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getEntityHistory = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    const logs = await AuditLog.findAll({
      where: {
        entity_type: entityType.toUpperCase(),
        entity_id: entityId,
      },
      order: [["created_at", "DESC"]],
    });

    return success(res, 200, "Entity history retrieved successfully", logs);
  } catch (err) {
    console.error("Error retrieving entity history:", err);
    return error(res, 500, "Failed to retrieve entity history", err.message);
  }
};

module.exports = {
  getAllAuditLogs,
  getAuditLogById,
  getEntityHistory,
};
