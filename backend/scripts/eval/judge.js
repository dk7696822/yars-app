"use strict";

const at = (obj, dotted) => dotted.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

/** `want` is contained in `got`: numbers compare by value, strings ignore case and spaces at the ends. */
const contains = (want, got) => {
  if (Array.isArray(want)) return Array.isArray(got) && want.every((w, i) => contains(w, got[i]));
  if (want && typeof want === "object") return Boolean(got) && typeof got === "object" && Object.keys(want).every((k) => contains(want[k], got[k]));
  if (typeof want === "number") return Number(got) === want;
  if (typeof want === "string") return typeof got === "string" && got.trim().toLowerCase() === want.trim().toLowerCase();
  return want === got;
};

/**
 * Did one run do what the eval expects?
 * run = { calls: [{ name, args, ok }], text }; ids = fixture name → id.
 */
const judge = (expect, run, ids) => {
  const cards = run.calls.filter((c) => c.name.startsWith("propose_") && c.ok);
  if (expect.action) {
    const tool = `propose_${expect.action}`;
    const mine = cards.filter((c) => c.name === tool);
    const hit = mine.find((c) => contains(expect.args || {}, c.args) && Object.entries(expect.refs || {}).every(([path, name]) => at(c.args, path) === ids[name]));
    if (hit) return { pass: true, why: "" };
    return { pass: false, why: mine.length ? mine.map((c) => `${tool} args ${JSON.stringify(c.args)}`).join("; ") : `no ${tool} card (tools: ${run.calls.map((c) => c.name).join(", ") || "none"})` };
  }
  if (expect.asks) {
    const asked = run.text.includes("?") || /\b(please (tell|share|confirm|let me know|give)|which one|could you)\b/i.test(run.text);
    const pass = cards.length === 0 && asked;
    return { pass, why: pass ? "" : cards.length ? `made a card instead of asking: ${cards[0].name}` : "no question in the answer" };
  }
  if (expect.noAction) {
    const pass = cards.length === 0 && run.text.includes(expect.mentions);
    return { pass, why: pass ? "" : cards.length ? `made a card: ${cards[0].name}` : `answer lacks ${expect.mentions}` };
  }
  if (expect.tool) {
    const pass = run.calls.some((c) => c.name === expect.tool);
    return { pass, why: pass ? "" : `used ${run.calls.map((c) => c.name).join(", ") || "no tool"}` };
  }
  if (expect.mentions) {
    const pass = run.text.includes(expect.mentions);
    return { pass, why: pass ? "" : `answer lacks ${expect.mentions}` };
  }
  return { pass: false, why: "eval has no expectation" };
};

module.exports = { judge, contains };
