"use strict";

const { GoogleGenAI } = require("@google/genai");

const PROVIDER_KEY = "gemini";

// Neutral tool declarations use lowercase JSON-Schema types; Gemini wants its
// own uppercase Type names.
const toGeminiSchema = (schema) => {
  if (!schema || typeof schema !== "object") return schema;
  const out = { ...schema };
  if (typeof out.type === "string") out.type = out.type.toUpperCase();
  if (out.properties) {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([k, v]) => [k, toGeminiSchema(v)])
    );
  }
  if (out.items) out.items = toGeminiSchema(out.items);
  return out;
};

/**
 * Adapter from the neutral provider interface to @google/genai.
 *
 * Neutral request: { model, system, messages, tools }
 *   messages: [{role:'user'|'assistant'|'tool', content?, toolCalls?, results?, raw?}]
 * Neutral chunks yielded: { text?, toolCalls?: [{id?, name, args}], raw? }
 *
 * `raw` carries the provider-native model parts (incl. thoughtSignature) —
 * newer Gemini models reject the follow-up request unless their own turn is
 * echoed back verbatim, signatures included. The agent loop stores it opaque
 * and hands it back; this adapter only trusts raw it produced itself.
 */
class GeminiProvider {
  constructor({ apiKey } = {}) {
    this.key = PROVIDER_KEY;
    this._apiKey = apiKey;
    this._ai = null;
  }

  _getAi() {
    if (!this._ai) this._ai = new GoogleGenAI({ apiKey: this._apiKey || process.env.GEMINI_API_KEY });
    return this._ai;
  }

  toContents(messages) {
    const contents = [];
    for (const m of messages) {
      if (m.role === "user") {
        contents.push({ role: "user", parts: [{ text: m.content }] });
      } else if (m.role === "assistant") {
        if (m.raw?.provider === PROVIDER_KEY && m.raw.parts?.length) {
          contents.push({ role: "model", parts: m.raw.parts });
        } else {
          contents.push({
            role: "model",
            parts: [
              ...(m.content ? [{ text: m.content }] : []),
              ...(m.toolCalls || []).map((tc) => ({ functionCall: { name: tc.name, args: tc.args } })),
            ],
          });
        }
      } else if (m.role === "tool") {
        contents.push({
          role: "user",
          parts: m.results.map((r) => ({
            functionResponse: {
              name: r.name,
              response: { result: r.result },
              ...(r.id ? { id: r.id } : {}),
            },
          })),
        });
      }
    }
    return contents;
  }

  async *stream({ model, system, messages, tools }) {
    const stream = await this._getAi().models.generateContentStream({
      model,
      contents: this.toContents(messages),
      config: {
        systemInstruction: system,
        tools: tools
          ? [{ functionDeclarations: tools.map((t) => ({ ...t, parameters: toGeminiSchema(t.parameters) })) }]
          : undefined,
      },
    });
    for await (const chunk of stream) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      yield {
        text: chunk.text,
        toolCalls: chunk.functionCalls?.map((fc) => ({ id: fc.id, name: fc.name, args: fc.args })),
        raw: parts ? { provider: PROVIDER_KEY, parts } : undefined,
      };
    }
  }

  isQuotaError(err) {
    return err?.status === 429 || err?.code === 429 || /RESOURCE_EXHAUSTED|429/.test(String(err?.message));
  }

  // Google 429s usually carry RetryInfo like `"retryDelay": "37s"`.
  parseRetryAfter(err) {
    const m = String(err?.message).match(/retryDelay[^0-9]*(\d+)/i);
    return m ? Math.max(parseInt(m[1], 10), 30) : 120;
  }
}

module.exports = { GeminiProvider, toGeminiSchema };
