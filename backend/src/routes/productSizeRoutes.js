"use strict";

const express = require("express");
const router = express.Router();
const productSizeController = require("../controllers/productSizeController");

// Create a new product size
router.post("/", productSizeController.createProductSize);

// Get all product sizes
router.get("/", productSizeController.getAllProductSizes);

// Get a product size by ID
router.get("/:id", productSizeController.getProductSizeById);

// Update a product size
router.put("/:id", productSizeController.updateProductSize);

// Delete a product size (soft delete)
router.delete("/:id", productSizeController.deleteProductSize);

module.exports = router;
