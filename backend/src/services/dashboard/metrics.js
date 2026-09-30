"use strict";

/**
 * Dashboard figures — spec §1. Pure functions over a ledger (see ledger.js).
 * Money is summed in integer paise so every total reconciles exactly; order
 * totals come only from orderMath (the same code as the Orders screen).
 */

const { orderTotal, paymentPosition, volumeSummary, lineKg } = require("../orderMath");
const { BANDS, agingBand, daysBetween, lastMonths, monthEnd } = require("./dateRanges");

const toPaise = (x) => Math.round(Number(x) * 100);
const rupees = (p) => p / 100;
const inRange = (d, r) => Boolean(d) && d >= r.from && d <= r.to;
const isCounted = (o) => o.status !== "CANCELLED";
const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);

/** Paise facts for one order. remaining = rounded total − received, so sums reconcile by construction. */
const orderFacts = (order) => {
  const total = orderTotal(order);
  const totalPaise = toPaise(total);
  const receivedPaise = toPaise(paymentPosition(order, total).totalReceived);
  return { totalPaise, receivedPaise, remainingPaise: totalPaise - receivedPaise };
};

const hasAdvanceRows = (order) => sum((order.payments || []).filter((p) => p.payment_type === "ADVANCE"), (p) => Number(p.amount)) > 0;

/** Money received for this order inside the range: dated payments + a legacy column-only advance at the order date. */
const receivedInRange = (order, range) => {
  let paise = sum((order.payments || []).filter((p) => inRange(p.payment_date, range)), (p) => toPaise(p.amount));
  if (!hasAdvanceRows(order) && Number(order.advance_received || 0) > 0 && inRange(order.order_date, range)) {
    paise += toPaise(order.advance_received);
  }
  return paise;
};

const reconcile = ({ salesPaise, receivedPaise, toCollectPaise, creditPaise, agingPaise, customersPaise }) => {
  const checks = {
    allTime: salesPaise - receivedPaise === toCollectPaise - creditPaise,
    agingSum: agingPaise.reduce((s, x) => s + x, 0) === toCollectPaise,
    customersSum: customersPaise.reduce((s, x) => s + x, 0) === toCollectPaise,
  };
  return { ok: checks.allTime && checks.agingSum && checks.customersSum, ...checks };
};

const computeOverview = ({ orders }, today) => {
  const counted = orders.filter(isCounted);
  const cancelled = orders.filter((o) => !isCounted(o));
  const bands = Object.fromEntries(BANDS.map((b) => [b, { paise: 0, orders: 0 }]));
  const customers = new Map();
  let salesPaise = 0;
  let receivedPaise = 0;
  let toCollectPaise = 0;
  let creditPaise = 0;
  let ordersOwing = 0;

  for (const o of counted) {
    const f = orderFacts(o);
    salesPaise += f.totalPaise;
    receivedPaise += f.receivedPaise;
    if (f.remainingPaise < 0) creditPaise += -f.remainingPaise;
    if (f.remainingPaise <= 0) continue;

    toCollectPaise += f.remainingPaise;
    ordersOwing += 1;
    const band = bands[agingBand(Math.max(0, daysBetween(o.order_date, today)))];
    band.paise += f.remainingPaise;
    band.orders += 1;

    const c = customers.get(o.customer_id) || { id: o.customer_id, name: o.customerName, phone: o.customerPhone || null, paise: 0, unpaid: [] };
    c.paise += f.remainingPaise;
    c.unpaid.push({ id: o.id, orderDate: o.order_date, remaining: rupees(f.remainingPaise) });
    customers.set(o.customer_id, c);
  }

  const list = [...customers.values()]
    .map((c) => {
      const unpaidOrders = [...c.unpaid].sort((a, b) => a.orderDate.localeCompare(b.orderDate));
      const oldestOrderDate = unpaidOrders[0].orderDate;
      return { paise: c.paise, row: { id: c.id, name: c.name, phone: c.phone, amount: rupees(c.paise), orders: unpaidOrders.length, oldestOrderDate, oldestDays: Math.max(0, daysBetween(oldestOrderDate, today)), unpaidOrders } };
    })
    .sort((a, b) => b.row.oldestDays - a.row.oldestDays || b.paise - a.paise);

  const recentOrders = [...orders]
    .sort((a, b) => b.order_date.localeCompare(a.order_date) || new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)
    .map((o) => ({ id: o.id, customerName: o.customerName, orderDate: o.order_date, status: o.status, total: rupees(orderFacts(o).totalPaise) }));

  return {
    asOf: today,
    toCollect: rupees(toCollectPaise),
    credit: rupees(creditPaise),
    customersOwing: list.length,
    ordersOwing,
    aging: BANDS.map((b) => ({ band: b, amount: rupees(bands[b].paise), orders: bands[b].orders })),
    customers: list.map((x) => x.row),
    recentOrders,
    inProgress: orders.filter((o) => o.status === "PENDING" || o.status === "IN_PROGRESS").length,
    excluded: { cancelled: { count: cancelled.length, amount: rupees(sum(cancelled, (o) => orderFacts(o).totalPaise)) } },
    checks: reconcile({
      salesPaise, receivedPaise, toCollectPaise, creditPaise,
      agingPaise: BANDS.map((b) => bands[b].paise), customersPaise: list.map((x) => x.paise),
    }),
  };
};

const periodFigures = ({ orders, expenses }, range) => {
  const counted = orders.filter(isCounted);
  const dated = counted.filter((o) => inRange(o.order_date, range));
  const exp = expenses.filter((e) => inRange(e.bill_date, range));
  return {
    dated,
    exp,
    salesPaise: sum(dated, (o) => orderFacts(o).totalPaise),
    collectedPaise: sum(counted, (o) => receivedInRange(o, range)),
    payments: sum(counted, (o) => (o.payments || []).filter((p) => inRange(p.payment_date, range)).length),
    volume: volumeSummary(dated),
    expensesPaise: sum(exp, (e) => toPaise(e.total_cost)),
  };
};

const computePeriod = (ledger, range, compare) => {
  const cur = periodFigures(ledger, range);
  const prev = compare ? periodFigures(ledger, compare) : null;

  const byCategory = new Map();
  for (const e of cur.exp) byCategory.set(e.categoryName, (byCategory.get(e.categoryName) || 0) + toPaise(e.total_cost));

  const sizes = new Map();
  for (const o of cur.dated) {
    for (const line of o.orderProductSizes || []) {
      const size = line.productSize?.size_label || "Unknown size";
      const s = sizes.get(size) || { size, kg: 0, pieces: 0 };
      const kg = lineKg(line);
      if (kg !== null) s.kg += kg;
      if (line.unit === "PIECES") s.pieces += Number(line.quantity_pieces);
      sizes.set(size, s);
    }
  }

  const cancelled = ledger.orders.filter((o) => !isCounted(o) && inRange(o.order_date, range));
  const deleted = ledger.deletedOrderPayments.filter((p) => inRange(p.payment_date, range));
  const categoriesPaise = [...byCategory.values()];

  return {
    range,
    compare,
    sales: { value: rupees(cur.salesPaise), previous: prev ? rupees(prev.salesPaise) : null, orders: cur.dated.length },
    collected: { value: rupees(cur.collectedPaise), previous: prev ? rupees(prev.collectedPaise) : null, payments: cur.payments },
    volume: { ...cur.volume, previousKgSold: prev ? prev.volume.kgSold : null },
    expenses: {
      value: rupees(cur.expensesPaise),
      previous: prev ? rupees(prev.expensesPaise) : null,
      byCategory: [...byCategory].map(([name, p]) => ({ name, amount: rupees(p) })).sort((a, b) => b.amount - a.amount),
    },
    topSizes: [...sizes.values()]
      .map((s) => ({ ...s, kg: Math.round(s.kg * 1000) / 1000 }))
      .sort((a, b) => b.kg - a.kg || b.pieces - a.pieces)
      .slice(0, 5),
    excluded: {
      cancelled: { count: cancelled.length, amount: rupees(sum(cancelled, (o) => orderFacts(o).totalPaise)) },
      deletedOrderPayments: { count: deleted.length, amount: rupees(sum(deleted, (p) => toPaise(p.amount))) },
    },
    checks: { ok: categoriesPaise.reduce((s, x) => s + x, 0) === cur.expensesPaise },
  };
};

const computeTrends = (ledger, today, months = 6) => ({
  months: lastMonths(today, months).map((month) => {
    const from = `${month}-01`;
    const end = monthEnd(from);
    const range = { from, to: end < today ? end : today };
    const f = periodFigures(ledger, range);
    return { month, sales: rupees(f.salesPaise), collected: rupees(f.collectedPaise), kgSold: f.volume.kgSold, partial: month === today.slice(0, 7) && today !== end };
  }),
});

module.exports = { toPaise, reconcile, computeOverview, computePeriod, computeTrends };
