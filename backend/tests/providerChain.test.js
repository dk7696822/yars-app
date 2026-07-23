"use strict";

const { createChain, QuotaExhaustedError, MIN_COOLDOWN_S } = require("../src/services/assistant/providerChain");

// A fake provider whose behavior per call is scripted: "ok" streams two
// chunks, "quota" throws a quota error, "boom" throws a normal error.
const fakeProvider = (script, { retryAfter = 300 } = {}) => {
  const calls = [];
  return {
    calls,
    provider: {
      stream({ model }) {
        calls.push(model);
        const behavior = Array.isArray(script) ? script[Math.min(calls.length - 1, script.length - 1)] : script;
        return (async function* () {
          if (behavior === "quota") {
            const err = new Error("quota");
            err.quota = true;
            throw err;
          }
          if (behavior === "boom") throw new Error("boom");
          yield { text: `hello from ${model} ` };
          yield { text: "world" };
        })();
      },
      isQuotaError: (err) => err.quota === true,
      parseRetryAfter: () => retryAfter,
    },
  };
};

const collect = async (iterable) => {
  const out = [];
  for await (const c of iterable) out.push(c);
  return out;
};

describe("providerChain", () => {
  test("streams from the first healthy entry", async () => {
    const a = fakeProvider("ok");
    const chain = createChain([{ label: "a:m1", provider: a.provider, model: "m1" }]);
    const chunks = await collect(chain.stream({ system: "s", messages: [] }));
    expect(chunks.map((c) => c.text).join("")).toBe("hello from m1 world");
  });

  test("quota error falls through to the next entry across providers", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const a = fakeProvider("quota");
    const b = fakeProvider("ok");
    const chain = createChain([
      { label: "a:m1", provider: a.provider, model: "m1" },
      { label: "b:m2", provider: b.provider, model: "m2" },
    ]);
    const chunks = await collect(chain.stream({ system: "s", messages: [] }));
    expect(a.calls).toEqual(["m1"]);
    expect(chunks.map((c) => c.text).join("")).toBe("hello from m2 world");
    console.warn.mockRestore();
  });

  test("cooled-down entries are skipped until their cooldown expires", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    let t = 0;
    const now = () => t;
    const a = fakeProvider(["quota", "ok"], { retryAfter: 300 });
    const b = fakeProvider("ok");
    const chain = createChain(
      [
        { label: "a:m1", provider: a.provider, model: "m1" },
        { label: "b:m2", provider: b.provider, model: "m2" },
      ],
      { now }
    );

    await collect(chain.stream({})); // m1 quota → cooled, m2 answers
    await collect(chain.stream({})); // m1 still cooling → straight to m2
    expect(a.calls).toEqual(["m1"]);
    expect(b.calls).toEqual(["m2", "m2"]);

    t = 301 * 1000; // cooldown over → m1 gets tried again and succeeds
    const chunks = await collect(chain.stream({}));
    expect(a.calls).toEqual(["m1", "m1"]);
    expect(chunks[0].text).toContain("m1");
    console.warn.mockRestore();
  });

  test("short provider retry hints are floored to MIN_COOLDOWN_S", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    let t = 0;
    const now = () => t;
    const a = fakeProvider(["quota", "ok"], { retryAfter: 5 });
    const b = fakeProvider("ok");
    const chain = createChain(
      [
        { label: "a:m1", provider: a.provider, model: "m1" },
        { label: "b:m2", provider: b.provider, model: "m2" },
      ],
      { now }
    );
    await collect(chain.stream({}));
    t = 10 * 1000; // past the 5s hint but inside the floor → still skipped
    await collect(chain.stream({}));
    expect(a.calls).toEqual(["m1"]);
    t = (MIN_COOLDOWN_S + 1) * 1000;
    await collect(chain.stream({}));
    expect(a.calls).toEqual(["m1", "m1"]);
    console.warn.mockRestore();
  });

  test("non-quota errors propagate immediately", async () => {
    const a = fakeProvider("boom");
    const b = fakeProvider("ok");
    const chain = createChain([
      { label: "a:m1", provider: a.provider, model: "m1" },
      { label: "b:m2", provider: b.provider, model: "m2" },
    ]);
    await expect(collect(chain.stream({}))).rejects.toThrow("boom");
    expect(b.calls).toEqual([]);
  });

  test("all entries exhausted throws QuotaExhaustedError with the soonest wait", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    let t = 0;
    const now = () => t;
    const a = fakeProvider("quota", { retryAfter: 300 });
    const b = fakeProvider("quota", { retryAfter: 900 });
    const chain = createChain(
      [
        { label: "a:m1", provider: a.provider, model: "m1" },
        { label: "b:m2", provider: b.provider, model: "m2" },
      ],
      { now }
    );
    await expect(collect(chain.stream({}))).rejects.toThrow(QuotaExhaustedError);
    // Both now cooling — next call must not touch the providers at all.
    let err;
    try {
      await collect(chain.stream({}));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(QuotaExhaustedError);
    expect(err.retryAfterSeconds).toBe(300); // soonest entry back first
    expect(a.calls).toEqual(["m1"]);
    expect(b.calls).toEqual(["m2"]);
    console.warn.mockRestore();
  });
});
