"use strict";

const fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ₹ the way the app shows it: Indian grouping, no trailing zeros (₹2,300, ₹250.5). */
const rupee = (n) => {
  const v = Number(n) || 0;
  return `${v < 0 ? "-" : ""}₹${fmt.format(Math.abs(v))}`;
};

/** "2026-09-12" → "12 Sep 2026". */
const dayText = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

/** Order-row items → "12 x 16 10 kg, 14 x 18 5000 pcs". */
const itemsText = (items) => (items || []).map((i) => `${i.size} ${i.quantity} ${i.unit === "PIECES" ? "pcs" : "kg"}`).join(", ") || "no items";

const capLines = (lines, max) => (lines.length > max ? [...lines.slice(0, max), `…and ${lines.length - max} more`] : lines);

const ORDER_STATUS_LABEL = { PENDING: "Pending", IN_PROGRESS: "In progress", COMPLETED: "Completed", DELIVERED: "Delivered", CANCELLED: "Cancelled" };
const METHOD_LABEL = { CASH: "Cash", UPI: "UPI", BANK_TRANSFER: "Bank", CHECK: "Cheque", OTHER: "Other" };
const PAYMENT_TYPE_LABEL = { ADVANCE: "Advance", PARTIAL: "Part payment", FINAL: "Final payment", REFUND: "Refund" };

module.exports = { rupee, dayText, itemsText, capLines, ORDER_STATUS_LABEL, METHOD_LABEL, PAYMENT_TYPE_LABEL };
