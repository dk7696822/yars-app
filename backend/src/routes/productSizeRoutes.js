"use strict";

const express = require("express");
const router = express.Router();
const productSizeController = require("../controllers/productSizeController");

router.post("/", productSizeController.createProductSize);
router.get("/", productSizeController.getAllProductSizes);
router.get("/:id", productSizeController.getProductSizeById);
router.put("/:id", productSizeController.updateProductSize);
router.delete("/:id", productSizeController.deleteProductSize);

module.exports = router;
