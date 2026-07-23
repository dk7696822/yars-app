"use strict";

const { runAgent, MAX_ROUNDS } = require("../src/services/assistant/assistantService");

// Helper: a fake generateStream that yields the given chunks per round.
// Each chunk mimics @google/genai stream chunks: { text, functionCalls }.
const fakeGemini = (rounds) => {
  let call = 0;
  return async function* generateStream() {
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

describe("assistantService.runAgent", () => {
  test("plain answer: streams deltas, returns final text, no tools", async () => {
    const { events, callbacks } = collect();
    const final = await runAgent(
      [{ role: "user", content: "hi" }],
      callbacks,
      { generateStream: fakeGemini([[{ text: "Hello " }, { text: "there" }]]), runQuery: jest.fn() }
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
      {
        generateStream: fakeGemini([
          [{ functionCalls: [{ name: "run_query", args: { query: "SELECT count(*) AS n FROM customers" } }] }],
          [{ text: "You have 42 customers." }],
        ]),
        runQuery,
      }
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
      {
        generateStream: fakeGemini([
          [{ functionCalls: [{ name: "run_query", args: { query: "SELECT bad FROM customers" } }] }],
          [{ text: "Sorry, I could not find that." }],
        ]),
        runQuery,
      }
    );
    expect(final).toBe("Sorry, I could not find that.");
  });

  test("raw parts (with thought signatures) are echoed back verbatim", async () => {
    const signedPart = {
      functionCall: { name: "run_query", args: { query: "SELECT 1" } },
      thoughtSignature: "sig-abc-123",
    };
    const seenContents = [];
    let call = 0;
    const generateStream = async function* ({ contents }) {
      seenContents.push(JSON.parse(JSON.stringify(contents)));
      call += 1;
      if (call === 1) {
        yield {
          functionCalls: [{ name: "run_query", args: { query: "SELECT 1" }, id: "fc-1" }],
          parts: [signedPart],
        };
      } else {
        yield { text: "done" };
      }
    };
    const runQuery = jest.fn().mockResolvedValue("{}");
    const { callbacks } = collect();
    await runAgent([{ role: "user", content: "q" }], callbacks, { generateStream, runQuery });

    // Second request must contain the signed part verbatim and the call id.
    const secondRequest = seenContents[1];
    const modelTurn = secondRequest.find((c) => c.role === "model");
    expect(modelTurn.parts).toEqual([signedPart]);
    const responseTurn = secondRequest[secondRequest.length - 1];
    expect(responseTurn.parts[0].functionResponse.id).toBe("fc-1");
  });

  test("round cap: stops calling tools after MAX_ROUNDS", async () => {
    const runQuery = jest.fn().mockResolvedValue('{"rowCount":0,"rows":[]}');
    const toolRound = [{ functionCalls: [{ name: "run_query", args: { query: "SELECT 1" } }] }];
    const rounds = Array.from({ length: MAX_ROUNDS }, () => toolRound);
    rounds.push([{ text: "Best effort answer." }]);
    const { callbacks } = collect();
    const final = await runAgent([{ role: "user", content: "q" }], callbacks, {
      generateStream: fakeGemini(rounds),
      runQuery,
    });
    expect(runQuery).toHaveBeenCalledTimes(MAX_ROUNDS);
    expect(final).toBe("Best effort answer.");
  });
});
