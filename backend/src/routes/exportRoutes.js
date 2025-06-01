"use strict";

const express = require("express");
const router = express.Router();
const exportController = require("../controllers/exportController");

// Export dashboard data to Excel
router.get("/dashboard", exportController.exportDashboardData);

// Export expenses data to Excel
router.get("/expenses", exportController.exportExpensesData);

module.exports = router;
