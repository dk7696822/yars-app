"use strict";

/**
 * Invoice money (spec Decision 10). Due = final amount (incl. tax) − what was
 * received on the invoice's orders (orderFacts: refunds subtracted, advance
 * either/or rule) − invoice-only payments. Status is derived; only CANCELLED
 * is ever set by hand, so a stale stored PAID/PENDING is never trusted.
 */
const { Op } = require("sequelize");
const { toPaise, rupees, signedPaise, orderFacts } = require("./orderFacts");
const { loadOrders } = require("./dashboard/ledger");
const { daysBetween } = require("./dashboard/dateRanges");

const invoiceMoney = (invoice, orders, invoiceOnlyPayments, today) => {
  const paidPaise =
    orders.reduce((s, o) => s + orderFacts(o).receivedPaise, 0) + invoiceOnlyPayments.reduce((s, p) => s + signedPaise(p), 0);
  const duePaise = toPaise(invoice.final_amount) - paidPaise;
  const late = invoice.payment_due_date && invoice.payment_due_date < today ? daysBetween(invoice.payment_due_date, today) : 0;
  let derivedStatus = "PENDING";
  if (invoice.status === "CANCELLED") derivedStatus = "CANCELLED";
  else if (duePaise <= 0) derivedStatus = "PAID";
  else if (late > 0) derivedStatus = "OVERDUE";
  return {
    amountPaid: rupees(paidPaise),
    amountDue: rupees(Math.max(0, duePaise)),
    amountExtra: rupees(Math.max(0, -duePaise)),
    derivedStatus,
    overdueDays: derivedStatus === "OVERDUE" ? late : 0,
  };
};

const PAYMENT_FIELDS = ["id", "amount", "payment_type", "payment_date", "payment_method", "reference_number", "notes", "invoice_id"];

/**
 * Money for many invoices with two queries. Orders are loaded WITHOUT an
 * is_archived filter: an order deleted after invoicing was still billed, and
 * what it received still counts toward the bill.
 */
const invoiceMoneyFor = async (models, invoices, today) => {
  const ids = invoices.map((i) => i.id);
  const groups = new Map(ids.map((id) => [id, { orders: [], only: [] }]));
  if (ids.length) {
    for (const o of await loadOrders(models, { invoice_id: { [Op.in]: ids } })) groups.get(o.invoice_id).orders.push(o);
    const only = await models.Payment.findAll({ where: { invoice_id: { [Op.in]: ids }, order_id: null }, attributes: PAYMENT_FIELDS, raw: true });
    for (const p of only) groups.get(p.invoice_id).only.push(p);
  }
  return new Map(invoices.map((inv) => {
    const g = groups.get(inv.id);
    return [inv.id, { ...invoiceMoney(inv, g.orders, g.only, today), orders: g.orders, invoiceOnlyPayments: g.only }];
  }));
};

module.exports = { invoiceMoney, invoiceMoneyFor };
