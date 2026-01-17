"use strict";

const express = require("express");
const router = express.Router();

const customerRoutes = require("./customerRoutes");
const productSizeRoutes = require("./productSizeRoutes");
const plateTypeRoutes = require("./plateTypeRoutes");
const orderRoutes = require("./orderRoutes");
const expenseCategoryRoutes = require("./expenseCategoryRoutes");
const expenseRoutes = require("./expenseRoutes");
const invoiceRoutes = require("./invoiceRoutes");
const paymentRoutes = require("./paymentRoutes");
const exportRoutes = require("./exportRoutes");
const auditLogRoutes = require("./auditLogRoutes");

router.use("/customers", customerRoutes);
router.use("/product-sizes", productSizeRoutes);
router.use("/plate-types", plateTypeRoutes);
router.use("/orders", orderRoutes);
router.use("/expense-categories", expenseCategoryRoutes);
router.use("/expenses", expenseRoutes);
router.use("/invoices", invoiceRoutes);
router.use("/payments", paymentRoutes);
router.use("/export", exportRoutes);
router.use("/audit-logs", auditLogRoutes);
router.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "API is running" });
});

module.exports = router;
