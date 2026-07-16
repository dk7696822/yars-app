"use strict";

const express = require("express");
const router = express.Router();
const controller = require("../controllers/goodsReceiptController");

router.post("/", controller.createGoodsReceipt);
router.get("/", controller.getAllGoodsReceipts);
router.get("/:id", controller.getGoodsReceiptById);

module.exports = router;
