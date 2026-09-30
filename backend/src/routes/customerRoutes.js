"use strict";

const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");

// Create a new customer
router.post("/", customerController.createCustomer);

// Get all customers
router.get("/", customerController.getAllCustomers);

// Screens (must come before "/:id")
router.get("/directory", customerController.getDirectory);
router.get("/similar", customerController.getSimilar);
router.get("/:id/summary", customerController.getCustomerSummary);

// Get a customer by ID
router.get("/:id", customerController.getCustomerById);

// Update a customer
router.put("/:id", customerController.updateCustomer);

// Delete a customer (soft delete)
router.delete("/:id", customerController.deleteCustomer);

module.exports = router;
