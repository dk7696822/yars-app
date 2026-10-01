"use strict";

const { buildEntries } = require("../src/assistant/llm");
const { MODEL_CHAIN } = require("../src/assistant/config");

describe("model chain from config", () => {
  test("every configured model is used when both keys are set, in order", () => {
    const entries = buildEntries({ GROQ_API_KEY: "g", CLOUDFLARE_ACCOUNT_ID: "acc", CLOUDFLARE_API_TOKEN: "t" });
    expect(entries.map((e) => e.label)).toEqual(MODEL_CHAIN.map((m) => `${m.provider}:${m.model}`));
    expect(entries[0]).toMatchObject({ model: "openai/gpt-oss-120b", options: { reasoning_effort: "low" } });
  });

  test("a provider without its key is left out", () => {
    expect(buildEntries({ GROQ_API_KEY: "g" }).every((e) => e.label.startsWith("groq:"))).toBe(true);
    expect(buildEntries({ CLOUDFLARE_ACCOUNT_ID: "acc", CLOUDFLARE_API_TOKEN: "t" }).map((e) => e.label)).toEqual(["cloudflare:@cf/openai/gpt-oss-120b"]);
    expect(buildEntries({})).toEqual([]);
  });

  test("Cloudflare's URL carries the account id", () => {
    const [entry] = buildEntries({ CLOUDFLARE_ACCOUNT_ID: "acc", CLOUDFLARE_API_TOKEN: "t" });
    expect(entry.provider._baseUrl).toBe("https://api.cloudflare.com/client/v4/accounts/acc/ai/v1");
  });
});
