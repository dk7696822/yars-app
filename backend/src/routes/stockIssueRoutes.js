"use strict";

const express = require("express");
const router = express.Router();
const controller = require("../controllers/stockIssueController");

router.post("/", controller.createStockIssue);
router.get("/", controller.getAllStockIssues);
router.get("/:id", controller.getStockIssueById);

// No update route, and no delete route — a stock issue is an append-only
// document. stock_movements.reference_id points at issues polymorphically
// with no FK, so a hard delete would strand its ledger rows (same rule as
// goods receipts).

module.exports = router;
