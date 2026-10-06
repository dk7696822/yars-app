"use strict";

const { MAX_ROUNDS } = require("./config");

const STATUS = {
  dues: "Checking dues…",
  customer_summary: "Looking up the customer…",
  period_summary: "Adding up the period…",
  list_orders: "Listing orders…",
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
const CUT_OFF = "(That reply was cut off by the length limit and was not shown. Answer again shorter: the totals and at most 10 rows, then link the screen for the rest.)";

/**
 * Free models sometimes leak their reasoning, raw tool markup or a tool call
 * written as text, loop on one word, or claim a card that was never made.
 * Such a round is never shown: the model is asked once more instead.
 */
const LEAK = /<tool_call>|<function=|<\|channel\|>|^\s*analysis(?::|\s{2,}|\s+(?:the user|we need|we should|let me|let's|i need|i should)\b)|\bassistant(?:commentary|final)\b|\bto=functions\.|\b(?:propose_\w+|open_area|run_query|customer_summary|period_summary)\b/i;
// A word of 3+ letters six times in a row; table rows and list items repeat legitimately.
const LOOP_WORDS = /\b([a-z][a-z0-9]{2,})\b(?:\W+\1\b){5,}/i;
const LOOP = { test: (text) => LOOP_WORDS.test(text.split("\n").filter((l) => !/\||^\s*(?:[-*•]|\d+[.)])\s/.test(l)).join("\n")) };
// "tap Confirm on the card" when no card exists; a how-to's "tap Confirm to save" is fine.
const CLAIMS_CARD = (text) => /\btap\W{0,3}confirm/i.test(text) && /\bcards?\b/i.test(text);
// A record id shown to the person (outside a link's address).
// Models often write ids with non-breaking or other dashes (U+2010–U+2015, U+2212).
const D = "[-\\u2010-\\u2015\\u2212]";
const ID_PATTERN = new RegExp(`[0-9a-f]{8}${D}[0-9a-f]{4}${D}[0-9a-f]{4}${D}[0-9a-f]{4}${D}[0-9a-f]{12}`, "i");
const RAW_ID = (text) => ID_PATTERN.test(text.replace(/\]\([^)]*\)/g, "]"));
// After a card in this answer, "order created" / "has been saved" is false: nothing is saved
// before Confirm. Conditional sentences ("once you tap Confirm it is recorded") are fine.
const DONE_WORDS = /\b(?:is|has been|was|been|now)\s+(?:saved|created|recorded|added|updated|done)\b|\b(?:order|payment|customer|status)\s+(?:created|saved|recorded|added|updated)\b/i;
const CONDITIONAL = /\b(?:until|once|after|when|before|if|will)\b/i;
const SAYS_DONE = { test: (text) => text.split(/(?<=[.!?])\s+|\n+/).some((s) => DONE_WORDS.test(s) && !CONDITIONAL.test(s)) };
const isBroken = (text, cardsShown, validate, cardsThisAnswer = 0) =>
  LEAK.test(text) || LOOP.test(text) || RAW_ID(text) || (CLAIMS_CARD(text) && cardsShown === 0) ||
  (cardsThisAnswer > 0 && SAYS_DONE.test(text)) || !validate(text);

const runAgent = async (opts) => {
  // Whatever the run ends with, the person sees it: a fallback is streamed like any answer.
  let streamed = "";
  const onDelta = (t) => {
    streamed += t;
    opts.onDelta(t);
  };
  const final = await runRounds({ ...opts, onDelta });
  if (!streamed) onDelta(final); // nothing shown yet: the fallback is the answer
  return final;
};

const runRounds = async ({ system, history, tools, stream, executeTool, onDelta, onStatus, onAction = () => {}, maxRounds = MAX_ROUNDS, validate = () => true }) => {
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  let finalText = "";
  // A card from earlier in the conversation may be pointed to.
  let cardsShown = history.some((m) => /\[card: .* — \w+\]/.test(m.content)) ? 1 : 0;
  let retried = false;
  let cardsThisAnswer = 0;

  for (let round = 0; round <= maxRounds; round += 1) {
    const allowTools = round < maxRounds;
    let roundText = "";
    let truncated = false;
    const calls = [];
    const declarations = typeof tools === "function" ? tools() : tools;
    for await (const chunk of stream({ system, messages, tools: allowTools ? declarations : undefined })) {
      if (chunk.text) roundText += chunk.text;
      if (chunk.toolCalls) calls.push(...chunk.toolCalls);
      if (chunk.truncated) truncated = true;
    }

    // A cut-off answer is incomplete: never shown; asked again, shorter.
    if (truncated) {
      console.warn("assistant: hid a cut-off reply");
      if (retried) return finalText || FALLBACK;
      retried = true;
      messages.push({ role: "user", content: CUT_OFF });
      continue;
    }

    // A round's text is shown only once it is known to be clean.
    if (roundText && isBroken(roundText, cardsShown, validate, cardsThisAnswer)) {
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
        cardsThisAnswer += 1;
        onAction(out.action);
      }
      results.push({ id: call.id, name: call.name, result: out.text });
    }
    messages.push({ role: "tool", results });
  }
  return finalText || "I couldn't finish that — please try rephrasing.";
};

module.exports = { runAgent };
