"use strict";

const express = require("express");
const router = express.Router();
const controller = require("../controllers/inventoryCategoryController");

router.post("/", controller.createInventoryCategory);
router.get("/", controller.getAllInventoryCategories);
router.get("/:id", controller.getInventoryCategoryById);
router.put("/:id", controller.updateInventoryCategory);
router.delete("/:id", controller.deleteInventoryCategory);

module.exports = router;
