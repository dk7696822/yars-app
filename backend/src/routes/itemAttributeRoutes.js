"use strict";

const express = require("express");
const router = express.Router();
const controller = require("../controllers/itemAttributeController");

// Value routes first, for readability — they cannot actually collide with
// /:id (two path segments vs one), but keep the specific ones on top.
router.put("/values/:valueId", controller.updateItemAttributeValue);
router.delete("/values/:valueId", controller.deleteItemAttributeValue);
router.post("/:id/values", controller.createItemAttributeValue);

router.post("/", controller.createItemAttribute);
router.get("/", controller.getAllItemAttributes);
router.put("/:id", controller.updateItemAttribute);
router.delete("/:id", controller.deleteItemAttribute);

module.exports = router;
