#!/usr/bin/env node
"use strict";

/**
 * What happened to Sage's cards: how many were confirmed, cancelled, expired,
 * failed, or finished in the form (and what the person changed there).
 * Read-only. The ones "to look at" become new evals and better guide text.
 *
 *   cd backend && NODE_ENV=production node scripts/assistant-report.js [--since 2026-10-01]
 */
require("dotenv").config();
const { Op } = require("sequelize");
const db = require("../src/models");
const { effectiveStatus } = require("../src/assistant/actionKit/actionService");

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};

const main = async () => {
  const since = arg("--since") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const rows = await db.AssistantAction.findAll({ where: { created_at: { [Op.gte]: since } }, order: [["created_at", "ASC"]] });
  console.log(`Sage cards since ${since}: ${rows.length}\n`);

  const counts = {};
  for (const r of rows) {
    const s = effectiveStatus(r);
    counts[r.name] = counts[r.name] || {};
    counts[r.name][s] = (counts[r.name][s] || 0) + 1;
  }
  for (const [name, byStatus] of Object.entries(counts)) {
    console.log(`${name.padEnd(18)} ${Object.entries(byStatus).map(([s, n]) => `${s} ${n}`).join(" · ")}`);
  }

  const toLook = rows.filter((r) => effectiveStatus(r) !== "confirmed" && effectiveStatus(r) !== "pending");
  if (toLook.length) console.log("\nTo look at (each is a candidate eval):");
  for (const r of toLook) {
    const s = effectiveStatus(r);
    const detail = s === "failed" ? r.error : s === "completed_in_form" ? `changed: ${(r.outcome?.changed || []).join(", ") || "nothing"}` : "";
    console.log(`- ${r.created_at.toISOString().slice(0, 16)} ${r.name} ${s}: "${r.request_text || ""}"${detail ? ` — ${detail}` : ""}`);
  }
  await db.sequelize.close();
};

main().catch(async (err) => {
  console.error(err.message);
  await db.sequelize.close().catch(() => {});
  process.exit(1);
});
