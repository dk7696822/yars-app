"use strict";

const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

// Create a new payment
router.post("/", paymentController.createPayment);

// Get all payments with optional filters
router.get("/", paymentController.getAllPayments);

// Get payment by ID
router.get("/:id", paymentController.getPaymentById);

// Update payment
router.put("/:id", paymentController.updatePayment);

// Delete payment
router.delete("/:id", paymentController.deletePayment);

module.exports = router;
