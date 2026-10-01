"use strict";

const { z } = require("zod");
const models = require("../../models");
const { defineTool } = require("./defineTool");
const { isoDate } = require("./fields");
const { loadLedger } = require("../../services/dashboard/ledger");
const { computePeriod } = require("../../services/dashboard/metrics");
const { todayIST, resolvePeriod, PeriodError } = require("../../services/dashboard/dateRanges");
const { rupee } = require("../format");

const prev = (x) => (x === null || x === undefined ? "" : ` (previous ${rupee(x)})`);

module.exports = defineTool({
  name: "period_summary",
  description: "Sales, money collected, kg sold and expenses for a period, as on the dashboard. preset this_month, last_month, this_fy, all, or custom with from and to.",
  input: z.object({ preset: z.enum(["this_month", "last_month", "this_fy", "all", "custom"]), from: isoDate().optional(), to: isoDate().optional() }),
  run: async ({ preset, from, to }) => {
    const ledger = await loadLedger(models);
    let period;
    try {
      period = resolvePeriod({ preset, from, to }, todayIST(), ledger.earliest, ledger.latest);
    } catch (err) {
      if (err instanceof PeriodError) return err.message;
      throw err;
    }
    const p = computePeriod(ledger, period.range, period.compare);
    const v = p.volume;
    return [
      `${p.range.label}: ${p.range.from} to ${p.range.to}` + (p.compare ? `; previous period ${p.compare.from} to ${p.compare.to}` : ""),
      `Sales ${rupee(p.sales.value)}${prev(p.sales.previous)} from ${p.sales.orders} orders`,
      `Collected ${rupee(p.collected.value)}${prev(p.collected.previous)} in ${p.collected.payments} payments`,
      `Sold ${v.kgSold} kg` + (v.piecesTotal ? ` and ${v.piecesTotal} pcs` : "") + (v.piecesWithoutWeight ? ` (${v.piecesWithoutWeight} pcs have no weight, so they are not in the kg)` : ""),
      `Expenses ${rupee(p.expenses.value)}${prev(p.expenses.previous)}` +
        (p.expenses.byCategory.length ? `: ${p.expenses.byCategory.slice(0, 6).map((c) => `${c.name} ${rupee(c.amount)}`).join(", ")}` : ""),
      p.excluded.cancelled.count ? `Not counted: ${p.excluded.cancelled.count} cancelled orders (${rupee(p.excluded.cancelled.amount)})` : null,
    ].filter(Boolean).join("\n");
  },
});
