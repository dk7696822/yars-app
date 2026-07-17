"use strict";

const express = require("express");
const router = express.Router();
const controller = require("../controllers/stockController");

// Order matters: /summary must be declared before /:itemId, or Express
// will treat "summary" as an item id.
router.get("/summary", controller.getStockSummary);
router.get("/", controller.getStock);
router.get("/:itemId", controller.getItemStock);
router.get("/:itemId/movements", controller.getItemMovements);

module.exports = router;
