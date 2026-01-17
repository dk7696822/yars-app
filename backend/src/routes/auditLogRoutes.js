"use strict";

const express = require("express");
const router = express.Router();
const auditLogController = require("../controllers/auditLogController");

// Get all audit logs with filtering and pagination
router.get("/", auditLogController.getAllAuditLogs);

// Get specific audit log by ID
router.get("/:id", auditLogController.getAuditLogById);

// Get history for a specific entity
router.get("/entity/:entityType/:entityId", auditLogController.getEntityHistory);

module.exports = router;
