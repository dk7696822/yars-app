"use strict";

/**
 * Orders screen list — pure: filter, sort, summarise and page the orders
 * loaded by loadOrders(). Money comes only from orderFacts, so these figures
 * equal the order page and the dashboard.
 */
const { rupees, isCounted, orderFacts } = require("../orderFacts");
const { monthStart, monthEnd } = require("../dashboard/dateRanges");

class ListError extends Error {}

/** A real calendar date written YYYY-MM-DD. */
const isDate = (s) => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

const CHIPS = ["all", "due", "in_progress", "this_month"];

const paging = ({ page, limit } = {}, def = 30, max = 100) => ({
  page: Math.max(1, parseInt(page, 10) || 1),
  limit: Math.min(max, Math.max(1, parseInt(limit, 10) || def)),
});

const pageOf = (rows, { page, limit }) => ({
  rows: rows.slice((page - 1) * limit, page * limit),
  page,
  hasMore: page * limit < rows.length,
});

const itemsOf = (order) =>
  (order.orderProductSizes || []).map((line) => ({
    size: line.productSize?.size_label || "Unknown size",
    unit: line.unit === "PIECES" ? "PIECES" : "KG",
    quantity: line.unit === "PIECES" ? Number(line.quantity_pieces) : parseFloat(line.quantity_kg),
  }));

const withFacts = (order) => {
  const f = orderFacts(order);
  return {
    row: {
      id: order.id,
      orderDate: order.order_date,
      createdAt: order.created_at,
      status: order.status,
      cancelled: !isCounted(order),
      customer: { id: order.customer_id, name: order.customerName, phone: order.customerPhone },
      items: itemsOf(order),
      invoiceId: order.invoice_id || null,
      total: rupees(f.totalPaise),
      received: rupees(f.receivedPaise),
      due: rupees(f.remainingPaise),
    },
    f,
  };
};

const toOrderRow = (order) => withFacts(order).row;

const newestFirst = (a, b) => b.row.orderDate.localeCompare(a.row.orderDate) || new Date(b.row.createdAt) - new Date(a.row.createdAt);

const buildOrderList = (orders, query, today) => {
  const chip = query.chip || "all";
  if (!CHIPS.includes(chip)) throw new ListError(`Unknown filter "${chip}"`);
  const q = String(query.search || "").trim().toLowerCase();
  const from = chip === "this_month" ? monthStart(today) : query.from;
  const to = chip === "this_month" ? monthEnd(today) : query.to;
  for (const d of [from, to]) if (d && !isDate(d)) throw new ListError("Dates must look like 2026-08-01");
  if (from && to && from > to) throw new ListError("From date must be on or before To date");

  const matches = ({ row, f }) =>
    (!q || row.customer.name.toLowerCase().includes(q) || row.items.some((i) => i.size.toLowerCase().includes(q))) &&
    (!query.status || row.status === query.status) &&
    (!from || row.orderDate >= from) &&
    (!to || row.orderDate <= to) &&
    (chip !== "due" || (!row.cancelled && f.remainingPaise > 0)) &&
    (chip !== "in_progress" || row.status === "PENDING" || row.status === "IN_PROGRESS");

  const all = orders.map(withFacts).filter(matches).sort(newestFirst);
  const counted = all.filter((x) => !x.row.cancelled);
  const summary = {
    count: counted.length,
    total: rupees(counted.reduce((s, x) => s + x.f.totalPaise, 0)),
    due: rupees(counted.reduce((s, x) => s + Math.max(0, x.f.remainingPaise), 0)),
    cancelled: all.length - counted.length,
    matched: all.length,
  };
  return { ...pageOf(all.map((x) => x.row), paging(query)), summary };
};

module.exports = { buildOrderList, toOrderRow, ListError, paging, pageOf };
