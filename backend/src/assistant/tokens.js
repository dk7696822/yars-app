"use strict";

/** Rough token count — about 4 characters per token in English. Good enough for budgets. */
const estimateTokens = (text) => Math.ceil(String(text || "").length / 4);

module.exports = { estimateTokens };
