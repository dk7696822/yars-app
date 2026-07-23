"use strict";

const { GoogleGenAI, Type } = require("@google/genai");
const { loadKnowledge } = require("./knowledgeLoader");
const { runQuery: dbRunQuery } = require("./assistantDb");

// Stable alias tracking the current Flash model — hardcoded versions (e.g.
// gemini-2.5-flash) get gated off for new Google projects.
const MODEL = "gemini-flash-latest";
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

// Real Gemini stream, matching the injectable interface used in tests.
async function* realGenerateStream({ contents, allowTools }) {
  const stream = await getAi().models.generateContentStream({
    model: MODEL,
    contents,
    config: {
      systemInstruction: loadKnowledge(),
      tools: allowTools ? [{ functionDeclarations: FUNCTION_DECLARATIONS }] : undefined,
    },
  });
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

module.exports = { runAgent, MAX_ROUNDS, FUNCTION_DECLARATIONS };
