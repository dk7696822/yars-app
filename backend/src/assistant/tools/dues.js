"use strict";

const { z } = require("zod");
const models = require("../../models");
const { defineTool } = require("./defineTool");
const { loadLedger } = require("../../services/dashboard/ledger");
const { computeOverview } = require("../../services/dashboard/metrics");
const { todayIST } = require("../../services/dashboard/dateRanges");
const { rupee, capLines } = require("../format");

module.exports = defineTool({
  name: "dues",
  description: "Money customers owe right now, as on the dashboard: total to collect, credit, and each customer owing (largest first).",
  input: z.object({}),
  run: async () => {
    const o = computeOverview(await loadLedger(models), todayIST());
    const head = `To collect ${rupee(o.toCollect)} from ${o.customersOwing} customers (${o.ordersOwing} orders). Paid extra (credit) ${rupee(o.credit)}.`;
    const lines = [...o.customers]
      .sort((a, b) => b.amount - a.amount)
      .map((c) => `${c.id} | ${c.name} | ${rupee(c.amount)} | ${c.orders} orders | oldest unpaid ${c.oldestOrderDate} (${c.oldestDays} days)`);
    return [head, ...capLines(lines, 20)].join("\n");
  },
});
