"use strict";

/**
 * Per-order money facts in integer paise — the ONE place list endpoints,
 * invoices and the dashboard get an order's total / received / remaining,
 * so every screen shows the same figure. Built on orderMath.
 */
const { orderTotal, paymentPosition } = require("./orderMath");

const toPaise = (x) => Math.round(Number(x) * 100);
const rupees = (paise) => paise / 100;
const isCounted = (order) => order.status !== "CANCELLED";
/** Refunds are money given back. */
const signedPaise = (p) => (p.payment_type === "REFUND" ? -1 : 1) * toPaise(p.amount);
const hasAdvanceRows = (order) =>
  (order.payments || []).filter((p) => p.payment_type === "ADVANCE").reduce((s, p) => s + Number(p.amount), 0) > 0;

/** remaining = rounded total − rounded received, so sums reconcile by construction. */
const orderFacts = (order) => {
  const total = orderTotal(order);
  const totalPaise = toPaise(total);
  const receivedPaise = toPaise(paymentPosition(order, total).totalReceived);
  return { totalPaise, receivedPaise, remainingPaise: totalPaise - receivedPaise };
};

module.exports = { toPaise, rupees, isCounted, signedPaise, hasAdvanceRows, orderFacts };
