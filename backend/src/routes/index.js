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

// API routes
router.use("/customers", customerRoutes);
router.use("/product-sizes", productSizeRoutes);
router.use("/plate-types", plateTypeRoutes);
router.use("/orders", orderRoutes);
router.use("/expense-categories", expenseCategoryRoutes);
router.use("/expenses", expenseRoutes);
router.use("/invoices", invoiceRoutes);
router.use("/payments", paymentRoutes);

// Health check route
router.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "API is running" });
});

module.exports = router;
