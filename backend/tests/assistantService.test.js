"use strict";

const { runAgent, MAX_ROUNDS, formatWait } = require("../src/services/assistant/assistantService");

// Helper: a fake provider stream that yields the given neutral chunks per
// round: { text?, toolCalls?: [{id?, name, args}], raw? }.
const fakeStream = (rounds) => {
  let call = 0;
  return async function* stream() {
    const chunks = rounds[Math.min(call, rounds.length - 1)];
    call += 1;
    for (const c of chunks) yield c;
  };
};

const collect = () => {
  const events = { deltas: [], statuses: [] };
  return {
    events,
    callbacks: {
      onDelta: (t) => events.deltas.push(t),
      onStatus: (t) => events.statuses.push(t),
    },
  };
};

const deps = (extra) => ({ system: "test system", ...extra });

describe("assistantService.runAgent", () => {
  test("plain answer: streams deltas, returns final text, no tools", async () => {
    const { events, callbacks } = collect();
    const final = await runAgent(
      [{ role: "user", content: "hi" }],
      callbacks,
      deps({ stream: fakeStream([[{ text: "Hello " }, { text: "there" }]]), runQuery: jest.fn() })
    );
    expect(final).toBe("Hello there");
    expect(events.deltas).toEqual(["Hello ", "there"]);
  });

  test("tool round-trip: executes run_query, emits status, continues", async () => {
    const runQuery = jest.fn().mockResolvedValue('{"rowCount":1,"rows":[{"n":42}]}');
    const { events, callbacks } = collect();
    const final = await runAgent(
      [{ role: "user", content: "how many customers?" }],
      callbacks,
      deps({
        stream: fakeStream([
          [{ toolCalls: [{ name: "run_query", args: { query: "SELECT count(*) AS n FROM customers" } }] }],
          [{ text: "You have 42 customers." }],
        ]),
        runQuery,
      })
    );
    expect(runQuery).toHaveBeenCalledWith("SELECT count(*) AS n FROM customers");
    expect(events.statuses.length).toBeGreaterThan(0);
    expect(final).toBe("You have 42 customers.");
  });

  test("failed query is fed back to the model, which recovers", async () => {
    const runQuery = jest.fn().mockRejectedValue(new Error("column does not exist"));
    const { callbacks } = collect();
    const final = await runAgent(
      [{ role: "user", content: "q" }],
      callbacks,
      deps({
        stream: fakeStream([
          [{ toolCalls: [{ name: "run_query", args: { query: "SELECT bad FROM customers" } }] }],
          [{ text: "Sorry, I could not find that." }],
        ]),
        runQuery,
      })
    );
    expect(final).toBe("Sorry, I could not find that.");
  });

  test("assistant turn carries neutral toolCalls, raw payload and tool results back to the stream", async () => {
    const seenRequests = [];
    let call = 0;
    const stream = async function* (req) {
      seenRequests.push(JSON.parse(JSON.stringify(req.messages)));
      call += 1;
      if (call === 1) {
        yield {
          text: "Checking… ",
          toolCalls: [{ id: "fc-1", name: "run_query", args: { query: "SELECT 1" } }],
          raw: { provider: "gemini", parts: [{ functionCall: { name: "run_query" }, thoughtSignature: "sig-abc" }] },
        };
      } else {
        yield { text: "done" };
      }
    };
    const runQuery = jest.fn().mockResolvedValue("{}");
    const { callbacks } = collect();
    await runAgent([{ role: "user", content: "q" }], callbacks, deps({ stream, runQuery }));

    const second = seenRequests[1];
    const assistantTurn = second.find((m) => m.role === "assistant");
    expect(assistantTurn.toolCalls).toEqual([{ id: "fc-1", name: "run_query", args: { query: "SELECT 1" } }]);
    expect(assistantTurn.raw).toEqual({
      provider: "gemini",
      parts: [{ functionCall: { name: "run_query" }, thoughtSignature: "sig-abc" }],
    });
    const toolTurn = second[second.length - 1];
    expect(toolTurn).toEqual({ role: "tool", results: [{ id: "fc-1", name: "run_query", result: "{}" }] });
  });

  test("formatWait renders human-friendly durations", () => {
    expect(formatWait(45)).toBe("a minute");
    expect(formatWait(300)).toBe("5 minutes");
    expect(formatWait(3600)).toBe("an hour");
    expect(formatWait(7200)).toBe("2 hours");
  });

  test("round cap: stops calling tools after MAX_ROUNDS", async () => {
    const runQuery = jest.fn().mockResolvedValue('{"rowCount":0,"rows":[]}');
    const toolRound = [{ toolCalls: [{ name: "run_query", args: { query: "SELECT 1" } }] }];
    const rounds = Array.from({ length: MAX_ROUNDS }, () => toolRound);
    rounds.push([{ text: "Best effort answer." }]);
    const { callbacks } = collect();
    const final = await runAgent(
      [{ role: "user", content: "q" }],
      callbacks,
      deps({ stream: fakeStream(rounds), runQuery })
    );
    expect(runQuery).toHaveBeenCalledTimes(MAX_ROUNDS);
    expect(final).toBe("Best effort answer.");
  });

  test("tools are withheld from the final round", async () => {
    const seenTools = [];
    const stream = async function* ({ tools }) {
      seenTools.push(tools);
      if (seenTools.length <= MAX_ROUNDS) {
        yield { toolCalls: [{ name: "run_query", args: { query: "SELECT 1" } }] };
      } else {
        yield { text: "done" };
      }
    };
    const runQuery = jest.fn().mockResolvedValue("{}");
    const { callbacks } = collect();
    await runAgent([{ role: "user", content: "q" }], callbacks, deps({ stream, runQuery }));
    expect(seenTools.slice(0, MAX_ROUNDS).every(Boolean)).toBe(true);
    expect(seenTools[MAX_ROUNDS]).toBeUndefined();
  });
});
