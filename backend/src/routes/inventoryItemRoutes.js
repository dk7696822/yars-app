"use strict";

const express = require("express");
const router = express.Router();
const controller = require("../controllers/inventoryItemController");

router.post("/", controller.createInventoryItem);
router.get("/", controller.getAllInventoryItems);
router.get("/:id", controller.getInventoryItemById);
router.put("/:id", controller.updateInventoryItem);
router.delete("/:id", controller.deleteInventoryItem);

module.exports = router;
