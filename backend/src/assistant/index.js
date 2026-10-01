"use strict";

const { runAgent } = require("./agentLoop");
const { getChain } = require("./llm");
const { allTools, toolsFor } = require("./toolset");
const { areasFor } = require("./router");
const { linksAreKnown } = require("./links");
const { executeTool } = require("./tools/executeTool");
const { buildSystemPrompt } = require("./prompt/buildSystemPrompt");
const { fitHistory } = require("./history");
const { HISTORY_BUDGET } = require("./config");
const { ACTIONS } = require("./actionKit/registry");
const { todayIST } = require("../services/dashboard/dateRanges");

/**
 * Answer one message. `history`: saved messages, oldest first, the new question
 * last. `ctx`: { conversationId, userId, requestText } — what a proposal records.
 * `deps` replaces the model stream, tools, prompt or open areas in tests and evals.
 */
const runAssistant = async (history, { onDelta, onStatus, onAction }, ctx = {}, deps = {}) => {
  const every = deps.tools || allTools();
  const fitted = fitHistory(history, HISTORY_BUDGET);
  // The switchboard: areas the question's words point at start open; Sage opens others with open_area.
  const open = new Set(deps.openAreas || areasFor(fitted[fitted.length - 1]?.content));
  const current = () => toolsFor(open, every);
  // The person's recent words: a card may only use names and numbers from them.
  const words = { ...ctx, userText: history.filter((m) => m.role === "user").slice(-3).map((m) => m.content).join("\n") };
  return runAgent({
    system: deps.system ?? buildSystemPrompt({ today: todayIST(), actions: deps.actions || ACTIONS }),
    history: fitted,
    tools: () => current().map((t) => t.declaration),
    stream: deps.stream || ((request) => getChain().stream(request)),
    executeTool: async (call) => {
      const out = await executeTool(current(), call, words);
      if (out.openArea) open.add(out.openArea);
      return out;
    },
    onDelta,
    onStatus,
    onAction,
    validate: linksAreKnown(),
  });
};

module.exports = { runAssistant };
