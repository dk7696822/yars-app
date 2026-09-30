"use strict";

/**
 * Customers screen + customer page — pure builders over live customers and
 * the orders from loadOrders(). Dues count only non-cancelled orders and add
 * only positive remainders (extra received is reported, never netted).
 */
const { rupees, isCounted, hasAdvanceRows, orderFacts } = require("../orderFacts");
const { daysBetween } = require("../dashboard/dateRanges");
const { toOrderRow, paging, pageOf, ListError } = require("./orderList");

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const digitsOf = (s) => String(s || "").replace(/\D/g, "");
const letterOf = (name) => {
  const ch = String(name || "").trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(ch) ? ch : "#";
};
const SORTS = ["name", "recent"];
const EMPTY = { duePaise: 0, creditPaise: 0, businessPaise: 0, receivedPaise: 0, ordersCount: 0, lastOrderDate: null, oldestUnpaidDate: null, oldestUnpaidDays: null };

const customerStats = (orders, today) => {
  const stats = new Map();
  for (const o of orders) {
    const s = stats.get(o.customer_id) || { ...EMPTY };
    if (!s.lastOrderDate || o.order_date > s.lastOrderDate) s.lastOrderDate = o.order_date;
    if (isCounted(o)) {
      const f = orderFacts(o);
      s.ordersCount += 1;
      s.businessPaise += f.totalPaise;
      s.receivedPaise += f.receivedPaise;
      if (f.remainingPaise > 0) {
        s.duePaise += f.remainingPaise;
        if (!s.oldestUnpaidDate || o.order_date < s.oldestUnpaidDate) s.oldestUnpaidDate = o.order_date;
      } else {
        s.creditPaise += -f.remainingPaise;
      }
    }
    stats.set(o.customer_id, s);
  }
  for (const s of stats.values()) s.oldestUnpaidDays = s.oldestUnpaidDate ? Math.max(0, daysBetween(s.oldestUnpaidDate, today)) : null;
  return stats;
};

const buildDirectory = (customers, orders, query, today) => {
  const sort = query.sort || "name";
  if (!SORTS.includes(sort)) throw new ListError(`Unknown sort "${sort}"`);
  const owe = query.owe === "1" || query.owe === "true";
  const stats = customerStats(orders, today);
  const q = String(query.search || "").trim().toLowerCase();
  const qDigits = digitsOf(q);

  let rows = customers
    .map((c) => {
      const s = stats.get(c.id) || EMPTY;
      return {
        row: {
          id: c.id, name: c.name, phone: c.metadata?.phone || null, city: c.metadata?.city || null,
          due: rupees(s.duePaise), ordersCount: s.ordersCount, lastOrderDate: s.lastOrderDate, oldestUnpaidDays: s.oldestUnpaidDays,
        },
        duePaise: s.duePaise,
      };
    })
    .filter(({ row }) => !q || row.name.toLowerCase().includes(q) || (qDigits.length >= 3 && digitsOf(row.phone).includes(qDigits)));

  const owing = rows.filter((x) => x.duePaise > 0);
  const summary = { count: rows.length, owingCount: owing.length, due: rupees(owing.reduce((s, x) => s + x.duePaise, 0)) };

  if (owe) rows = owing.sort((a, b) => b.row.oldestUnpaidDays - a.row.oldestUnpaidDays || b.duePaise - a.duePaise);
  else if (sort === "recent") rows.sort((a, b) => (b.row.lastOrderDate || "").localeCompare(a.row.lastOrderDate || "") || collator.compare(a.row.name, b.row.name));
  else rows.sort((a, b) => collator.compare(a.row.name, b.row.name));

  const letters = [];
  if (!owe && sort === "name") {
    rows.forEach(({ row }, index) => {
      const letter = letterOf(row.name);
      if (!letters.length || letters[letters.length - 1].letter !== letter) letters.push({ letter, index });
    });
  }
  return { ...pageOf(rows.map((x) => x.row), paging(query, 100, 500)), summary, letters };
};

const buildCustomerSummary = (customer, orders, today) => {
  const s = customerStats(orders, today).get(customer.id) || EMPTY;
  const m = customer.metadata || {};
  const payments = orders
    .flatMap((o) => (o.payments || []).map((p) => ({
      id: p.id, orderId: o.id, orderDate: o.order_date, orderCancelled: !isCounted(o),
      amount: Number(p.amount), type: p.payment_type, method: p.payment_method, date: p.payment_date,
      reference: p.reference_number || null, notes: p.notes || null,
    })))
    .sort((a, b) => b.date.localeCompare(a.date));
  const legacyAdvances = orders
    .filter((o) => isCounted(o) && !hasAdvanceRows(o) && Number(o.advance_received || 0) > 0)
    .map((o) => ({ orderId: o.id, orderDate: o.order_date, amount: Number(o.advance_received) }));
  return {
    customer: {
      id: customer.id, name: customer.name, phone: m.phone || null, email: m.email || null, address: m.address || null,
      city: m.city || null, gstin: m.gstin || null, createdAt: customer.created_at || null,
    },
    owes: rupees(s.duePaise),
    credit: rupees(s.creditPaise),
    oldestUnpaidDays: s.oldestUnpaidDays,
    totalBusiness: rupees(s.businessPaise),
    received: rupees(s.receivedPaise),
    ordersCount: s.ordersCount,
    orders: orders.map(toOrderRow).sort((a, b) => b.orderDate.localeCompare(a.orderDate) || new Date(b.createdAt) - new Date(a.createdAt)),
    payments,
    legacyAdvances,
  };
};

module.exports = { customerStats, buildDirectory, buildCustomerSummary, letterOf };
