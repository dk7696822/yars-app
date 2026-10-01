"use strict";

const { OpenAiCompatProvider, parseDuration } = require("../src/assistant/providers/openaiCompat");

const sse = (events, { status = 200, headers = {}, text = "" } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] },
  text: async () => text,
  body: new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(events.map((e) => `data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`).join("")));
      c.close();
    },
  }),
});

const collect = async (it) => {
  const out = [];
  for await (const c of it) out.push(c);
  return out;
};

describe("OpenAiCompatProvider", () => {
  test("streams text and joins tool-call fragments; sends model options", async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      sse([
        { choices: [{ delta: { reasoning: "thinking" } }] },
        { choices: [{ delta: { content: "Hi " } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "find", arguments: "{\"kind\":" } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "\"plate\"}" } }] } }] },
        "[DONE]",
      ])
    );
    const p = new OpenAiCompatProvider({ key: "groq", baseUrl: "https://x/v1", apiKey: "k", fetchFn });
    const chunks = await collect(p.stream({ model: "m", system: "s", messages: [{ role: "user", content: "q" }], tools: [{ name: "find", description: "d", parameters: {} }], options: { reasoning_effort: "low" } }));
    expect(chunks).toEqual([{ text: "Hi " }, { toolCalls: [{ id: "c1", name: "find", args: { kind: "plate" } }] }]);
    const [url, init] = fetchFn.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe("https://x/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer k");
    expect(body).toMatchObject({ model: "m", stream: true, reasoning_effort: "low", tools: [{ type: "function", function: { name: "find" } }] });
    expect(body.messages[0]).toEqual({ role: "system", content: "s" });
  });

  test("replays tool rounds in OpenAI shape", () => {
    const p = new OpenAiCompatProvider({ key: "groq", baseUrl: "https://x/v1", apiKey: "k" });
    const out = p.toMessages("s", [
      { role: "user", content: "q" },
      { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "dues", args: {} }] },
      { role: "tool", results: [{ id: "c1", name: "dues", result: "To collect ₹10" }] },
    ]);
    expect(out.slice(2)).toEqual([
      { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "dues", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "c1", content: "To collect ₹10" },
    ]);
  });

  test("a non-OK response throws with status and retry-after", async () => {
    const fetchFn = jest.fn().mockResolvedValue(sse([], { status: 429, headers: { "retry-after": "3" }, text: "rate limited" }));
    const p = new OpenAiCompatProvider({ key: "groq", baseUrl: "https://x/v1", apiKey: "k", fetchFn });
    await expect(collect(p.stream({ model: "m", system: "s", messages: [] }))).rejects.toMatchObject({ status: 429, retryAfterHeader: "3" });
  });

  describe("classify", () => {
    const p = new OpenAiCompatProvider({ key: "groq", baseUrl: "https://x/v1", apiKey: "k" });
    const err = (status, message = "", retryAfterHeader) => Object.assign(new Error(message), { status, retryAfterHeader });

    test.each([
      ["per-minute limit with a short retry-after is waited out", err(429, "", "3"), { cooldownS: 3, waitable: true, rate: true }],
      ["per-minute limit from the message", err(429, "Please try again in 2.36s"), { cooldownS: 3, waitable: true, rate: true }],
      ["daily limit with a long wait", err(429, "tokens per day (TPD): try again in 7m12.3s"), { cooldownS: 433, waitable: false, rate: true }],
      ["daily limit with no time given", err(429, "daily free allocation exceeded"), { cooldownS: 3600, waitable: false, rate: true }],
      ["too large for this model's minute", err(413, "Request too large"), { cooldownS: 60, waitable: false, rate: true }],
      ["a fumbled tool call: try the next model, no cooldown", err(400, "tool_use_failed"), { cooldownS: 0, waitable: false }],
      ["model gone or key wrong", err(404, "model not found"), { cooldownS: 600, waitable: false }],
      ["server error or network", err(undefined, "fetch failed"), { cooldownS: 60, waitable: false }],
    ])("%s", (_, e, expected) => expect(p.classify(e)).toEqual(expected));
  });

  test.each([
    ["Please try again in 585ms", 1],
    ["try again in 2.36s", 3],
    ["try again in 7m12.3s", 433],
    ["try again in 1h2m", 3720],
    ["no time here", null],
  ])("parseDuration(%s) = %s", (text, s) => expect(parseDuration(text)).toBe(s));
});
