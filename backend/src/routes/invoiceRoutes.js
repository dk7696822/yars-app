"use strict";

const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceController");

// Generate a new invoice
router.post("/generate", invoiceController.generateInvoice);

// Get all invoices
router.get("/", invoiceController.getAllInvoices);

// Get an invoice by ID
router.get("/:id", invoiceController.getInvoiceById);

// Generate PDF for an invoice
router.get("/:id/pdf", invoiceController.generatePDF);

// Update invoice status
router.patch("/:id/status", invoiceController.updateInvoiceStatus);

// Delete an invoice (soft delete)
router.delete("/:id", invoiceController.deleteInvoice);

module.exports = router;
