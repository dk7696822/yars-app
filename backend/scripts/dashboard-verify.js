#!/usr/bin/env node
"use strict";

/**
 * READ-ONLY cross-check of the dashboard maths against independent SQL.
 *   NODE_ENV=production node scripts/dashboard-verify.js
 * Exit 1 if anything disagrees. Run before every dashboard release.
 */

const fs = require("fs");
const path = require("path");
const { loadLedger } = require("../src/services/dashboard/ledger");
const { computeOverview, computePeriod } = require("../src/services/dashboard/metrics");
const { resolvePeriod, todayIST } = require("../src/services/dashboard/dateRanges");
const { loadOrders } = require("../src/services/dashboard/ledger");
const { buildOrderList } = require("../src/services/lists/orderList");
const { buildDirectory } = require("../src/services/lists/customerDirectory");
const { invoiceMoneyFor } = require("../src/services/invoiceMoney");

const paise = (x) => Math.round(Number(x) * 100);

const canonicalPending = () => {
  const md = fs.readFileSync(path.join(__dirname, "../knowledge/money-sql.md"), "utf8");
  return md.match(/<!-- canonical:pending -->([\s\S]*?)<!-- \/canonical:pending -->/)[1].trim();
};

const verifyDashboard = async (sequelize, models, today = todayIST()) => {
  const q = (sql) => sequelize.query(sql).then(([rows]) => rows);
  const ledger = await loadLedger(models);
  const overview = computeOverview(ledger, today);
  const { range, compare } = resolvePeriod({ preset: "all" }, today, ledger.earliest, ledger.latest);
  const all = computePeriod(ledger, range, compare);
  const problems = [];

  if (!overview.checks.ok) problems.push(`overview checks failed: ${JSON.stringify(overview.checks)}`);

  // Jarvis's canonical per-customer pending must equal the dashboard's list.
  {
    const sql = Object.fromEntries((await q(canonicalPending())).map((r) => [r.name, paise(r.pending)]));
    const app = {};
    for (const c of overview.customers) app[c.name] = (app[c.name] || 0) + paise(c.amount);
    for (const name of new Set([...Object.keys(sql), ...Object.keys(app)])) {
      if ((sql[name] || 0) !== (app[name] || 0)) problems.push(`customer "${name}": SQL ₹${(sql[name] || 0) / 100} vs dashboard ₹${(app[name] || 0) / 100}`);
    }
  }

  const [{ collected }] = await q(`SELECT COALESCE(SUM(CASE WHEN p.payment_type = 'REFUND' THEN -p.amount ELSE p.amount END),0) AS collected
                                   FROM payments p JOIN orders o ON o.id = p.order_id
                                   WHERE NOT o.is_archived AND o.status <> 'CANCELLED'`);
  const [{ legacy }] = await q(`SELECT COALESCE(SUM(o.advance_received),0) AS legacy FROM orders o
                                WHERE NOT o.is_archived AND o.status <> 'CANCELLED' AND COALESCE(o.advance_received,0) > 0
                                  AND COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id AND p.payment_type = 'ADVANCE'),0) = 0`);
  if (paise(collected) + paise(legacy) !== paise(all.collected.value)) problems.push(`all-time collected: SQL ₹${Number(collected) + Number(legacy)} vs dashboard ₹${all.collected.value}`);

  const [{ spent }] = await q(`SELECT COALESCE(SUM(total_cost),0) AS spent FROM expenses WHERE NOT is_archived`);
  if (paise(spent) !== paise(all.expenses.value)) problems.push(`all-time expenses: SQL ₹${spent} vs dashboard ₹${all.expenses.value}`);

  if (paise(all.sales.value) - paise(all.collected.value) !== paise(overview.toCollect) - paise(overview.credit)) {
    problems.push("sales − collected ≠ to collect − credit");
  }

  // Orders screen and Customers screen must show the dashboard's money.
  const orders = await loadOrders(models);
  const list = buildOrderList(orders, { limit: 1 }, today);
  if (paise(list.summary.due) !== paise(overview.toCollect)) problems.push(`orders list due ₹${list.summary.due} vs dashboard ₹${overview.toCollect}`);
  if (paise(list.summary.total) !== paise(all.sales.value)) problems.push(`orders list total ₹${list.summary.total} vs dashboard sales ₹${all.sales.value}`);

  const customers = (await models.Customer.findAll({ attributes: ["id", "name", "metadata", "is_archived"] })).map((x) => x.toJSON());
  const live = customers.filter((x) => !x.is_archived);
  const liveIds = new Set(live.map((x) => x.id));
  const directory = buildDirectory(live, orders, { limit: 1 }, today);
  // Dues of archived customers are on the dashboard but not in the directory — reported, and they must close the gap.
  const archivedDue = overview.customers.filter((x) => !liveIds.has(x.id)).reduce((s, x) => s + paise(x.amount), 0);
  if (paise(directory.summary.due) + archivedDue !== paise(overview.toCollect)) problems.push(`directory due ₹${directory.summary.due} + archived ₹${archivedDue / 100} vs dashboard ₹${overview.toCollect}`);

  // Invoices: app figures against independent SQL.
  const invoices = (await models.Invoice.findAll({ where: { is_archived: false } })).map((x) => x.toJSON());
  const money = await invoiceMoneyFor(models, invoices, today);
  const sqlPaid = Object.fromEntries((await q(`
    SELECT i.id,
      COALESCE((SELECT SUM(CASE WHEN p.payment_type = 'REFUND' THEN -p.amount ELSE p.amount END)
                FROM payments p JOIN orders o ON o.id = p.order_id
                WHERE o.invoice_id = i.id AND p.payment_type <> 'ADVANCE'), 0)
      + COALESCE((SELECT SUM(CASE WHEN adv.amount > 0 THEN adv.amount ELSE COALESCE(o.advance_received, 0) END)
                  FROM orders o CROSS JOIN LATERAL (SELECT COALESCE(SUM(p.amount), 0) AS amount FROM payments p
                                                    WHERE p.order_id = o.id AND p.payment_type = 'ADVANCE') adv
                  WHERE o.invoice_id = i.id), 0)
      + COALESCE((SELECT SUM(CASE WHEN p.payment_type = 'REFUND' THEN -p.amount ELSE p.amount END)
                  FROM payments p WHERE p.invoice_id = i.id AND p.order_id IS NULL), 0) AS paid
    FROM invoices i WHERE NOT i.is_archived`)).map((r) => [r.id, paise(r.paid)]));
  const derived = { PENDING: 0, OVERDUE: 0, PAID: 0, CANCELLED: 0 };
  let storedPendingNowPaid = 0;
  const taxed = [];
  for (const inv of invoices) {
    const m = money.get(inv.id);
    derived[m.derivedStatus] += 1;
    if (inv.status === "PENDING" && m.derivedStatus === "PAID") storedPendingNowPaid += 1;
    if (Number(inv.tax_amount) > 0) taxed.push({ number: inv.invoice_number, finalAmount: Number(inv.final_amount), amountDue: m.amountDue });
    if (paise(m.amountPaid) !== sqlPaid[inv.id]) problems.push(`invoice ${inv.invoice_number}: paid ₹${m.amountPaid} vs SQL ₹${sqlPaid[inv.id] / 100}`);
  }
  const doubleInvoicedOrders = (await q(`
    SELECT ii.order_id FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
    WHERE NOT i.is_archived AND i.status <> 'CANCELLED' AND ii.order_id IS NOT NULL
    GROUP BY ii.order_id HAVING COUNT(DISTINCT ii.invoice_id) > 1`)).map((r) => r.order_id);
  if (doubleInvoicedOrders.length) problems.push(`${doubleInvoicedOrders.length} order(s) on more than one active invoice — their payments would count twice`);

  return {
    ok: problems.length === 0,
    problems,
    summary: { asOf: today, sales: all.sales.value, collected: all.collected.value, toCollect: overview.toCollect, credit: overview.credit,
               customersOwing: overview.customersOwing, aging: overview.aging, expenses: all.expenses.value,
               unlinkedPayments: all.excluded.unlinkedPayments, deletedOrderPayments: all.excluded.deletedOrderPayments,
               lists: { ordersDue: list.summary.due, ordersTotal: list.summary.total, directoryDue: directory.summary.due, archivedCustomersDue: archivedDue / 100 },
               invoices: { count: invoices.length, derived, storedPendingNowPaid, taxed, doubleInvoicedOrders } },
  };
};

if (require.main === module) {
  const models = require("../src/models");
  verifyDashboard(models.sequelize, models)
    .then((r) => {
      console.log(JSON.stringify(r.summary, null, 2));
      if (r.ok) console.log("✅ Dashboard figures agree with independent SQL.");
      else console.error(`❌ ${r.problems.length} problem(s):\n${r.problems.join("\n")}`);
      return models.sequelize.close().then(() => process.exit(r.ok ? 0 : 1));
    })
    .catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { verifyDashboard };
