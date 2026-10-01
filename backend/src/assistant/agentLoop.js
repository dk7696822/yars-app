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
 * Text is sent to onDelta one round at a time, after the broken-reply check;
 * `validate(text)` adds the caller's own check (e.g. links must be real screens).
 */
const FALLBACK = "I couldn't come up with an answer — please try rephrasing.";
const ASK_AGAIN = "(That reply came out garbled and was not shown. Answer the person again in plain words, or call a tool.)";

/**
 * Free models sometimes leak their reasoning, raw tool markup or a tool call
 * written as text, loop on one word, or claim a card that was never made.
 * Such a round is never shown: the model is asked once more instead.
 */
const LEAK = /<tool_call>|<function=|<\|channel\|>|^\s*analysis\b|\bassistant(?:commentary|final)\b|\bto=functions\.|\b(?:propose_\w+|open_area|run_query|customer_summary|period_summary)\b/i;
const LOOP = /\b(\w+)\b(?:\W+\1\b){5,}/i;
// "tap Confirm on the card" when no card exists; a how-to's "tap Confirm to save" is fine.
const CLAIMS_CARD = (text) => /\btap\W{0,3}confirm/i.test(text) && /\bcards?\b/i.test(text);
const isBroken = (text, cardsShown, validate) => LEAK.test(text) || LOOP.test(text) || (CLAIMS_CARD(text) && cardsShown === 0) || !validate(text);

const runAgent = async ({ system, history, tools, stream, executeTool, onDelta, onStatus, onAction = () => {}, maxRounds = MAX_ROUNDS, validate = () => true }) => {
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  let finalText = "";
  // A card still pending from earlier in the conversation may be pointed to.
  let cardsShown = history.some((m) => /\[card: .* — pending\]/.test(m.content)) ? 1 : 0;
  let retried = false;

  for (let round = 0; round <= maxRounds; round += 1) {
    const allowTools = round < maxRounds;
    let roundText = "";
    const calls = [];
    const declarations = typeof tools === "function" ? tools() : tools;
    for await (const chunk of stream({ system, messages, tools: allowTools ? declarations : undefined })) {
      if (chunk.text) roundText += chunk.text;
      if (chunk.toolCalls) calls.push(...chunk.toolCalls);
    }

    // A round's text is shown only once it is known to be clean.
    if (roundText && isBroken(roundText, cardsShown, validate)) {
      console.warn("assistant: hid a broken reply:", (process.env.ASSISTANT_DEBUG ? roundText : roundText.slice(0, 300)).replace(/\s+/g, " "));
      if (calls.length === 0) {
        if (retried) return finalText || FALLBACK;
        retried = true;
        messages.push({ role: "user", content: ASK_AGAIN });
        continue;
      }
      roundText = ""; // garbled preamble before real tool calls: drop it, keep the calls
    }
    if (roundText) {
      onDelta(roundText);
      finalText += roundText; // text before a tool call is part of the answer
    }
    if (calls.length === 0) return finalText || FALLBACK;

    messages.push({ role: "assistant", content: roundText, toolCalls: calls });
    const results = [];
    for (const call of calls) {
      onStatus(statusFor(call.name));
      const out = await executeTool(call);
      if (out.action) {
        cardsShown += 1;
        onAction(out.action);
      }
      results.push({ id: call.id, name: call.name, result: out.text });
    }
    messages.push({ role: "tool", results });
  }
  return finalText || "I couldn't finish that — please try rephrasing.";
};

module.exports = { runAgent };
