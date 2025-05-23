"use strict";

const { Invoice, InvoiceItem, Customer, Order, OrderProductSize, ProductSize, PlateType, Payment, sequelize } = require("../models");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

/**
 * Generate a new invoice for a customer
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const generateInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { customer_id, order_ids, billing_period_start, billing_period_end, payment_due_date, tax_percent = 0 } = req.body;

    // Validate required fields
    if (!customer_id || !order_ids || !order_ids.length) {
      await transaction.rollback();
      return error(res, 400, "Missing required fields");
    }

    // Check if customer exists
    const customer = await Customer.findOne({
      where: {
        id: customer_id,
        is_archived: false,
      },
    });

    if (!customer) {
      await transaction.rollback();
      return error(res, 404, "Customer not found");
    }

    // Fetch orders
    const orders = await Order.findAll({
      where: {
        id: {
          [Op.in]: order_ids,
        },
        customer_id,
        invoice_id: null,
        is_archived: false,
      },
      include: [
        { model: Customer, as: "customer" },
        { model: PlateType, as: "plateType" },
        {
          model: OrderProductSize,
          as: "orderProductSizes",
          include: [{ model: ProductSize, as: "productSize" }],
        },
      ],
    });

    if (orders.length === 0) {
      await transaction.rollback();
      return error(res, 404, "No eligible orders found for invoicing");
    }

    // Calculate total amount (without subtracting advance)
    let totalAmount = 0;
    let totalAdvanceReceived = 0;

    for (const order of orders) {
      // Calculate product amount
      let productAmount = 0;
      for (const item of order.orderProductSizes) {
        const itemTotal = parseFloat(item.quantity_kg) * parseFloat(item.rate_per_kg);
        productAmount += itemTotal;
      }

      // Add plate charge
      const plateCharge = parseFloat(order.plateType.charge);

      // Track advance separately (don't subtract it from the total amount)
      const advanceReceived = parseFloat(order.advance_received);
      totalAdvanceReceived += advanceReceived;

      // Calculate total for this order (without subtracting advance)
      const orderTotal = productAmount + plateCharge;
      totalAmount += orderTotal;
    }

    // Calculate tax amount
    const taxAmount = (totalAmount * parseFloat(tax_percent)) / 100;
    const finalAmount = totalAmount + taxAmount;

    // Note: totalAmount is the full order amount without subtracting advance
    // finalAmount is totalAmount + tax
    // The actual amount due is finalAmount - totalAdvanceReceived - any additional payments

    // Create a date object for today
    const today = new Date();

    // Generate sequential invoice number with leading zeros (format: 00000001, 00000002, etc.)
    // Find all invoices and filter for numeric invoice numbers
    const allInvoices = await Invoice.findAll({
      attributes: ["invoice_number"],
      transaction,
    });

    let nextInvoiceNumber = 1; // Start with 1 if no invoices exist

    // Filter for numeric invoice numbers and find the highest
    const numericInvoices = allInvoices
      .map((inv) => inv.invoice_number)
      .filter((num) => /^\d+$/.test(num))
      .map((num) => parseInt(num, 10))
      .filter((num) => !isNaN(num));

    if (numericInvoices.length > 0) {
      // Find the highest invoice number and increment it
      const highestNumber = Math.max(...numericInvoices);
      nextInvoiceNumber = highestNumber + 1;
    }

    // Format with leading zeros to maintain a fixed length of 8 digits
    // This ensures invoice numbers like 00000001, 00000010, 00000100, etc.
    const invoiceNumber = nextInvoiceNumber.toString().padStart(8, "0");

    // Create invoice
    const invoice = await Invoice.create(
      {
        customer_id,
        invoice_number: invoiceNumber,
        invoice_date: today,
        billing_period_start: billing_period_start || orders[0].order_date,
        billing_period_end: billing_period_end || today,
        payment_due_date:
          payment_due_date ||
          (() => {
            // Create a new date object to avoid modifying the original today variable
            const dueDate = new Date(today);
            dueDate.setDate(dueDate.getDate() + 30);
            return dueDate;
          })(),
        total_amount: totalAmount,
        tax_percent: tax_percent || 0,
        tax_amount: taxAmount,
        final_amount: finalAmount,
        status: "PENDING",
      },
      { transaction }
    );

    // Create invoice items and update orders
    for (const order of orders) {
      // Update order with invoice_id
      await order.update({ invoice_id: invoice.id }, { transaction });

      // Create invoice items for each product size
      for (const item of order.orderProductSizes) {
        const productSize = item.productSize;
        const description = `${productSize.size_label} (${order.order_date})`;
        const quantity = parseFloat(item.quantity_kg);
        const unitPrice = parseFloat(item.rate_per_kg);
        const totalPrice = quantity * unitPrice;

        await InvoiceItem.create(
          {
            invoice_id: invoice.id,
            order_id: order.id,
            description,
            quantity,
            unit_price: unitPrice,
            total_price: totalPrice,
          },
          { transaction }
        );
      }

      // Add plate charge as an invoice item
      await InvoiceItem.create(
        {
          invoice_id: invoice.id,
          order_id: order.id,
          description: `Plate Charge: ${order.plateType.type_name} (${order.order_date})`,
          quantity: 1,
          unit_price: parseFloat(order.plateType.charge),
          total_price: parseFloat(order.plateType.charge),
        },
        { transaction }
      );

      // Add advance payment as a negative invoice item if there was an advance
      if (parseFloat(order.advance_received) > 0) {
        await InvoiceItem.create(
          {
            invoice_id: invoice.id,
            order_id: order.id,
            description: `Advance Payment (${order.order_date})`,
            quantity: 1,
            unit_price: -parseFloat(order.advance_received),
            total_price: -parseFloat(order.advance_received),
          },
          { transaction }
        );
      }
    }

    // Find all existing payments for these orders and associate them with the new invoice
    const orderIds = orders.map((order) => order.id);

    // Find payments that are associated with these orders but don't have an invoice_id
    // (either they never had one, or they were orphaned when a previous invoice was deleted)
    const existingPayments = await Payment.findAll({
      where: {
        order_id: { [Op.in]: orderIds },
        invoice_id: null,
        // Remove is_archived check since the column doesn't exist in payments table
      },
      transaction,
    });

    // Update these payments to associate them with the new invoice
    for (const payment of existingPayments) {
      await payment.update({ invoice_id: invoice.id }, { transaction });
    }

    await transaction.commit();

    // Fetch the complete invoice with associations
    const createdInvoice = await Invoice.findByPk(invoice.id, {
      include: [
        { model: Customer, as: "customer" },
        { model: InvoiceItem, as: "invoiceItems" },
        {
          model: Order,
          as: "orders",
          include: [
            { model: PlateType, as: "plateType" },
            {
              model: OrderProductSize,
              as: "orderProductSizes",
              include: [{ model: ProductSize, as: "productSize" }],
            },
          ],
        },
      ],
    });

    return success(res, 201, "Invoice generated successfully", createdInvoice);
  } catch (err) {
    await transaction.rollback();
    console.error("Error generating invoice:", err);
    return error(res, 500, "Failed to generate invoice", err.message);
  }
};

/**
 * Get all invoices
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getAllInvoices = async (req, res) => {
  try {
    const { customer_id, status, dateFrom, dateTo, search } = req.query;

    // Build where clause
    let whereClause = {
      is_archived: false,
    };

    if (customer_id) {
      whereClause.customer_id = customer_id;
    }

    if (status) {
      whereClause.status = status;
    }

    // Date range filtering
    if (dateFrom || dateTo) {
      whereClause.invoice_date = {};
      if (dateFrom) {
        whereClause.invoice_date[Op.gte] = dateFrom;
      }
      if (dateTo) {
        whereClause.invoice_date[Op.lte] = dateTo;
      }
    }

    // Build the include array with customer filtering if needed
    const includeArray = [
      {
        model: Customer,
        as: "customer",
        where: {
          is_archived: false,
          ...(search && {
            name: {
              [Op.iLike]: `%${search}%`,
            },
          }),
        },
      },
      {
        model: InvoiceItem,
        as: "invoiceItems",
      },
      {
        model: Payment,
        as: "payments",
        required: false,
      },
    ];

    const invoices = await Invoice.findAll({
      where: whereClause,
      include: includeArray,
      order: [["invoice_date", "DESC"]],
    });

    // Add payment summary to each invoice
    const invoicesWithPaymentInfo = invoices.map((invoice) => {
      const invoiceData = invoice.toJSON();

      // Calculate total paid amount
      const totalPaid = invoice.payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

      // Calculate remaining balance
      const remainingBalance = parseFloat(invoice.final_amount) - totalPaid;

      return {
        ...invoiceData,
        payment_summary: {
          total_paid: totalPaid,
          remaining_balance: remainingBalance,
          is_fully_paid: totalPaid >= parseFloat(invoice.final_amount),
        },
      };
    });

    return success(res, 200, "Invoices retrieved successfully", invoicesWithPaymentInfo);
  } catch (err) {
    console.error("Error retrieving invoices:", err);
    return error(res, 500, "Failed to retrieve invoices", err.message);
  }
};

/**
 * Get an invoice by ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findOne({
      where: {
        id,
        is_archived: false,
      },
      include: [
        { model: Customer, as: "customer" },
        { model: InvoiceItem, as: "invoiceItems" },
        {
          model: Order,
          as: "orders",
          include: [
            { model: PlateType, as: "plateType" },
            {
              model: OrderProductSize,
              as: "orderProductSizes",
              include: [{ model: ProductSize, as: "productSize" }],
            },
          ],
        },
        {
          model: Payment,
          as: "payments",
          order: [["payment_date", "DESC"]],
        },
      ],
    });

    if (!invoice) {
      return error(res, 404, "Invoice not found");
    }

    // Calculate total paid amount
    const totalPaid = invoice.payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

    // Calculate remaining balance
    const remainingBalance = parseFloat(invoice.final_amount) - totalPaid;

    // Add payment summary to the response
    const invoiceWithPaymentInfo = {
      ...invoice.toJSON(),
      payment_summary: {
        total_paid: totalPaid,
        remaining_balance: remainingBalance,
        is_fully_paid: totalPaid >= parseFloat(invoice.final_amount),
      },
    };

    return success(res, 200, "Invoice retrieved successfully", invoiceWithPaymentInfo);
  } catch (err) {
    console.error("Error retrieving invoice:", err);
    return error(res, 500, "Failed to retrieve invoice", err.message);
  }
};

/**
 * Update invoice status
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const updateInvoiceStatus = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["PENDING", "PAID", "CANCELLED"].includes(status)) {
      await transaction.rollback();
      return error(res, 400, "Invalid status value");
    }

    // Check if invoice exists
    const invoice = await Invoice.findOne({
      where: {
        id,
        is_archived: false,
      },
    });

    if (!invoice) {
      await transaction.rollback();
      return error(res, 404, "Invoice not found");
    }

    // Update invoice status
    await invoice.update({ status }, { transaction });

    await transaction.commit();

    return success(res, 200, "Invoice status updated successfully", { id, status });
  } catch (err) {
    await transaction.rollback();
    console.error("Error updating invoice status:", err);
    return error(res, 500, "Failed to update invoice status", err.message);
  }
};

/**
 * Delete an invoice (soft delete)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const deleteInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    // Check if invoice exists
    const invoice = await Invoice.findOne({
      where: {
        id,
        is_archived: false,
      },
    });

    if (!invoice) {
      await transaction.rollback();
      return error(res, 404, "Invoice not found");
    }

    // Get the orders associated with this invoice
    await Order.findAll({
      where: {
        invoice_id: id,
        is_archived: false,
      },
      transaction,
    });

    // Update orders to remove invoice_id
    await Order.update(
      { invoice_id: null },
      {
        where: { invoice_id: id },
        transaction,
      }
    );

    // Update payments to keep order_id but remove invoice_id
    // This ensures payments are still associated with the orders
    await Payment.update(
      { invoice_id: null },
      {
        where: {
          invoice_id: id,
          // Remove is_archived check since the column doesn't exist in payments table
        },
        transaction,
      }
    );

    // Soft delete the invoice
    await invoice.update({ is_archived: true }, { transaction });

    await transaction.commit();

    return success(res, 200, "Invoice deleted successfully");
  } catch (err) {
    await transaction.rollback();
    console.error("Error deleting invoice:", err);
    return error(res, 500, "Failed to delete invoice", err.message);
  }
};

/**
 * Generate PDF for an invoice
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
const generatePDF = async (req, res) => {
  // Create a variable to track if we've already sent a response
  let responseSent = false;

  // Create a function to safely send error responses
  const sendErrorResponse = (statusCode, message, details) => {
    if (!responseSent) {
      responseSent = true;
      return error(res, statusCode, message, details);
    }
  };

  // Create a PDF document outside the try block so we can access it in the catch
  let doc;

  try {
    const { id } = req.params;

    // Fetch invoice with all related data
    const invoice = await Invoice.findOne({
      where: {
        id,
        is_archived: false,
      },
      include: [
        { model: Customer, as: "customer" },
        { model: InvoiceItem, as: "invoiceItems" },
        {
          model: Order,
          as: "orders",
          include: [
            { model: PlateType, as: "plateType" },
            {
              model: OrderProductSize,
              as: "orderProductSizes",
              include: [{ model: ProductSize, as: "productSize" }],
            },
          ],
        },
        {
          model: Payment,
          as: "payments",
          required: false,
        },
      ],
    });

    if (!invoice) {
      return sendErrorResponse(404, "Invoice not found");
    }

    // Create a PDF document
    doc = new PDFDocument({ margin: 50 });

    // Handle errors in the PDF generation
    doc.on("error", (err) => {
      console.error("PDF generation error:", err);
      // Don't try to send a response here as it might cause "write after end" errors
    });

    // Set response headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${invoice.invoice_number}.pdf`);

    // Pipe the PDF to the response
    doc.pipe(res);

    // Create a clean header layout with proper alignment

    // Define page margins and content width
    const leftMargin = 50;
    const rightMargin = 550;
    const pageWidth = rightMargin - leftMargin;

    // Add company logo on the left with rounded corners
    const logoX = leftMargin;
    const logoY = 40;
    const logoWidth = 100;
    const logoHeight = 100;

    const logoPath = path.join(__dirname, "../../public/company_logo.png");
    try {
      if (fs.existsSync(logoPath)) {
        // Save current graphics state for clipping
        doc.save();

        // Create a rounded rectangle clipping path for the logo
        const cornerRadius = 12;

        // Draw rounded rectangle path for clipping
        doc.roundedRect(logoX, logoY, logoWidth, logoHeight, cornerRadius).clip();

        // Draw the image within the clipping path
        doc.image(logoPath, logoX, logoY, { width: logoWidth, height: logoHeight, fit: [logoWidth, logoHeight] });

        // Restore graphics state
        doc.restore();
      } else {
        console.warn("Company logo not found at:", logoPath);
      }
    } catch (logoErr) {
      console.warn("Error loading company logo:", logoErr.message);
      // Continue without the logo
    }

    // Add invoice title in the center
    doc.fontSize(28).font("Helvetica-Bold").text("INVOICE", leftMargin, 70, {
      align: "center",
      width: pageWidth,
    });

    // Add company name and address below the logo
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("M/s YARS Industries", logoX, logoY + logoHeight + 10);
    doc
      .fontSize(9)
      .font("Helvetica")
      .text("Plot #21 KIADB Kolhar Industrial Area", logoX, logoY + logoHeight + 30);
    doc
      .fontSize(9)
      .font("Helvetica")
      .text("2nd phase Village Ballura", logoX, logoY + logoHeight + 45);
    doc
      .fontSize(9)
      .font("Helvetica")
      .text("Bidar - 585403", logoX, logoY + logoHeight + 60);

    // Add a horizontal line below the header
    const headerBottomY = logoY + logoHeight + 90;
    doc.moveTo(leftMargin, headerBottomY).lineTo(rightMargin, headerBottomY).stroke();

    // Add invoice details - adjust position based on the new header layout
    const detailsStartY = headerBottomY + 20; // Start below the horizontal line

    doc.fontSize(11).font("Helvetica").text("Invoice #:", leftMargin, detailsStartY);
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(invoice.invoice_number, leftMargin, detailsStartY + 15);

    doc
      .fontSize(11)
      .font("Helvetica")
      .text("Invoice Date:", leftMargin, detailsStartY + 40);
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(new Date(invoice.invoice_date).toLocaleDateString(), leftMargin, detailsStartY + 55);

    const rightColumnX = 300;
    doc.fontSize(11).font("Helvetica").text("Billing Period:", rightColumnX, detailsStartY);
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(`${new Date(invoice.billing_period_start).toLocaleDateString()} - ${new Date(invoice.billing_period_end).toLocaleDateString()}`, rightColumnX, detailsStartY + 15);

    doc
      .fontSize(11)
      .font("Helvetica")
      .text("Due Date:", rightColumnX, detailsStartY + 40);
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(invoice.payment_due_date ? new Date(invoice.payment_due_date).toLocaleDateString() : "N/A", rightColumnX, detailsStartY + 55);

    // Add customer details
    const customerY = detailsStartY + 90;
    doc.fontSize(11).font("Helvetica").text("Billed To:", leftMargin, customerY);
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(invoice.customer.name, leftMargin, customerY + 15);

    // Add items table header
    const tableHeaderY = customerY + 50;
    doc.moveTo(leftMargin, tableHeaderY).lineTo(rightMargin, tableHeaderY).stroke();

    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("Description", leftMargin + 10, tableHeaderY + 20);
    doc.text("Rate", 200, tableHeaderY + 20, { align: "left", width: 100 });
    doc.text("Qty.", 400, tableHeaderY + 20, { align: "center", width: 40 });
    doc.text("Amount", 450, tableHeaderY + 20, { align: "right", width: 100 });

    doc
      .moveTo(leftMargin, tableHeaderY + 40)
      .lineTo(rightMargin, tableHeaderY + 40)
      .stroke();

    // Add items
    let y = tableHeaderY + 60;
    for (const item of invoice.invoiceItems) {
      // Convert string values to numbers to ensure toFixed works
      const unitPrice = parseFloat(item.unit_price);
      const totalPrice = parseFloat(item.total_price);
      const quantity = parseFloat(item.quantity);

      // Calculate the height needed for the description text
      const descriptionWidth = 120; // Narrower width for description to avoid collision
      const descriptionOptions = { width: descriptionWidth, align: "left" };

      // Get the height of the description text
      const descriptionHeight = doc.heightOfString(item.description, descriptionOptions);

      // Draw the description with word wrapping
      doc.fontSize(10).font("Helvetica").text(item.description, 60, y, descriptionOptions);

      // Position other columns with enough space from description
      doc.text(`Rs. ${Math.abs(unitPrice).toFixed(2)}`, 200, y, { align: "left", width: 100 });
      doc.text(quantity.toString(), 400, y, { align: "center", width: 40 });
      doc.text(`Rs. ${Math.abs(totalPrice).toFixed(2)}`, 450, y, { align: "right", width: 100 });

      // Adjust y position based on the height of the description or a minimum row height
      const rowHeight = Math.max(descriptionHeight, 20);
      y += rowHeight + 5; // Add 5 for padding between rows

      // Add a new page if we're running out of space
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
    }

    // Add totals
    doc.moveTo(50, y).lineTo(550, y).stroke(); // Line after items
    y += 20;

    // Calculate advance payment total from invoice items
    let advancePaymentTotal = 0;
    for (const item of invoice.invoiceItems) {
      if (item.description.includes("Advance Payment")) {
        advancePaymentTotal += Math.abs(parseFloat(item.total_price));
      }
    }

    // Calculate total payments made (excluding advance payments which are already in invoice items)
    let totalPayments = 0;
    if (invoice.payments && invoice.payments.length > 0) {
      // Filter out ADVANCE type payments to avoid double counting
      const advancePayments = invoice.payments.filter((payment) => payment.payment_type === "ADVANCE");
      const otherPayments = invoice.payments.filter((payment) => payment.payment_type !== "ADVANCE");

      // Only count non-advance payments
      totalPayments = otherPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    }

    // For the PDF, we should use the original total amount from the invoice
    // This is already the full order amount without advance subtracted
    // Convert all values to numbers to ensure toFixed works
    const totalAmount = parseFloat(invoice.total_amount);
    const taxPercent = parseFloat(invoice.tax_percent);
    const taxAmount = parseFloat(invoice.tax_amount);
    // We don't need finalAmount since we're calculating the remaining amount based on totalAmount

    doc.fontSize(12).font("Helvetica-Bold").text("Subtotal", 350, y);
    doc.text(`Rs. ${totalAmount.toFixed(2)}`, 450, y, { align: "right", width: 100 });
    y += 20;

    // Show advance payment if any
    if (advancePaymentTotal > 0) {
      doc.text("Advance Paid", 350, y);
      doc.text(`Rs. ${advancePaymentTotal.toFixed(2)}`, 450, y, { align: "right", width: 100 });
      y += 20;
    }

    // Show additional payments if any (excluding advance payments which are already shown in invoice items)
    // Only show additional payments if they are different from the advance payment
    if (totalPayments > 0 && totalPayments !== advancePaymentTotal) {
      doc.text("Additional Payments", 350, y);
      doc.text(`Rs. ${totalPayments.toFixed(2)}`, 450, y, { align: "right", width: 100 });
      y += 20;
    }

    doc.text("Tax Rate (%)", 350, y);
    doc.text(`${taxPercent.toFixed(2)}%`, 450, y, { align: "right", width: 100 });
    y += 20;

    doc.text("Tax", 350, y);
    doc.text(`Rs. ${taxAmount.toFixed(2)}`, 450, y, { align: "right", width: 100 });
    y += 20;

    doc.moveTo(350, y).lineTo(550, y).stroke();
    y += 20;

    // Calculate remaining amount after all payments
    // First, calculate the total amount that has been paid (advance + additional payments)
    const totalPaidAmount = advancePaymentTotal + totalPayments;

    // The remaining amount is the subtotal minus all payments
    // We use totalAmount (subtotal) instead of finalAmount (which includes tax)
    const remainingAmount = Math.max(0, totalAmount - totalPaidAmount);

    doc.fontSize(14).text("Total Payable", 350, y);
    doc.text(`Rs. ${remainingAmount.toFixed(2)}`, 450, y, { align: "right", width: 100 });

    // Add disclaimer text at the bottom
    const disclaimerY = y + 60;
    doc.fontSize(9).font("Helvetica").text("This invoice is computer-generated and does not require any physical signature.", leftMargin, disclaimerY, {
      align: "center",
      width: pageWidth,
      italic: true,
    });

    // Finalize the PDF
    doc.end();
  } catch (err) {
    console.error("Error generating PDF:", err);

    // If we've already started streaming the PDF, we can't send an error response
    if (doc && doc.readable) {
      try {
        // Try to end the document gracefully
        doc.end();
      } catch (endErr) {
        console.error("Error ending PDF document:", endErr);
      }
    } else {
      // If we haven't started streaming, send an error response
      return sendErrorResponse(500, "Failed to generate PDF", err.message);
    }
  }
};

module.exports = {
  generateInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoiceStatus,
  deleteInvoice,
  generatePDF,
};
