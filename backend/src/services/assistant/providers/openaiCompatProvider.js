"use strict";

// Mistral rejects tool_call ids that are not exactly 9 alphanumeric chars.
// Ids in replayed history can come from any provider (Gemini's look like
// "fc-09e4…", Groq's like "fc_09e49090-…"), so every id is mapped to a
// compliant one deterministically — the same input id always maps to the same
// output, which keeps the assistant tool_calls and their tool results paired.
const normalizeToolCallId = (id) => {
  const s = String(id);
  if (/^[a-zA-Z0-9]{9}$/.test(s)) return s;
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return `c${h.toString(36)}00000000`.slice(0, 9);
};

/**
 * Adapter from the neutral provider interface to OpenAI-compatible chat
 * completion APIs (Mistral, Groq). Speaks SSE streaming over fetch.
 */
class OpenAiCompatProvider {
  constructor({ key, baseUrl, apiKeyEnv, fetchFn }) {
    this.key = key;
    this._baseUrl = baseUrl.replace(/\/$/, "");
    this._apiKeyEnv = apiKeyEnv;
    this._fetch = fetchFn || fetch;
  }

  toMessages(system, messages) {
    const out = [{ role: "system", content: system }];
    for (const m of messages) {
      if (m.role === "user") {
        out.push({ role: "user", content: m.content });
      } else if (m.role === "assistant") {
        const msg = { role: "assistant", content: m.content || "" };
        if (m.toolCalls?.length) {
          msg.tool_calls = m.toolCalls.map((tc, i) => ({
            id: normalizeToolCallId(tc.id ?? `auto${i}`),
            type: "function",
            function: { name: tc.name, arguments: JSON.stringify(tc.args ?? {}) },
          }));
        }
        out.push(msg);
      } else if (m.role === "tool") {
        for (const [i, r] of m.results.entries()) {
          out.push({
            role: "tool",
            tool_call_id: normalizeToolCallId(r.id ?? `auto${i}`),
            name: r.name,
            content: r.result,
          });
        }
      }
    }
    return out;
  }

  async *stream({ model, system, messages, tools }) {
    const res = await this._fetch(`${this._baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env[this._apiKeyEnv]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: this.toMessages(system, messages),
        tools: tools?.length ? tools.map((t) => ({ type: "function", function: t })) : undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(`${this.key} ${res.status}: ${body.slice(0, 500)}`);
      err.status = res.status;
      err.retryAfterHeader = res.headers?.get?.("retry-after") || undefined;
      throw err;
    }

    // Accumulate streamed tool calls by index — arguments arrive as JSON
    // string fragments that only parse once the stream is complete.
    const calls = new Map();

    // Parses one SSE line; returns a text delta to emit, or null.
    const handleLine = (line) => {
      if (process.env.ASSISTANT_DEBUG) console.error("[sse]", line.slice(0, 200));
      if (!line.startsWith("data:")) return null;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return null;
      let delta;
      try {
        delta = JSON.parse(data).choices?.[0]?.delta;
      } catch {
        return null; // keep-alive noise / truncated tail
      }
      if (!delta) return null;
      (delta.tool_calls || []).forEach((tc, pos) => {
        const idx = tc.index ?? pos;
        const slot = calls.get(idx) || { id: null, name: "", argsText: "" };
        if (tc.id) slot.id = tc.id;
        if (tc.function?.name) slot.name = tc.function.name;
        if (tc.function?.arguments) slot.argsText += tc.function.arguments;
        calls.set(idx, slot);
      });
      return delta.content || null;
    };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const text = handleLine(buf.slice(0, nl).trim());
        buf = buf.slice(nl + 1);
        if (text) yield { text };
      }
    }
    // Flush the decoder and process any trailing line a truncated stream left
    // without its final newline — otherwise the tail is silently dropped.
    buf += decoder.decode();
    const tail = buf.trim();
    if (tail) {
      const text = handleLine(tail);
      if (text) yield { text };
    }

    if (calls.size) {
      yield {
        toolCalls: [...calls.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, c]) => {
            let args;
            try {
              args = JSON.parse(c.argsText || "{}");
            } catch {
              args = {}; // malformed args — the tool error feeds back and the model retries
            }
            return { id: c.id || undefined, name: c.name, args };
          }),
      };
    }
  }

  // 429 = rate/quota; Groq also 413s ("request too large … tokens per minute")
  // when a single request exceeds its free-tier TPM — same remedy: step down.
  isQuotaError(err) {
    return err?.status === 429 || err?.status === 413 || /rate.?limit/i.test(String(err?.message));
  }

  parseRetryAfter(err) {
    const header = parseFloat(err?.retryAfterHeader);
    if (Number.isFinite(header) && header > 0) return Math.ceil(header);
    const m = String(err?.message).match(/try again in ([0-9.]+)s/i);
    if (m) return Math.max(Math.ceil(parseFloat(m[1])), 5);
    return 60; // Mistral/Groq limits are per-minute — a minute is the sane default
  }
}

module.exports = { OpenAiCompatProvider, normalizeToolCallId };
