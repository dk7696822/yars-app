"use strict";

/** Everything someone might want to change about the assistant, in one place. */

const ASSISTANT_NAME = "Sage";

const MAX_ROUNDS = 6; // model calls per message; tools are withheld on the last
// Groq's free tier allows 8,000 tokens per minute per model (measured 2026-10-01),
// so one round's input stays near 3.5k (core + history + tool results) and a
// two-round answer fits in a minute.
const CORE_BUDGET = 2000; // core instructions + every tool declaration
const GUIDE_BUDGET = 800; // each knowledge guide
const AREA_BUDGET = 1400; // an opened area: its guide + its propose_ tools
const HISTORY_BUDGET = 900; // earlier messages sent with a new question
const TOOL_RESULT_CHARS = 2400; // ≈ 600 tokens per tool result
const ACTION_TTL_MINUTES = 15;
const SHORT_WAIT_S = 8; // a per-minute limit that clears this soon is waited out

/** Each provider from the environment; `ready` is false when its key isn't set. */
const PROVIDERS = {
  groq: (env) => ({
    key: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: env.GROQ_API_KEY,
    ready: Boolean(env.GROQ_API_KEY),
  }),
  cloudflare: (env) => ({
    key: "cloudflare",
    baseUrl: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
    apiKey: env.CLOUDFLARE_API_TOKEN,
    ready: Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN),
  }),
};

/**
 * Failover order, best first. All free; none trains on our data. Each Groq
 * model has its own quota. reasoning_effort "low" halves gpt-oss's hidden
 * reasoning tokens (and its wait) with the same answers in our tests.
 */
const MODEL_CHAIN = [
  { provider: "groq", model: "openai/gpt-oss-120b", options: { reasoning_effort: "low" } },
  { provider: "groq", model: "qwen/qwen3.8-27b" },
  // Cloudflare stops streamed answers at ~512 tokens unless a maximum is given (measured 2026-10-06).
  { provider: "cloudflare", model: "@cf/openai/gpt-oss-120b", options: { reasoning_effort: "low", max_tokens: 2048 } },
  { provider: "groq", model: "openai/gpt-oss-20b", options: { reasoning_effort: "low" } },
];

module.exports = {
  ASSISTANT_NAME, MAX_ROUNDS, CORE_BUDGET, GUIDE_BUDGET, AREA_BUDGET, HISTORY_BUDGET,
  TOOL_RESULT_CHARS, ACTION_TTL_MINUTES, SHORT_WAIT_S, PROVIDERS, MODEL_CHAIN,
};
