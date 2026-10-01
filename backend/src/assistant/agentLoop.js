"use strict";

const { MAX_ROUNDS } = require("./config");

const STATUS = {
  dues: "Checking dues…",
  customer_summary: "Looking up the customer…",
  period_summary: "Adding up the period…",
  find: "Looking that up…",
  open_area: "Reading up on that…",
  run_query: "Looking at the data…",
};
const statusFor = (name) => STATUS[name] || (String(name).startsWith("propose_") ? "Preparing a card…" : "Working…");

/**
 * Stream a model turn, run its tool calls, feed the results back, repeat.
 * Neutral messages: {role:'user', content} · {role:'assistant', content, toolCalls?} · {role:'tool', results}.
 * `tools` is the declarations, or a function giving them (re-read every round, so
 * an area opened in one round is available in the next).
 * `executeTool(call)` resolves to { text, action? }; a card goes to onAction.
 */
const runAgent = async ({ system, history, tools, stream, executeTool, onDelta, onStatus, onAction = () => {}, maxRounds = MAX_ROUNDS }) => {
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  let finalText = "";

  for (let round = 0; round <= maxRounds; round += 1) {
    const allowTools = round < maxRounds;
    let roundText = "";
    const calls = [];
    const declarations = typeof tools === "function" ? tools() : tools;
    for await (const chunk of stream({ system, messages, tools: allowTools ? declarations : undefined })) {
      if (chunk.text) {
        roundText += chunk.text;
        onDelta(chunk.text);
      }
      if (chunk.toolCalls) calls.push(...chunk.toolCalls);
    }

    finalText += roundText; // text before a tool call is part of the answer
    if (calls.length === 0) return finalText || "I couldn't come up with an answer — please try rephrasing.";

    messages.push({ role: "assistant", content: roundText, toolCalls: calls });
    const results = [];
    for (const call of calls) {
      onStatus(statusFor(call.name));
      const out = await executeTool(call);
      if (out.action) onAction(out.action);
      results.push({ id: call.id, name: call.name, result: out.text });
    }
    messages.push({ role: "tool", results });
  }
  return finalText || "I couldn't finish that — please try rephrasing.";
};

module.exports = { runAgent };
