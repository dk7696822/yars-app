"use strict";

const express = require("express");
const router = express.Router();
const controller = require("../controllers/purchaseOrderController");

router.post("/", controller.createPurchaseOrder);
router.get("/", controller.getAllPurchaseOrders);
router.get("/:id", controller.getPurchaseOrderById);
router.put("/:id", controller.updatePurchaseOrder);
router.delete("/:id", controller.deletePurchaseOrder);
router.post("/:id/cancel", controller.cancelPurchaseOrder);
router.post("/:id/receive", controller.receivePurchaseOrder);

module.exports = router;
