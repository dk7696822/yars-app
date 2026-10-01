"use strict";

const { estimateTokens } = require("./tokens");

/**
 * The newest messages that fit `budgetTokens`. The last message (the new
 * question) is always kept; the result starts with a person's message, as
 * every chat API expects.
 */
const fitHistory = (messages, budgetTokens) => {
  const out = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const cost = estimateTokens(messages[i].content);
    if (out.length && used + cost > budgetTokens) break;
    out.unshift({ role: messages[i].role, content: messages[i].content });
    used += cost;
  }
  while (out.length > 1 && out[0].role !== "user") out.shift();
  return out;
};

/** Each assistant message gets one line per card it showed, so the model knows what was proposed and what happened. */
const withCards = (messages, actions) =>
  messages.map((m) => {
    const cards = actions.filter((a) => a.messageId === m.id);
    const content = cards.length ? `${m.content}\n${cards.map((a) => `[card: ${a.card.title} — ${a.status}]`).join("\n")}` : m.content;
    return { role: m.role, content };
  });

module.exports = { fitHistory, withCards };
