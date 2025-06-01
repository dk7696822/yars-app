"use strict";

const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceController");

router.post("/generate", invoiceController.generateInvoice);
router.get("/", invoiceController.getAllInvoices);
router.get("/:id", invoiceController.getInvoiceById);
router.get("/:id/pdf", invoiceController.generatePDF);
router.patch("/:id/status", invoiceController.updateInvoiceStatus);
router.delete("/:id", invoiceController.deleteInvoice);

module.exports = router;
