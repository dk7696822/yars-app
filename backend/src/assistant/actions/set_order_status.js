"use strict";

const { z } = require("zod");
const { defineAction } = require("../actionKit/defineAction");
const { ActionError } = require("../actionKit/errors");
const { orderView } = require("../actionKit/orderView");
const { recordId } = require("../tools/fields");
const { rupee, ORDER_STATUS_LABEL } = require("../format");
const { ORDER_STATUSES } = require("../../commands/orders/schema");
const command = require("../../commands/orders/updateOrder");

const inTotals = (v) => (v.counted ? rupee(v.row.due) : "not counted (cancelled)");

module.exports = defineAction({
  name: "set_order_status",
  area: "orders",
  summary: "change an order's status (Pending, In progress, Completed, Delivered, Cancelled)",
  description: "Card to change one order's status. order_id from find kind order. A cancelled order can only go back to PENDING.",
  input: z.object({ order_id: recordId(), status: z.enum(ORDER_STATUSES) }),
  trialRunSafe: true,
  command,
  resolve: async ({ order_id, status }, { models }) => {
    const view = await orderView(models, order_id);
    if (!view) throw new ActionError("No live order has that id. Use find with kind order.");
    const from = view.order.status;
    if (from === status) throw new ActionError(`That order is already ${ORDER_STATUS_LABEL[status]}.`);
    if (from === "CANCELLED" && status !== "PENDING") throw new ActionError("A cancelled order can only be restored (to Pending) first.");
    return { view, from, to: status };
  },
  toCommandInput: (r) => ({ id: r.view.order.id, status: r.to }),
  preview: async (r, { models, transaction }) => {
    const after = await orderView(models, r.view.order.id, transaction);
    const touchesTotals = r.to === "CANCELLED" || r.from === "CANCELLED";
    return {
      title: r.to === "CANCELLED" ? "Cancel order" : r.from === "CANCELLED" ? "Restore order" : `Mark order ${ORDER_STATUS_LABEL[r.to]}`,
      rows: [
        { label: "Customer", value: r.view.row.customer.name },
        { label: "Order", value: r.view.label },
        { label: "Status", value: ORDER_STATUS_LABEL[r.to], before: ORDER_STATUS_LABEL[r.from], after: ORDER_STATUS_LABEL[r.to] },
        ...(touchesTotals ? [{ label: "Due in totals", value: inTotals(after), before: inTotals(r.view), after: inTotals(after) }] : []),
      ],
      warnings: r.to === "CANCELLED" ? ["A cancelled order is left out of totals and dues."] : [],
    };
  },
  context: (r) => ({ customer: r.view.row.customer }),
  fingerprint: async (payload, { models, transaction }) => {
    const order = await models.Order.findByPk(payload.id, { attributes: ["status", "updated_at"], transaction });
    return order ? { status: order.status, updated: new Date(order.updated_at).toISOString() } : null;
  },
  resultLink: (result) => `/orders/${result.id}`,
  formLink: (payload) => `/orders/${payload.id}`,
  evals: [
    { ask: "Mark Bombay Saree Centre's order as delivered", expect: { action: "set_order_status", args: { status: "DELIVERED" }, refs: { order_id: "bombayOrder" } } },
    { ask: "Cancel Sharma Traders Surat's order from 20 September", expect: { action: "set_order_status", args: { status: "CANCELLED" }, refs: { order_id: "suratOrderB" } } },
    { ask: "Delete Bombay Saree Centre's order", expect: { noAction: true, mentions: "/orders" } },
  ],
});
