"use strict";

const { z } = require("zod");
const models = require("../../models");
const { defineTool } = require("./defineTool");
const { recordId } = require("./fields");
const { loadOrders } = require("../../services/dashboard/ledger");
const { buildCustomerSummary } = require("../../services/lists/customerDirectory");
const { todayIST } = require("../../services/dashboard/dateRanges");
const { rupee, itemsText, ORDER_STATUS_LABEL, PAYMENT_TYPE_LABEL, METHOD_LABEL } = require("../format");

module.exports = defineTool({
  name: "customer_summary",
  description: "One customer as on their page: owes, credit, business, received, their orders with due, and recent payments.",
  input: z.object({ customer_id: recordId() }),
  run: async ({ customer_id }) => {
    const customer = await models.Customer.findOne({ where: { id: customer_id, is_archived: false } });
    if (!customer) return "No customer with that id. Use find with kind customer.";
    const s = buildCustomerSummary(customer.toJSON(), await loadOrders(models, { is_archived: false, customer_id }), todayIST());
    const c = s.customer;
    const lines = [
      [c.name, c.phone, c.city].filter(Boolean).join(" | "),
      `Owes ${rupee(s.owes)} | credit ${rupee(s.credit)} | business ${rupee(s.totalBusiness)} | received ${rupee(s.received)} | ${s.ordersCount} orders` +
        (s.oldestUnpaidDays != null ? ` | oldest unpaid ${s.oldestUnpaidDays} days` : ""),
      ...s.orders.slice(0, 10).map((r) =>
        `order ${r.id} | ${r.orderDate} | ${itemsText(r.items)} | ${ORDER_STATUS_LABEL[r.status] || r.status} | total ${rupee(r.total)} | received ${rupee(r.received)} | due ${rupee(r.due)}`),
      ...(s.orders.length > 10 ? [`…and ${s.orders.length - 10} older orders`] : []),
      ...s.payments.slice(0, 5).map((p) => `payment | ${p.date} | ${rupee(p.amount)} | ${PAYMENT_TYPE_LABEL[p.type] || p.type} | ${METHOD_LABEL[p.method] || p.method}`),
    ];
    return lines.join("\n");
  },
});
