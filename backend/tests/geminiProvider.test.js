"use strict";

const { GeminiProvider, toGeminiSchema } = require("../src/services/assistant/providers/geminiProvider");

describe("GeminiProvider.toContents", () => {
  const provider = new GeminiProvider({ apiKey: "test" });

  test("raw parts (with thought signatures) are echoed back verbatim", () => {
    const signedPart = {
      functionCall: { name: "run_query", args: { query: "SELECT 1" } },
      thoughtSignature: "sig-abc-123",
    };
    const contents = provider.toContents([
      { role: "user", content: "q" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "fc-1", name: "run_query", args: { query: "SELECT 1" } }],
        raw: { provider: "gemini", parts: [signedPart] },
      },
      { role: "tool", results: [{ id: "fc-1", name: "run_query", result: "{}" }] },
    ]);

    expect(contents[1]).toEqual({ role: "model", parts: [signedPart] });
    expect(contents[2].parts[0].functionResponse).toEqual({
      name: "run_query",
      response: { result: "{}" },
      id: "fc-1",
    });
  });

  test("assistant turns from another provider are rebuilt from neutral fields", () => {
    const contents = provider.toContents([
      {
        role: "assistant",
        content: "Let me check.",
        toolCalls: [{ id: "mistral-id", name: "run_query", args: { query: "SELECT 2" } }],
        raw: { provider: "mistral", chunks: [] },
      },
    ]);
    expect(contents[0]).toEqual({
      role: "model",
      parts: [
        { text: "Let me check." },
        { functionCall: { name: "run_query", args: { query: "SELECT 2" } } },
      ],
    });
  });

  test("tool results without an id omit the id field", () => {
    const contents = provider.toContents([
      { role: "tool", results: [{ name: "run_query", result: "{}" }] },
    ]);
    expect(contents[0].parts[0].functionResponse).toEqual({
      name: "run_query",
      response: { result: "{}" },
    });
  });
});

describe("toGeminiSchema", () => {
  test("uppercases nested JSON-Schema types", () => {
    expect(
      toGeminiSchema({
        name: "run_query",
        parameters: undefined,
      })
    ).toEqual({ name: "run_query", parameters: undefined });
    expect(
      toGeminiSchema({
        type: "object",
        properties: { query: { type: "string" }, tags: { type: "array", items: { type: "string" } } },
        required: ["query"],
      })
    ).toEqual({
      type: "OBJECT",
      properties: { query: { type: "STRING" }, tags: { type: "ARRAY", items: { type: "STRING" } } },
      required: ["query"],
    });
  });
});

describe("GeminiProvider error classification", () => {
  const provider = new GeminiProvider({ apiKey: "test" });

  test("recognises quota errors and retry delays", () => {
    expect(provider.isQuotaError({ status: 429 })).toBe(true);
    expect(provider.isQuotaError(new Error("RESOURCE_EXHAUSTED: daily limit"))).toBe(true);
    expect(provider.isQuotaError(new Error("400 invalid argument"))).toBe(false);
    expect(provider.parseRetryAfter(new Error('"retryDelay": "37s"'))).toBe(37);
    expect(provider.parseRetryAfter(new Error('"retryDelay": "7s"'))).toBe(30);
    expect(provider.parseRetryAfter(new Error("no hint"))).toBe(120);
  });
});
