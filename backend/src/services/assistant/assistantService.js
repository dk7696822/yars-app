"use strict";

const { loadKnowledge } = require("./knowledgeLoader");
const { runQuery: dbRunQuery } = require("./assistantDb");
const { runAgent: runAgentLoop, MAX_ROUNDS } = require("./agentLoop");
const { getChain } = require("../../assistant/llm");
const { QuotaExhaustedError, formatWait } = require("../../assistant/chain");

// Neutral (lowercase JSON-Schema) tool declarations — adapters translate.
const FUNCTION_DECLARATIONS = [
  {
    name: "run_query",
    description:
      "Run a single read-only SQL SELECT against the YARS Postgres database. " +
      "Use the schema in your instructions. Results come back as JSON " +
      "{rowCount, rows}, capped at 200 rows.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "One SELECT (or WITH…SELECT) statement, no comments." },
      },
      required: ["query"],
    },
  },
];

/**
 * @param {Array<{role: 'user'|'assistant', content: string}>} history - persisted messages, oldest first (last one is the new user message)
 * @param {{onDelta: Function, onStatus: Function}} callbacks
 * @param {{stream?: Function, runQuery?: Function, system?: string}} deps - injected in tests
 * @returns {Promise<string>} the final assistant text
 */
const runAgent = async (history, { onDelta, onStatus }, deps = {}) => {
  const runQuery = deps.runQuery || dbRunQuery;
  return runAgentLoop({
    system: deps.system ?? loadKnowledge(),
    history,
    tools: FUNCTION_DECLARATIONS,
    stream: deps.stream || ((req) => getChain().stream(req)),
    executeTool: (tc) => runQuery(tc.args.query),
    onDelta,
    onStatus,
  });
};

module.exports = { runAgent, MAX_ROUNDS, FUNCTION_DECLARATIONS, QuotaExhaustedError, formatWait };
