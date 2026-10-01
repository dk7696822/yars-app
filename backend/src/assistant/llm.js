"use strict";

const { OpenAiCompatProvider } = require("./providers/openaiCompat");
const { createChain } = require("./chain");
const { PROVIDERS, MODEL_CHAIN } = require("./config");

/** Chain entries from config, leaving out providers whose key isn't set. */
const buildEntries = (env = process.env) => {
  const providers = {};
  const entries = [];
  for (const { provider, model, options } of MODEL_CHAIN) {
    const def = PROVIDERS[provider](env);
    if (!def.ready) continue;
    providers[provider] = providers[provider] || new OpenAiCompatProvider(def);
    entries.push({ label: `${provider}:${model}`, provider: providers[provider], model, options });
  }
  return entries;
};

// One chain per process: rest periods must survive across requests.
let chain = null;
const getChain = () => {
  if (!chain) {
    const entries = buildEntries();
    if (!entries.length) console.error("assistant: no model keys set (GROQ_API_KEY, or CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN)");
    chain = createChain(entries);
  }
  return chain;
};

module.exports = { buildEntries, getChain };
