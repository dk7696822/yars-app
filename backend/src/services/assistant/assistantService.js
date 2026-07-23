"use strict";

const { GoogleGenAI, Type } = require("@google/genai");
const { loadKnowledge } = require("./knowledgeLoader");
const { runQuery: dbRunQuery } = require("./assistantDb");

// Fallback chain, best first. Free-tier daily caps on the top Flash model are
// tiny (~20 requests/day); the lite/older models have much higher caps and are
// still fine for SQL + walkthrough answers. On a quota error (429) we step down
// and remember the working model for a while (aliases only — versioned IDs get
// gated off for new Google projects).
const MODELS = [
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-2.0-flash",
];
const STICKY_MS = 10 * 60 * 1000; // retry the better models again after 10 min

let preferredIndex = 0;
let downgradedAt = 0;
// When EVERY model in the chain is quota-exhausted we stop calling Gemini
// entirely until this timestamp — burning requests against a known-exhausted
// quota only wastes what little resets.
let chainExhaustedUntil = 0;

class QuotaExhaustedError extends Error {
  constructor(retryAfterSeconds) {
    super("Gemini quota exhausted on all models");
    this.name = "QuotaExhaustedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Google 429s usually carry RetryInfo like `"retryDelay": "37s"`.
const parseRetrySeconds = (err) => {
  const m = String(err?.message).match(/retryDelay[^0-9]*(\d+)/i);
  return m ? Math.max(parseInt(m[1], 10), 30) : 120;
};

const formatWait = (seconds) => {
  if (seconds < 90) return "a minute";
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} minutes`;
  const hours = Math.ceil(seconds / 3600);
  return hours === 1 ? "an hour" : `${hours} hours`;
};
const MAX_ROUNDS = 6;

const FUNCTION_DECLARATIONS = [
  {
    name: "run_query",
    description:
      "Run a single read-only SQL SELECT against the YARS Postgres database. " +
      "Use the schema in your instructions. Results come back as JSON " +
      "{rowCount, rows}, capped at 200 rows.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "One SELECT (or WITH…SELECT) statement, no comments." },
      },
      required: ["query"],
    },
  },
];

let ai = null;
const getAi = () => {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
};

const isQuotaError = (err) =>
  err?.status === 429 || err?.code === 429 || /RESOURCE_EXHAUSTED|429/.test(String(err?.message));

// Real Gemini stream, matching the injectable interface used in tests.
// Tries the model chain from the current preferred model; steps down on quota
// errors. Quota errors can only surface at request time (before streaming), so
// a mid-stream failure is never silently retried on another model.
async function* realGenerateStream({ contents, allowTools }) {
  if (Date.now() < chainExhaustedUntil) {
    throw new QuotaExhaustedError(Math.ceil((chainExhaustedUntil - Date.now()) / 1000));
  }
  if (preferredIndex > 0 && Date.now() - downgradedAt > STICKY_MS) {
    preferredIndex = 0; // periodically try the better models again
  }

  let stream = null;
  let lastErr = null;
  for (let i = preferredIndex; i < MODELS.length; i += 1) {
    try {
      stream = await getAi().models.generateContentStream({
        model: MODELS[i],
        contents,
        config: {
          systemInstruction: loadKnowledge(),
          tools: allowTools ? [{ functionDeclarations: FUNCTION_DECLARATIONS }] : undefined,
        },
      });
      preferredIndex = i;
      break;
    } catch (err) {
      lastErr = err;
      if (!isQuotaError(err)) throw err;
      if (i === MODELS.length - 1) {
        // Whole chain exhausted — cool down and tell the user how long.
        const retry = parseRetrySeconds(err);
        chainExhaustedUntil = Date.now() + retry * 1000;
        console.warn(`assistant: all models quota-exhausted, cooling down ${retry}s`);
        throw new QuotaExhaustedError(retry);
      }
      console.warn(`assistant: ${MODELS[i]} quota exhausted, falling back to ${MODELS[i + 1]}`);
      preferredIndex = i + 1;
      downgradedAt = Date.now();
    }
  }
  if (!stream) throw lastErr;
  for await (const chunk of stream) {
    // parts carries the raw content parts (incl. thoughtSignature) — newer
    // Gemini models reject the follow-up request unless the model turn is
    // echoed back verbatim, signatures included.
    yield {
      text: chunk.text,
      functionCalls: chunk.functionCalls,
      parts: chunk.candidates?.[0]?.content?.parts,
    };
  }
}

/**
 * @param {Array<{role: 'user'|'assistant', content: string}>} history - persisted messages, oldest first (last one is the new user message)
 * @param {{onDelta: Function, onStatus: Function}} callbacks
 * @param {{generateStream?: Function, runQuery?: Function}} deps - injected in tests
 * @returns {Promise<string>} the final assistant text
 */
const runAgent = async (history, { onDelta, onStatus }, deps = {}) => {
  const generateStream = deps.generateStream || realGenerateStream;
  const runQuery = deps.runQuery || dbRunQuery;

  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let finalText = "";

  for (let round = 0; round <= MAX_ROUNDS; round += 1) {
    const allowTools = round < MAX_ROUNDS;
    let roundText = "";
    const calls = [];
    const roundParts = [];

    for await (const chunk of generateStream({ contents, allowTools })) {
      if (chunk.text) {
        roundText += chunk.text;
        onDelta(chunk.text);
      }
      if (chunk.functionCalls) calls.push(...chunk.functionCalls);
      if (chunk.parts) roundParts.push(...chunk.parts);
    }

    if (calls.length === 0) {
      finalText += roundText;
      return finalText;
    }

    // Text emitted before a tool call is preamble — keep it in the final answer.
    finalText += roundText;

    // Echo the model turn back VERBATIM when we have the raw parts (they carry
    // thought signatures the API requires); fall back to reconstruction for
    // injected test streams that don't provide parts.
    contents.push({
      role: "model",
      parts: roundParts.length
        ? roundParts
        : [
            ...(roundText ? [{ text: roundText }] : []),
            ...calls.map((fc) => ({ functionCall: { name: fc.name, args: fc.args } })),
          ],
    });

    onStatus("Looking at the database…");

    const responseParts = [];
    for (const fc of calls) {
      let result;
      try {
        result = await runQuery(fc.args.query);
      } catch (err) {
        result = JSON.stringify({ error: err.message });
      }
      responseParts.push({
        functionResponse: {
          name: fc.name,
          response: { result },
          ...(fc.id ? { id: fc.id } : {}),
        },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return finalText || "I could not finish answering that — please try rephrasing.";
};

module.exports = { runAgent, MAX_ROUNDS, FUNCTION_DECLARATIONS, QuotaExhaustedError, formatWait };
