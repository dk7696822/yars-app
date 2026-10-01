"use strict";

const { z } = require("zod");
const { defineAction } = require("../actionKit/defineAction");
const { ActionError } = require("../actionKit/errors");
const { orderView } = require("../actionKit/orderView");
const { recordId, isoDate, money } = require("../tools/fields");
const { paymentTypeFor, overpayment } = require("../../services/paymentType");
const { rupee, dayText, METHOD_LABEL, PAYMENT_TYPE_LABEL } = require("../format");
const { ASSISTANT_NAME } = require("../config");
const command = require("../../commands/payments/createPayment");
const { PAYMENT_METHODS } = require("../../commands/payments/constants");

module.exports = defineAction({
  name: "record_payment",
  area: "payments",
  summary: "money received (or refunded) on one order",
  description: "Card to record money received on one order; refund true for money given back. order_id from find kind order. method defaults to CASH, date to today.",
  input: z.object({
    order_id: recordId(),
    amount: money(),
    method: z.enum(PAYMENT_METHODS).optional(),
    date: isoDate().optional(),
    reference: z.string().optional(),
    notes: z.string().optional(),
    refund: z.boolean().optional(),
  }),
  trialRunSafe: true,
  command,
  resolve: async (args, { models, today }) => {
    const view = await orderView(models, args.order_id);
    if (!view) throw new ActionError("No live order has that id. Use find with kind order.");
    if (!view.counted) throw new ActionError("That order is cancelled, so it takes no payments. Restore it on the order page first.");
    const refund = Boolean(args.refund);
    return {
      view,
      refund,
      amount: args.amount,
      type: refund ? "REFUND" : paymentTypeFor(args.amount, view.row.due),
      overpay: refund ? 0 : overpayment(args.amount, view.row.due),
      method: args.method || "CASH",
      date: args.date || today,
      reference: args.reference || null,
      notes: args.notes || null,
    };
  },
  toCommandInput: (r) => ({
    order_id: r.view.order.id,
    amount: r.amount,
    payment_type: r.type,
    payment_method: r.method,
    payment_date: r.date,
    reference_number: r.reference,
    notes: r.notes,
  }),
  preview: async (r, { models, transaction }) => {
    const after = await orderView(models, r.view.order.id, transaction);
    return {
      title: `${r.refund ? "Record refund" : "Record payment"} ${rupee(r.amount)}`,
      rows: [
        { label: "Customer", value: r.view.row.customer.name },
        { label: "Order", value: r.view.label },
        { label: "Type", value: PAYMENT_TYPE_LABEL[r.type] },
        { label: "Method", value: METHOD_LABEL[r.method] },
        { label: "Date", value: dayText(r.date) },
        ...(r.reference ? [{ label: "Reference", value: r.reference }] : []),
        ...(r.notes ? [{ label: "Notes", value: r.notes }] : []),
        { label: "Due", value: rupee(after.row.due), before: rupee(r.view.row.due), after: rupee(after.row.due) },
      ],
      warnings: r.overpay > 0 ? [`That's ${rupee(r.overpay)} more than the due. It will show as extra received.`] : [],
    };
  },
  context: (r) => ({ customer: r.view.row.customer, refund: r.refund }),
  // Another payment, an edit or a status change since the card was made changes the due it showed.
  fingerprint: async (payload, { models, transaction }) => {
    const view = await orderView(models, payload.order_id, transaction);
    const order = await models.Order.findByPk(payload.order_id, { attributes: ["updated_at", "status"], transaction });
    return view && order ? { received: view.row.received, status: order.status, updated: new Date(order.updated_at).toISOString() } : null;
  },
  staleMessage: `This order changed after ${ASSISTANT_NAME} suggested the payment (another payment or an edit) — ask again.`,
  resultLink: (result, payload) => `/orders/${payload.order_id}`,
  formLink: (payload, id) => `/orders/${payload.order_id}?pay=assistant:${id}`,
  evals: [
    { ask: "Bombay Saree Centre paid 5000 by UPI", expect: { action: "record_payment", args: { amount: 5000, method: "UPI" }, refs: { order_id: "bombayOrder" } } },
    { ask: "Sharma Traders paid 2000", expect: { asks: true } },
    { ask: "Sharma Traders from Surat paid 2000 cash", expect: { asks: true } },
    { ask: "Refund 500 to Bombay Saree Centre in cash", expect: { action: "record_payment", args: { amount: 500, refund: true }, refs: { order_id: "bombayOrder" } } },
  ],
});
