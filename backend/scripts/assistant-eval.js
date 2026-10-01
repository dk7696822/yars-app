#!/usr/bin/env node
"use strict";

/**
 * Ask Sage every eval request, on the local test database, with a real free model,
 * and print what passed. Uses free quota (≈ 6–8k tokens per request).
 *
 *   cd backend && NODE_ENV=test node scripts/assistant-eval.js [--entry groq:openai/gpt-oss-120b] [--only record_payment] [--pause 20] [--gate]
 *
 * --entry  one chain entry only (default: the first configured one)
 * --only   one action's evals ("read" for the read questions)
 * --pause  seconds between requests (default 20: Groq allows 8k tokens a minute)
 * --wait   longest rate-limit rest to wait out on the one model (default 60)
 * --ask    only requests containing this text
 * --effort reasoning_effort to try on this model (low, medium, high; "none" removes it)
 * --gate   exit 1 when fewer than 90 % pass
 */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

if (process.env.NODE_ENV !== "test") {
  console.error("Run with NODE_ENV=test — evals use the local test database only.");
  process.exit(1);
}
// Model keys come from .env, read for those keys only — never its database settings.
const envFile = path.join(__dirname, "../.env");
const fileKeys = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};
for (const k of ["GROQ_API_KEY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]) if (!process.env[k] && fileKeys[k]) process.env[k] = fileKeys[k];

const db = require("../src/models");
const { runAssistant } = require("../src/assistant");
const { allTools } = require("../src/assistant/toolset");
const { buildEntries } = require("../src/assistant/llm");
const { createChain } = require("../src/assistant/chain");
const { ACTIONS } = require("../src/assistant/actionKit/registry");
const { READ_EVALS } = require("./eval/readEvals");
const { seed } = require("./eval/fixture");
const { judge } = require("./eval/judge");

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1] ?? true;
};
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

const main = async () => {
  const entries = buildEntries();
  const label = arg("--entry", entries[0]?.label);
  const entry = entries.find((e) => e.label === label);
  if (!entry) throw new Error(`No configured model "${label}". Configured: ${entries.map((e) => e.label).join(", ") || "none"}`);
  const effort = arg("--effort");
  const options = effort ? (effort === "none" ? {} : { ...(entry.options || {}), reasoning_effort: effort }) : entry.options;
  const chain = createChain([{ ...entry, options }], { maxWaitS: Number(arg("--wait", 60)) });
  const only = arg("--only");
  const ask = arg("--ask");
  const pause = Number(arg("--pause", 20));

  const cases = [
    ...ACTIONS.flatMap((a) => a.evals.map((e) => ({ group: a.name, ...e }))),
    ...READ_EVALS.map((e) => ({ group: "read", ...e })),
  ].filter((c) => (!only || c.group === only) && (!ask || c.ask.toLowerCase().includes(String(ask).toLowerCase())));

  const ids = await seed(db);
  console.log(`Model ${entry.label}${options?.reasoning_effort ? ` (reasoning ${options.reasoning_effort})` : ""} — ${cases.length} requests\n`);
  let passed = 0;
  for (const [i, c] of cases.entries()) {
    if (i) await sleep(pause);
    const calls = [];
    const tools = allTools().map((t) => ({
      ...t,
      run: async (args, ctx) => {
        try {
          const out = await t.run(args, ctx);
          calls.push({ name: t.name, args, ok: true });
          return out;
        } catch (err) {
          calls.push({ name: t.name, args, ok: false });
          throw err;
        }
      },
    }));
    const conversation = await db.AssistantConversation.create({});
    let text;
    try {
      text = await runAssistant([{ role: "user", content: c.ask }], { onDelta: () => {}, onStatus: () => {} },
        { conversationId: conversation.id, requestText: c.ask }, { tools, stream: (req) => chain.stream(req) });
    } catch (err) {
      text = `(failed: ${err.message})`;
    }
    const verdict = judge(c.expect, { calls, text }, ids);
    if (verdict.pass) passed += 1;
    console.log(`${verdict.pass ? "PASS" : "FAIL"}  [${c.group}] ${c.ask}${verdict.pass ? "" : `\n      → ${verdict.why}\n      reply: ${text.slice(0, 200).replace(/\n/g, " ")}`}`);
  }
  const rate = cases.length ? passed / cases.length : 0;
  console.log(`\n${passed}/${cases.length} passed (${Math.round(rate * 100)}%) on ${entry.label}`);
  await db.sequelize.close();
  if (arg("--gate") && rate < 0.9) process.exit(1);
};

main().catch(async (err) => {
  console.error(err.message);
  await db.sequelize.close().catch(() => {});
  process.exit(1);
});
