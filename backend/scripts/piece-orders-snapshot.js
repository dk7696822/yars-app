#!/usr/bin/env node
"use strict";

/**
 * READ-ONLY rollout check for the piece-orders migration.
 *
 *   NODE_ENV=production node scripts/piece-orders-snapshot.js --mode before --out ~/yars-snap-before.json
 *   (run migration)
 *   NODE_ENV=production node scripts/piece-orders-snapshot.js --mode after  --out ~/yars-snap-after.json
 *   node scripts/piece-orders-snapshot.js --compare ~/yars-snap-before.json ~/yars-snap-after.json
 *
 * "before" computes totals with the pre-pieces formula; "after" with the new
 * shared orderMath. On kg-only data every value must be identical.
 */

const fs = require("fs");
const { orderTotal, paymentPosition } = require("../src/services/orderMath");

// The pre-pieces formula, copied verbatim from orderController (2026-09-30).
const legacyTotals = (order) => {
  let totalProductAmount = 0;
  order.orderProductSizes.forEach((ops) => {
    totalProductAmount += parseFloat(ops.quantity_kg) * parseFloat(ops.rate_per_kg || ops.productSize.rate_per_kg);
  });
  const plateCharge = parseFloat(order.custom_plate_charge || order.plateType?.charge || 0);
  const total = totalProductAmount + plateCharge - parseFloat(order.round_off_amount || 0);
  const advance = order.payments.filter((p) => p.payment_type === "ADVANCE");
  const other = order.payments.filter((p) => p.payment_type !== "ADVANCE");
  const totalPaid = other.reduce((s, p) => s + parseFloat(p.amount), 0);
  const advanceFromPayments = advance.reduce((s, p) => s + parseFloat(p.amount), 0);
  const advanceReceived = advanceFromPayments > 0 ? advanceFromPayments : parseFloat(order.advance_received || 0);
  return { total, remaining: total - totalPaid - advanceReceived };
};

const newTotals = (order) => {
  const total = orderTotal(order);
  return { total, remaining: paymentPosition(order, total).remaining };
};

const takeSnapshot = async (sequelize, mode) => {
  const q = (sql) => sequelize.query(sql).then(([rows]) => rows);

  if (mode === "after") {
    const [{ n }] = await q(`SELECT COUNT(*)::int AS n FROM order_product_sizes WHERE unit <> 'KG'`);
    if (n > 0) throw new Error(`${n} pieces lines exist — a before/after comparison is only meaningful right after migrating`);
  }

  const orders = await q(`SELECT o.id, o.custom_plate_charge, o.round_off_amount, o.advance_received, o.is_archived, pt.charge AS plate_charge
                          FROM orders o LEFT JOIN plate_types pt ON pt.id = o.plate_type_id ORDER BY o.id`);
  const lines = await q(`SELECT ops.id, ops.order_id, ops.product_size_id, ops.quantity_kg, ops.rate_per_kg, ps.rate_per_kg AS size_rate
                         FROM order_product_sizes ops JOIN product_sizes ps ON ps.id = ops.product_size_id ORDER BY ops.id`);
  const payments = await q(`SELECT id, order_id, amount, payment_type FROM payments ORDER BY id`);

  const compute = mode === "before" ? legacyTotals : newTotals;
  const orderRows = orders.map((o) => {
    const order = {
      custom_plate_charge: o.custom_plate_charge,
      round_off_amount: o.round_off_amount,
      advance_received: o.advance_received,
      plateType: { charge: o.plate_charge },
      orderProductSizes: lines
        .filter((l) => l.order_id === o.id)
        .map((l) => ({ unit: "KG", quantity_kg: l.quantity_kg, rate_per_kg: l.rate_per_kg, productSize: { rate_per_kg: l.size_rate } })),
      payments: payments.filter((p) => p.order_id === o.id),
    };
    const { total, remaining } = compute(order);
    const kg = order.orderProductSizes.reduce((s, l) => s + parseFloat(l.quantity_kg || 0), 0);
    return { id: o.id, is_archived: o.is_archived, total: total.toFixed(2), remaining: remaining.toFixed(2), kg: kg.toFixed(2) };
  });

  return {
    orders: orderRows,
    lines: lines.map(({ id, order_id, product_size_id, quantity_kg, rate_per_kg }) => ({ id, order_id, product_size_id, quantity_kg, rate_per_kg })),
    payments,
    sizes: await q(`SELECT id, size_label, rate_per_kg, is_archived FROM product_sizes ORDER BY id`),
    invoices: await q(`SELECT id, invoice_number, total_amount, tax_percent, tax_amount, final_amount, status, is_archived FROM invoices ORDER BY id`),
    invoiceItems: await q(`SELECT id, invoice_id, order_id, description, quantity, unit_price, total_price FROM invoice_items ORDER BY id`),
  };
};

const compareSnapshots = (a, b) => {
  const diffs = [];
  for (const key of Object.keys(a)) {
    const left = a[key];
    const right = b[key] || [];
    if (left.length !== right.length) diffs.push(`${key}: ${left.length} rows before, ${right.length} after`);
    const byId = new Map(right.map((r) => [r.id, r]));
    for (const row of left) {
      const other = byId.get(row.id);
      if (!other) { diffs.push(`${key} ${row.id}: missing after`); continue; }
      for (const field of Object.keys(row)) {
        if (JSON.stringify(row[field]) !== JSON.stringify(other[field])) {
          diffs.push(`${key} ${row.id}.${field}: ${JSON.stringify(row[field])} → ${JSON.stringify(other[field])}`);
        }
      }
    }
  }
  return diffs;
};

const main = async () => {
  const args = process.argv.slice(2);
  if (args[0] === "--compare") {
    const [a, b] = [args[1], args[2]].map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
    const diffs = compareSnapshots(a, b);
    if (diffs.length) {
      console.error(`❌ ${diffs.length} difference(s):\n${diffs.slice(0, 50).join("\n")}`);
      process.exit(1);
    }
    console.log(`✅ Identical: ${a.orders.length} orders, ${a.lines.length} lines, ${a.invoices.length} invoices, ${a.invoiceItems.length} invoice items, ${a.sizes.length} sizes.`);
    return;
  }
  const mode = args[args.indexOf("--mode") + 1];
  const out = args[args.indexOf("--out") + 1];
  if (!["before", "after"].includes(mode) || !out) throw new Error("Usage: --mode before|after --out FILE  |  --compare A B");
  const { sequelize } = require("../src/models");
  const snapshot = await takeSnapshot(sequelize, mode);
  fs.writeFileSync(out, JSON.stringify(snapshot, null, 2));
  console.log(`Wrote ${mode} snapshot (${snapshot.orders.length} orders) to ${out}`);
  await sequelize.close();
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { takeSnapshot, compareSnapshots };
