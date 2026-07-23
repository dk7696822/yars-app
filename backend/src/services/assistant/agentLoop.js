"use strict";

const MAX_ROUNDS = 6;

/**
 * Provider-neutral agent loop: stream a model turn, execute any tool calls,
 * feed results back, repeat. Knows nothing about Gemini/Mistral/Groq — it
 * talks only to `stream` (usually the provider chain) using neutral messages:
 *
 *   {role:'user', content}
 *   {role:'assistant', content, toolCalls?: [{id?, name, args}], raw?}
 *   {role:'tool', results: [{id?, name, result}]}
 *
 * `raw` is an opaque provider-native payload ({provider, parts}) attached so
 * the same provider can replay its own turn verbatim (Gemini thought
 * signatures); other providers ignore it and rebuild from the neutral fields.
 *
 * @param {object} opts
 * @param {string} opts.system - system instructions
 * @param {Array<{role: string, content: string}>} opts.history - persisted messages, oldest first
 * @param {Array<object>} opts.tools - neutral tool declarations
 * @param {Function} opts.stream - ({system, messages, tools}) => async iterable of {text?, toolCalls?, raw?}
 * @param {Function} opts.executeTool - ({name, args}) => Promise<string>
 * @param {Function} opts.onDelta
 * @param {Function} opts.onStatus
 * @returns {Promise<string>} the final assistant text
 */
const runAgent = async ({ system, history, tools, stream, executeTool, onDelta, onStatus }) => {
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  let finalText = "";

  for (let round = 0; round <= MAX_ROUNDS; round += 1) {
    const allowTools = round < MAX_ROUNDS;
    let roundText = "";
    const calls = [];
    let roundRaw = null;

    for await (const chunk of stream({ system, messages, tools: allowTools ? tools : undefined })) {
      if (chunk.text) {
        roundText += chunk.text;
        onDelta(chunk.text);
      }
      if (chunk.toolCalls) calls.push(...chunk.toolCalls);
      if (chunk.raw?.parts) {
        if (!roundRaw) roundRaw = { provider: chunk.raw.provider, parts: [] };
        roundRaw.parts.push(...chunk.raw.parts);
      }
    }

    // Text emitted before a tool call is preamble — keep it in the final answer.
    finalText += roundText;
    if (calls.length === 0) {
      // Some models occasionally stream an empty turn — never hand the user a blank message.
      return finalText || "I could not come up with an answer — please try rephrasing.";
    }

    messages.push({
      role: "assistant",
      content: roundText,
      toolCalls: calls,
      ...(roundRaw ? { raw: roundRaw } : {}),
    });

    onStatus("Looking at the database…");

    const results = [];
    for (const tc of calls) {
      let result;
      try {
        result = await executeTool(tc);
      } catch (err) {
        result = JSON.stringify({ error: err.message });
      }
      results.push({ id: tc.id, name: tc.name, result });
    }
    messages.push({ role: "tool", results });
  }

  return finalText || "I could not finish answering that — please try rephrasing.";
};

module.exports = { runAgent, MAX_ROUNDS };
