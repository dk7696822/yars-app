"use strict";

const { z } = require("zod");
const { Payment, Invoice, Customer, Order } = require("../../models");
const { defineCommand } = require("../defineCommand");
const { ValidationError, NotFoundError } = require("../errors");
const { todayIST } = require("../../services/dashboard/dateRanges");
const { refundTooLarge } = require("../../services/refunds");
const { PAYMENT_METHODS, PAYMENT_TYPES } = require("./constants");

const MISSING = "Missing required fields. Either invoice_id or order_id is required, and amount is required.";
const numberText = z.union([z.number(), z.string()]);

const input = z
  .object({
    invoice_id: z.string().nullish(),
    order_id: z.string().nullish(),
    amount: numberText.nullish(),
    payment_date: z.string().nullish(),
    payment_method: z.enum(PAYMENT_METHODS, { error: `Payment method must be one of ${PAYMENT_METHODS.join(", ")}` }).nullish(),
    payment_type: z.enum(PAYMENT_TYPES, { error: `Payment type must be one of ${PAYMENT_TYPES.join(", ")}` }).nullish(),
    reference_number: z.string().nullish(),
    notes: z.string().nullish(),
  })
  .superRefine((v, ctx) => {
    if ((!v.invoice_id && !v.order_id) || !v.amount) ctx.addIssue({ code: "custom", message: MISSING });
    else if (!(Number(v.amount) > 0)) ctx.addIssue({ code: "custom", message: "Amount must be a number above 0" });
  });

module.exports = defineCommand({
  name: "payments.create",
  route: "POST /payments",
  input,
  run: async (v, { transaction, actor }) => {
    const paymentType = v.payment_type || "PARTIAL";
    const data = {
      amount: v.amount,
      payment_date: v.payment_date || todayIST(),
      payment_method: v.payment_method || "CASH",
      payment_type: paymentType,
      reference_number: v.reference_number,
      notes: v.notes,
    };
    let customerId;

    if (v.invoice_id) {
      const invoice = await Invoice.findOne({ where: { id: v.invoice_id, is_archived: false }, include: [{ model: Customer, as: "customer" }], transaction });
      if (!invoice) throw new NotFoundError("Invoice not found");
      customerId = invoice.customer.id;
      // No order_id = money for the invoice as a whole (e.g. its GST). It is
      // NOT pinned to an order: that would show the order as overpaid.
      data.invoice_id = v.invoice_id;
    }

    if (v.order_id) {
      const order = await Order.findOne({ where: { id: v.order_id, is_archived: false }, include: [{ model: Customer, as: "customer" }], transaction });
      if (!order) throw new NotFoundError("Order not found");
      if (paymentType === "REFUND") {
        const tooLarge = await refundTooLarge(v.order_id, v.amount, null, transaction);
        if (tooLarge) throw new ValidationError(tooLarge);
      }
      customerId = order.customer.id;
      data.order_id = v.order_id;
      if (paymentType === "ADVANCE" && !v.invoice_id) data.invoice_id = null;
    }

    data.customer_id = customerId;
    const payment = await Payment.create(data, { transaction, actor });
    return { id: payment.id };
  },
});
