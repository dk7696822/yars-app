"use strict";

const {
  OpenAiCompatProvider,
  normalizeToolCallId,
} = require("../src/services/assistant/providers/openaiCompatProvider");

const makeProvider = (fetchFn) =>
  new OpenAiCompatProvider({
    key: "mistral",
    baseUrl: "https://api.example.test/v1",
    apiKeyEnv: "TEST_COMPAT_KEY",
    fetchFn,
  });

// Build a fetch response whose body streams the given SSE lines.
const sseResponse = (lines) => ({
  ok: true,
  body: {
    getReader() {
      const chunks = [new TextEncoder().encode(lines.join("\n") + "\n")];
      return {
        read: async () =>
          chunks.length ? { done: false, value: chunks.shift() } : { done: true, value: undefined },
      };
    },
  },
});

describe("normalizeToolCallId", () => {
  test("keeps ids that are already 9 alphanumerics", () => {
    expect(normalizeToolCallId("tCFyUgRql")).toBe("tCFyUgRql");
  });

  test("maps other ids deterministically to 9 alphanumerics", () => {
    const a = normalizeToolCallId("fc_09e49090-fb81-4b67");
    expect(a).toMatch(/^[a-zA-Z0-9]{9}$/);
    expect(normalizeToolCallId("fc_09e49090-fb81-4b67")).toBe(a);
    expect(normalizeToolCallId("fc-2")).not.toBe(normalizeToolCallId("fc-1"));
  });
});

describe("OpenAiCompatProvider.toMessages", () => {
  const provider = makeProvider();

  test("converts neutral turns to OpenAI wire format with paired tool ids", () => {
    const messages = provider.toMessages("sys", [
      { role: "user", content: "how many orders?" },
      {
        role: "assistant",
        content: "Checking…",
        toolCalls: [{ id: "fc-1", name: "run_query", args: { query: "SELECT 1" } }],
      },
      { role: "tool", results: [{ id: "fc-1", name: "run_query", result: '{"rowCount":1}' }] },
      { role: "assistant", content: "One order." },
    ]);

    expect(messages[0]).toEqual({ role: "system", content: "sys" });
    expect(messages[1]).toEqual({ role: "user", content: "how many orders?" });
    const call = messages[2].tool_calls[0];
    expect(call.function).toEqual({ name: "run_query", arguments: '{"query":"SELECT 1"}' });
    expect(call.id).toMatch(/^[a-zA-Z0-9]{9}$/);
    // The tool result must reference the same normalized id.
    expect(messages[3]).toEqual({
      role: "tool",
      tool_call_id: call.id,
      name: "run_query",
      content: '{"rowCount":1}',
    });
    expect(messages[4]).toEqual({ role: "assistant", content: "One order." });
  });

  test("missing ids fall back to per-index ids, still paired", () => {
    const messages = provider.toMessages("sys", [
      { role: "assistant", content: "", toolCalls: [{ name: "run_query", args: {} }] },
      { role: "tool", results: [{ name: "run_query", result: "{}" }] },
    ]);
    expect(messages[1].tool_calls[0].id).toBe(messages[2].tool_call_id);
  });
});

describe("OpenAiCompatProvider.stream", () => {
  beforeEach(() => {
    process.env.TEST_COMPAT_KEY = "k";
  });

  test("yields text deltas and assembles fragmented tool-call arguments", async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"Let me "}}]}',
        'data: {"choices":[{"delta":{"content":"check."}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"abc123XYZ","function":{"name":"run_query","arguments":"{\\"query\\":"}}]}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"SELECT 1\\"}"}}]}}]}',
        "data: [DONE]",
      ])
    );
    const provider = makeProvider(fetchFn);
    const chunks = [];
    for await (const c of provider.stream({ model: "m", system: "s", messages: [{ role: "user", content: "q" }], tools: [{ name: "run_query", description: "d", parameters: {} }] })) {
      chunks.push(c);
    }

    expect(chunks[0]).toEqual({ text: "Let me " });
    expect(chunks[1]).toEqual({ text: "check." });
    expect(chunks[2]).toEqual({
      toolCalls: [{ id: "abc123XYZ", name: "run_query", args: { query: "SELECT 1" } }],
    });

    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.stream).toBe(true);
    expect(body.tools[0]).toEqual({ type: "function", function: { name: "run_query", description: "d", parameters: {} } });
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe("Bearer k");
  });

  test("a truncated stream's un-terminated trailing line is still processed", async () => {
    // No trailing newline after the last data line — simulates an abnormally cut stream.
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader() {
          const chunks = [
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":"partial "}}]}\n'),
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":"tail"}}]}'),
          ];
          return {
            read: async () =>
              chunks.length ? { done: false, value: chunks.shift() } : { done: true, value: undefined },
          };
        },
      },
    });
    const provider = makeProvider(fetchFn);
    const chunks = [];
    for await (const c of provider.stream({ model: "m", system: "s", messages: [] })) chunks.push(c);
    expect(chunks).toEqual([{ text: "partial " }, { text: "tail" }]);
  });

  test("non-OK responses throw with status and retry-after header attached", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => '{"error":"slow down"}',
      headers: { get: (h) => (h === "retry-after" ? "17" : null) },
    });
    const provider = makeProvider(fetchFn);
    const it = provider.stream({ model: "m", system: "s", messages: [] });
    await expect(it.next()).rejects.toMatchObject({ status: 429, retryAfterHeader: "17" });
  });
});

describe("OpenAiCompatProvider error classification", () => {
  const provider = makeProvider();

  test("treats 429 and Groq's TPM 413 as quota errors", () => {
    expect(provider.isQuotaError({ status: 429 })).toBe(true);
    expect(provider.isQuotaError({ status: 413, message: "Request too large … rate_limit_exceeded" })).toBe(true);
    expect(provider.isQuotaError({ status: 500, message: "internal" })).toBe(false);
  });

  test("parses retry hints from header or message, defaults to a minute", () => {
    expect(provider.parseRetryAfter({ retryAfterHeader: "17" })).toBe(17);
    expect(provider.parseRetryAfter({ message: "Please try again in 7.66s" })).toBe(8);
    expect(provider.parseRetryAfter({ message: "no hint" })).toBe(60);
  });
});
