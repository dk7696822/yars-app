"use strict";

const express = require("express");
const router = express.Router();
const exportController = require("../controllers/exportController");

router.get("/dashboard", exportController.exportDashboardData);
router.get("/expenses", exportController.exportExpensesData);
router.get("/inventory", exportController.exportInventoryData);

module.exports = router;
