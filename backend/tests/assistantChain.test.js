"use strict";

const { createChain, QuotaExhaustedError, NoModelError, formatWait } = require("../src/assistant/chain");

// A provider whose calls follow a script: "ok", or an error to throw before the first chunk.
const scripted = (script) => {
  const calls = [];
  return {
    calls,
    stream({ model }) {
      calls.push(model);
      const step = script[Math.min(calls.length - 1, script.length - 1)];
      return (async function* () {
        if (step !== "ok") throw Object.assign(new Error(step.message || "err"), step);
        yield { text: `from ${model}` };
      })();
    },
    classify: (e) => e.verdict,
  };
};

const collect = async (it) => {
  const out = [];
  for await (const c of it) out.push(c.text);
  return out.join("");
};

describe("chain", () => {
  test("answers from the first healthy model", async () => {
    const a = scripted(["ok"]);
    const chain = createChain([{ label: "a", provider: a, model: "m1" }]);
    expect(await collect(chain.stream({}))).toBe("from m1");
  });

  test("a short per-minute limit is waited out once on the same model", async () => {
    const a = scripted([{ verdict: { cooldownS: 3, waitable: true } }, "ok"]);
    const sleep = jest.fn().mockResolvedValue();
    const chain = createChain([{ label: "a", provider: a, model: "m1" }], { sleep, log: () => {} });
    expect(await collect(chain.stream({}))).toBe("from m1");
    expect(sleep).toHaveBeenCalledWith(3000);
    expect(a.calls).toEqual(["m1", "m1"]);
  });

  test("a caller may allow longer waits on rate limits (evals grade one model, not throughput)", async () => {
    const a = scripted([{ verdict: { cooldownS: 16, waitable: false, rate: true } }, "ok"]);
    const sleep = jest.fn().mockResolvedValue();
    const chain = createChain([{ label: "a", provider: a, model: "m1" }], { sleep, log: () => {}, maxWaitS: 60 });
    expect(await collect(chain.stream({}))).toBe("from m1");
    expect(sleep).toHaveBeenCalledWith(16000);
  });

  test("when the caller allows it, keeps waiting while the limit keeps coming back", async () => {
    const limited = { verdict: { cooldownS: 2, waitable: true, rate: true } };
    const a = scripted([limited, limited, limited, "ok"]);
    const sleep = jest.fn().mockResolvedValue();
    const chain = createChain([{ label: "a", provider: a, model: "m1" }], { sleep, log: () => {}, maxWaitS: 60 });
    expect(await collect(chain.stream({}))).toBe("from m1");
    expect(sleep).toHaveBeenCalledTimes(3);
  });

  test("without that, a 16 s rate limit moves on", async () => {
    const a = scripted([{ verdict: { cooldownS: 16, waitable: false, rate: true } }]);
    const chain = createChain([{ label: "a", provider: a, model: "m1" }], { now: () => 0, log: () => {} });
    await expect(collect(chain.stream({}))).rejects.toBeInstanceOf(QuotaExhaustedError);
  });

  test("anything else moves to the next model and cools the first down", async () => {
    let t = 0;
    const a = scripted([{ verdict: { cooldownS: 600, waitable: false } }]);
    const b = scripted(["ok"]);
    const chain = createChain([{ label: "a", provider: a, model: "m1" }, { label: "b", provider: b, model: "m2" }], { now: () => t, log: () => {} });
    expect(await collect(chain.stream({}))).toBe("from m2");
    t += 1000;
    expect(await collect(chain.stream({}))).toBe("from m2");
    expect(a.calls).toEqual(["m1"]); // still cooling down on the second request
  });

  test("when every model is rate-limited, says when to come back", async () => {
    const a = scripted([{ verdict: { cooldownS: 120, waitable: false } }]);
    const chain = createChain([{ label: "a", provider: a, model: "m1" }], { now: () => 0, log: () => {} });
    await expect(collect(chain.stream({}))).rejects.toBeInstanceOf(QuotaExhaustedError);
  });

  test("when no model could answer and none is rate-limited, it is a NoModelError", async () => {
    const a = scripted([{ verdict: { cooldownS: 0, waitable: false } }]);
    const chain = createChain([{ label: "a", provider: a, model: "m1" }], { log: () => {} });
    await expect(collect(chain.stream({}))).rejects.toBeInstanceOf(NoModelError);
  });

  test("formatWait reads naturally", () => {
    expect([formatWait(30), formatWait(600), formatWait(3600), formatWait(7300)]).toEqual(["a minute", "10 minutes", "an hour", "3 hours"]);
  });
});
