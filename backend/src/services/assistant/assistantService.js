"use strict";

const { loadKnowledge } = require("./knowledgeLoader");
const { runQuery: dbRunQuery } = require("./assistantDb");
const { runAgent: runAgentLoop, MAX_ROUNDS } = require("./agentLoop");
const { createChain, QuotaExhaustedError, formatWait } = require("./providerChain");
const { GeminiProvider } = require("./providers/geminiProvider");
const { OpenAiCompatProvider } = require("./providers/openaiCompatProvider");

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

// Failover order, best first. Gemini models are the strongest (and best at
// Hindi/Hinglish) but have tiny free daily caps; Mistral and Groq are
// independent free quota pools. Groq sits late in the chain because its
// free tier allows only ~12k tokens/minute on llama-3.3-70b — barely one
// request with our ~11k-token knowledge base (its other models allow less
// than one request and are unusable). Providers without an API key are
// simply left out of the chain.
const buildEntries = () => {
  const entries = [];
  if (process.env.GEMINI_API_KEY) {
    const gemini = new GeminiProvider();
    for (const model of ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.0-flash"]) {
      entries.push({ label: `gemini:${model}`, provider: gemini, model });
    }
  }
  const mistral = process.env.MISTRAL_API_KEY
    ? new OpenAiCompatProvider({ key: "mistral", baseUrl: "https://api.mistral.ai/v1", apiKeyEnv: "MISTRAL_API_KEY" })
    : null;
  if (mistral) entries.push({ label: "mistral:small-latest", provider: mistral, model: "mistral-small-latest" });
  if (process.env.GROQ_API_KEY) {
    const groq = new OpenAiCompatProvider({ key: "groq", baseUrl: "https://api.groq.com/openai/v1", apiKeyEnv: "GROQ_API_KEY" });
    entries.push({ label: "groq:llama-3.3-70b", provider: groq, model: "llama-3.3-70b-versatile" });
  }
  // Shares Mistral's account quota with small-latest, so it mostly matters
  // when small-latest itself misbehaves — but it costs nothing to keep.
  if (mistral) entries.push({ label: "mistral:nemo", provider: mistral, model: "open-mistral-nemo" });
  return entries;
};

// Module-level singleton: cooldown state must survive across requests.
let chain = null;
const getChain = () => {
  if (!chain) {
    const entries = buildEntries();
    if (entries.length === 0) {
      // Without this, an unconfigured deploy would masquerade as "quota exhausted".
      console.error("assistant: no provider API keys configured (GEMINI/MISTRAL/GROQ_API_KEY)");
    }
    chain = createChain(entries);
  }
  return chain;
};

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
