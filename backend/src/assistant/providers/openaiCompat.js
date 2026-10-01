"use strict";

const { SHORT_WAIT_S } = require("../config");

const DAILY = /per day|\(TPD\)|\(RPD\)|daily/i;

/** Groq's "try again in 7m12.3s" / "2.36s" / "585ms" → whole seconds, or null. */
const parseDuration = (text) => {
  const m = String(text || "").match(/try again in\s+([0-9hms.]+)/i);
  if (!m) return null;
  const s = m[1];
  if (/^[\d.]+ms$/.test(s)) return 1;
  const h = s.match(/([\d.]+)h/);
  const min = s.match(/([\d.]+)m(?!s)/);
  const sec = s.match(/([\d.]+)s/);
  if (!h && !min && !sec) return null;
  return Math.max(1, Math.ceil((h ? Number(h[1]) * 3600 : 0) + (min ? Number(min[1]) * 60 : 0) + (sec ? Number(sec[1]) : 0)));
};

/**
 * One OpenAI-compatible chat API (Groq, Cloudflare Workers AI), streamed over
 * SSE. Speaks the neutral message shape the agent loop uses:
 *   {role:'user', content} · {role:'assistant', content, toolCalls?} · {role:'tool', results}
 */
class OpenAiCompatProvider {
  constructor({ key, baseUrl, apiKey, fetchFn, timeoutMs = 30000 }) {
    this.key = key;
    this._baseUrl = baseUrl.replace(/\/$/, "");
    this._apiKey = apiKey;
    this._fetch = fetchFn || fetch;
    this._timeoutMs = timeoutMs;
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
            id: tc.id || `call_${i}`,
            type: "function",
            function: { name: tc.name, arguments: JSON.stringify(tc.args ?? {}) },
          }));
        }
        out.push(msg);
      } else if (m.role === "tool") {
        m.results.forEach((r, i) => out.push({ role: "tool", tool_call_id: r.id || `call_${i}`, content: r.result }));
      }
    }
    return out;
  }

  async *stream({ model, system, messages, tools, options }) {
    // The timeout covers waiting for the response to start; streaming then runs freely.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this._timeoutMs);
    let res;
    try {
      res = await this._fetch(`${this._baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${this._apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: true,
          ...(options || {}),
          messages: this.toMessages(system, messages),
          tools: tools?.length ? tools.map((t) => ({ type: "function", function: t })) : undefined,
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(`${this.key} ${res.status}: ${body.slice(0, 500)}`);
      err.status = res.status;
      err.retryAfterHeader = res.headers?.get?.("retry-after") || undefined;
      throw err;
    }

    // Tool-call arguments arrive as JSON fragments that only parse once complete.
    const calls = new Map();
    const handleLine = (line) => {
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
      return delta.content || null; // reasoning deltas are not shown
    };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
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
              args = {}; // malformed: the tool's argument error goes back and the model retries
            }
            return { id: c.id || undefined, name: c.name, args };
          }),
      };
    }
  }

  /**
   * What to do after an error before the first chunk: how long to rest this
   * model, and whether the wait is short enough to just wait and retry it.
   */
  classify(err) {
    const status = err?.status;
    if (status === 429 || status === 413) {
      const header = parseFloat(err.retryAfterHeader);
      let s = Number.isFinite(header) && header > 0 ? Math.ceil(header) : parseDuration(err.message);
      if (s === null) s = DAILY.test(String(err.message)) ? 3600 : 60;
      return { cooldownS: s, waitable: s <= SHORT_WAIT_S, rate: true };
    }
    if (status === 400) return { cooldownS: 0, waitable: false }; // the model fumbled a tool call
    if (status === 401 || status === 403 || status === 404) return { cooldownS: 600, waitable: false };
    return { cooldownS: 60, waitable: false }; // 5xx, timeout, network
  }
}

module.exports = { OpenAiCompatProvider, parseDuration };
