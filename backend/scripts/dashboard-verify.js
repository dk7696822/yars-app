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

const paise = (x) => Math.round(Number(x) * 100);

const canonicalPending = () => {
  const md = fs.readFileSync(path.join(__dirname, "../knowledge/schema.md"), "utf8");
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

  return {
    ok: problems.length === 0,
    problems,
    summary: { asOf: today, sales: all.sales.value, collected: all.collected.value, toCollect: overview.toCollect, credit: overview.credit,
               customersOwing: overview.customersOwing, aging: overview.aging, expenses: all.expenses.value,
               unlinkedPayments: all.excluded.unlinkedPayments, deletedOrderPayments: all.excluded.deletedOrderPayments },
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
