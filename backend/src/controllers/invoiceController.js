"use strict";

const { Invoice, InvoiceItem, Customer, Order, OrderProductSize, ProductSize, PlateType, Payment, sequelize } = require("../models");
const { success, error } = require("../utils/response");
const { orderTotal, lineAmount } = require("../services/orderMath");
const { formatInvoiceRate, formatInvoiceQty } = require("../services/invoiceItemFormat");
const { Op } = require("sequelize");
const models = require("../models");
const { invoiceMoneyFor } = require("../services/invoiceMoney");
const { buildInvoiceList } = require("../services/lists/invoiceList");
const { ListError } = require("../services/lists/orderList");
const { rupees, orderFacts } = require("../services/orderFacts");
const { todayIST, addDays } = require("../services/dashboard/dateRanges");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

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
      // Track advance separately (don't subtract it from the total amount)
      const advanceReceived = parseFloat(order.advance_received) || 0;
      totalAdvanceReceived += advanceReceived;

      const orderAmount = orderTotal(order);

      // Safety check for this order's total
      if (isNaN(orderAmount)) {
        await transaction.rollback();
        return error(res, 400, `Invalid calculation for order ${order.id}. Please check order data.`);
      }

      totalAmount += orderAmount;
    }

    // Calculate tax amount with safety checks
    const taxPercent = parseFloat(tax_percent) || 0;
    const taxAmount = (totalAmount * taxPercent) / 100;
    const finalAmount = totalAmount + taxAmount;

    // Safety check to prevent NaN values
    if (isNaN(totalAmount) || isNaN(taxAmount) || isNaN(finalAmount)) {
      await transaction.rollback();
      return error(res, 400, "Invalid calculation values. Please check order data.");
    }

    // Note: totalAmount is the full order amount without subtracting advance
    // finalAmount is totalAmount + tax
    // The actual amount due is finalAmount - totalAdvanceReceived - any additional payments

    // Create a date object for today
    const today = todayIST();

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
        payment_due_date: payment_due_date || addDays(today, 30),
        total_amount: parseFloat(totalAmount.toFixed(2)),
        tax_percent: parseFloat(parseFloat(tax_percent || 0).toFixed(2)),
        tax_amount: parseFloat(taxAmount.toFixed(2)),
        final_amount: parseFloat(finalAmount.toFixed(2)),
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
        const isPieces = item.unit === "PIECES";

        await InvoiceItem.create(
          {
            invoice_id: invoice.id,
            order_id: order.id,
            description,
            quantity: isPieces ? item.quantity_pieces : parseFloat(item.quantity_kg),
            // Pieces: rounded per-piece price, kept only for older readers of
            // unit_price — screens use the exact price_amount/price_pieces_count.
            unit_price: isPieces
              ? Math.round((parseFloat(item.price_amount) / item.price_pieces_count) * 100) / 100
              : parseFloat(item.rate_per_kg),
            total_price: lineAmount(item),
            unit: item.unit,
            price_amount: isPieces ? item.price_amount : null,
            price_pieces_count: isPieces ? item.price_pieces_count : null,
          },
          { transaction }
        );
      }

      // Add plate charge as an invoice item (use custom charge if available, otherwise use plate type charge)
      const plateChargeAmount = parseFloat(order.custom_plate_charge || order.plateType.charge);
      const plateChargeDescription = order.custom_plate_charge
        ? `Plate Charge: ${order.plateType.type_name} (Custom) (${order.order_date})`
        : `Plate Charge: ${order.plateType.type_name} (${order.order_date})`;

      await InvoiceItem.create(
        {
          invoice_id: invoice.id,
          order_id: order.id,
          description: plateChargeDescription,
          quantity: 1,
          unit_price: plateChargeAmount,
          total_price: plateChargeAmount,
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

/** money + per-order figures + every payment that counts toward the invoice. */
const moneyDetail = (m) => ({
  money: { amountPaid: m.amountPaid, amountDue: m.amountDue, amountExtra: m.amountExtra, derivedStatus: m.derivedStatus, overdueDays: m.overdueDays },
  orderMoney: m.orders
    .map((o) => {
      const f = orderFacts(o);
      return { id: o.id, orderDate: o.order_date, status: o.status, deleted: Boolean(o.is_archived), total: rupees(f.totalPaise), received: rupees(f.receivedPaise), due: rupees(f.remainingPaise) };
    })
    .sort((a, b) => a.orderDate.localeCompare(b.orderDate)),
  orderPayments: [
    ...m.orders.flatMap((o) => (o.payments || []).map((p) => ({ ...p, order_id: o.id, orderDate: o.order_date }))),
    ...m.invoiceOnlyPayments.map((p) => ({ ...p, orderDate: null })),
  ]
    .map((p) => ({ id: p.id, orderId: p.order_id || null, orderDate: p.orderDate, amount: Number(p.amount), type: p.payment_type, method: p.payment_method, date: p.payment_date, reference: p.reference_number || null, notes: p.notes || null }))
    .sort((a, b) => b.date.localeCompare(a.date)),
  payment_summary: { total_paid: m.amountPaid, remaining_balance: m.amountDue, is_fully_paid: m.derivedStatus === "PAID" },
});

const listInvoices = async (req, res) => {
  try {
    const invoices = (
      await Invoice.findAll({ where: { is_archived: false }, include: [{ model: Customer, as: "customer", attributes: ["id", "name", "metadata"], required: false }] })
    ).map((i) => i.toJSON());
    const money = await invoiceMoneyFor(models, invoices, todayIST());
    return success(res, 200, "Invoices list", buildInvoiceList(invoices, money, req.query));
  } catch (err) {
    if (err instanceof ListError) return error(res, 400, err.message);
    console.error("Error listing invoices:", err);
    return error(res, 500, "Failed to load invoices", err.message);
  }
};

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

    const plain = invoices.map((i) => i.toJSON());
    const money = await invoiceMoneyFor(models, plain, todayIST());
    const invoicesWithPaymentInfo = plain.map((inv) => ({ ...inv, payment_summary: moneyDetail(money.get(inv.id)).payment_summary }));

    return success(res, 200, "Invoices retrieved successfully", invoicesWithPaymentInfo);
  } catch (err) {
    console.error("Error retrieving invoices:", err);
    return error(res, 500, "Failed to retrieve invoices", err.message);
  }
};

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

    const plain = invoice.toJSON();
    const m = (await invoiceMoneyFor(models, [plain], todayIST())).get(plain.id);
    return success(res, 200, "Invoice retrieved successfully", { ...plain, ...moneyDetail(m) });
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

    if (status === "PAID") {
      await transaction.rollback();
      return error(res, 400, "Paid is worked out from recorded payments");
    }
    if (!["PENDING", "CANCELLED"].includes(status)) {
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

    const money = (await invoiceMoneyFor(models, [invoice.toJSON()], todayIST())).get(invoice.id);

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
      .text("M/s YARS INDUSTRIES", logoX, logoY + logoHeight + 10);
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("GSTIN: 29ADNPN2449Q3ZJ", logoX, logoY + logoHeight + 25);
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("PLOT #21 KIADB KOLHAR INDUSTRIAL AREA", logoX, logoY + logoHeight + 40);
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("2ND PHASE VILLAGE BALLURA", logoX, logoY + logoHeight + 55);
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("BIDAR - 585402", logoX, logoY + logoHeight + 70);

    // Add a horizontal line below the header
    const headerBottomY = logoY + logoHeight + 95;
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

    // Add customer details
    const customerY = detailsStartY + 80;
    doc.fontSize(11).font("Helvetica").text("Billed To:", leftMargin, customerY);
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(invoice.customer.name, leftMargin, customerY + 15);

    const customerAddress = invoice.customer.metadata?.address;
    let addressY = customerY + 30;
    if (customerAddress) {
      doc.fontSize(10).font("Helvetica").text(customerAddress, leftMargin, addressY, { width: 200 });
      addressY += 30;
    }

    // Add items table header
    const tableHeaderY = addressY + 20;
    doc.moveTo(leftMargin, tableHeaderY).lineTo(rightMargin, tableHeaderY).stroke();

    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("Description", leftMargin + 10, tableHeaderY + 20);
    doc.text("Rate", 200, tableHeaderY + 20, { align: "left", width: 175 });
    doc.text("Qty.", 375, tableHeaderY + 20, { align: "center", width: 75 });
    doc.text("Amount", 450, tableHeaderY + 20, { align: "right", width: 100 });

    doc
      .moveTo(leftMargin, tableHeaderY + 40)
      .lineTo(rightMargin, tableHeaderY + 40)
      .stroke();

    // Add items
    let y = tableHeaderY + 60;
    for (const item of invoice.invoiceItems) {
        // Advance lines (negative) are not items — what was received is in the totals.
        if (parseFloat(item.total_price) < 0) continue;
      // Convert string values to numbers to ensure toFixed works
      const totalPrice = parseFloat(item.total_price);

      // Calculate the height needed for the description text
      const descriptionWidth = 120; // Narrower width for description to avoid collision
      const descriptionOptions = { width: descriptionWidth, align: "left" };

      // Get the height of the description text
      const descriptionHeight = doc.heightOfString(item.description, descriptionOptions);

      // Draw the description with word wrapping
      doc.fontSize(10).font("Helvetica").text(item.description, 60, y, descriptionOptions);

      // Position other columns with enough space from description
      doc.text(formatInvoiceRate(item), 200, y, { align: "left", width: 175 });
      doc.text(formatInvoiceQty(item), 375, y, { align: "center", width: 75 });
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

    const totals = [
      ["Subtotal", parseFloat(invoice.total_amount)],
      [`Tax (${parseFloat(invoice.tax_percent).toFixed(2)}%)`, parseFloat(invoice.tax_amount)],
      ["Total", parseFloat(invoice.final_amount)],
      ["Received", money.amountPaid],
    ];
    doc.fontSize(12).font("Helvetica-Bold");
    for (const [label, value] of totals) {
      doc.text(label, 350, y);
      doc.text(`Rs. ${value.toFixed(2)}`, 450, y, { align: "right", width: 100 });
      y += 20;
    }
    doc.moveTo(350, y).lineTo(550, y).stroke();
    y += 20;
    // The same "Due" as the invoice page and list.
    doc.fontSize(14).text(money.amountDue > 0 ? "Due" : "Paid in full", 350, y);
    doc.text(`Rs. ${money.amountDue.toFixed(2)}`, 450, y, { align: "right", width: 100 });

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
  listInvoices,
  getInvoiceById,
  updateInvoiceStatus,
  deleteInvoice,
  generatePDF,
};
