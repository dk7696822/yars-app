"use strict";

const { z } = require("zod");
const { runAgent } = require("../src/assistant/agentLoop");
const { fitHistory } = require("../src/assistant/history");
const { runAssistant } = require("../src/assistant");
const { READ_TOOLS } = require("../src/assistant/tools");

const fakeStream = (rounds) => {
  let call = 0;
  const fn = async function* (request) {
    fn.requests.push(request);
    const chunks = rounds[Math.min(call, rounds.length - 1)];
    call += 1;
    for (const c of chunks) yield c;
  };
  fn.requests = [];
  return fn;
};
const noop = () => {};
const base = (extra) => ({ system: "s", history: [{ role: "user", content: "q" }], tools: [{ name: "dues" }], onDelta: noop, onStatus: noop, ...extra });

describe("agent loop", () => {
  test("a plain answer is streamed and returned", async () => {
    const deltas = [];
    const final = await runAgent(base({ stream: fakeStream([[{ text: "Hello " }, { text: "there" }]]), executeTool: jest.fn(), onDelta: (t) => deltas.push(t) }));
    expect([final, deltas]).toEqual(["Hello there", ["Hello there"]]); // a round is shown once it is known to be clean
  });

  test("a tool round runs the tool, shows a status and feeds the result back", async () => {
    const stream = fakeStream([[{ toolCalls: [{ id: "c1", name: "dues", args: {} }] }], [{ text: "You are owed ₹10." }]]);
    const executeTool = jest.fn().mockResolvedValue({ text: "To collect ₹10" });
    const statuses = [];
    const final = await runAgent(base({ stream, executeTool, onStatus: (t) => statuses.push(t) }));
    expect(final).toBe("You are owed ₹10.");
    expect(statuses).toEqual(["Checking dues…"]);
    expect(stream.requests[1].messages.slice(-2)).toEqual([
      { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "dues", args: {} }] },
      { role: "tool", results: [{ id: "c1", name: "dues", result: "To collect ₹10" }] },
    ]);
  });

  test("a card a tool returns goes to onAction", async () => {
    const card = { id: "a1", status: "pending" };
    const stream = fakeStream([[{ toolCalls: [{ id: "c1", name: "propose_x", args: {} }] }], [{ text: "Tap Confirm." }]]);
    const onAction = jest.fn();
    await runAgent(base({ stream, executeTool: jest.fn().mockResolvedValue({ text: "Card shown", action: card }), onAction }));
    expect(onAction).toHaveBeenCalledWith(card);
  });

  test("tools given as a function are read fresh every round", async () => {
    const stream = fakeStream([[{ toolCalls: [{ name: "dues", args: {} }] }], [{ text: "ok" }]]);
    let round = 0;
    await runAgent(base({ stream, tools: () => [{ name: `t${(round += 1)}` }], executeTool: jest.fn().mockResolvedValue({ text: "x" }) }));
    expect(stream.requests.map((r) => r.tools[0].name)).toEqual(["t1", "t2"]);
  });

  test("tools are withheld from the last round, so it must answer", async () => {
    const stream = fakeStream([[{ toolCalls: [{ name: "dues", args: {} }] }]]);
    const final = await runAgent(base({ stream, executeTool: jest.fn().mockResolvedValue({ text: "x" }), maxRounds: 2 }));
    expect(stream.requests.map((r) => Boolean(r.tools))).toEqual([true, true, false]);
    expect(final).toMatch(/couldn't finish/);
  });

  test("an empty answer never reaches the person blank", async () => {
    expect(await runAgent(base({ stream: fakeStream([[]]), executeTool: jest.fn() }))).toMatch(/couldn't come up with an answer/);
  });
});

describe("broken replies never reach the person", () => {
  const garbled = (text) => async () => {
    const stream = fakeStream([[{ text }], [{ text: "You are owed ₹10." }]]);
    const deltas = [];
    const final = await runAgent(base({ stream, executeTool: jest.fn(), onDelta: (t) => deltas.push(t) }));
    expect([final, deltas]).toEqual(["You are owed ₹10.", ["You are owed ₹10."]]);
    expect(stream.requests[1].messages.at(-1).role).toBe("user"); // the model is asked again
  };

  test("leaked reasoning is thrown away and the model asked again", garbled("analysis: The user wants to refund ₹500 to Bombay"));
  test("raw tool markup counts as broken", garbled("<tool_call> <function=propose_record_payment> <parameter=amount> 5000"));
  test("a tool call written out as text counts as broken", garbled('First open the area: open_area({ "area": "payments" })'));
  test("a word repeated over and over counts as broken", garbled("The user wants dues dues dues dues dues dues dues"));
  test("claiming a card that was never made counts as broken", garbled("I'll record ₹500. Please tap **Confirm** on the card that appears."));

  test("a card that was made can be mentioned", async () => {
    const stream = fakeStream([[{ toolCalls: [{ id: "c1", name: "propose_x", args: {} }] }], [{ text: "Tap **Confirm** to add Om Traders." }]]);
    const final = await runAgent(base({ stream, executeTool: jest.fn().mockResolvedValue({ text: "Card shown", action: { id: "a1" } }) }));
    expect(final).toBe("Tap **Confirm** to add Om Traders.");
  });

  test("a card still pending from earlier in the conversation can be pointed to", async () => {
    const history = [
      { role: "user", content: "add Om Traders" },
      { role: "assistant", content: "Tap Confirm to add Om Traders.\n[card: New customer Om Traders — pending]" },
      { role: "user", content: "what now?" },
    ];
    const stream = fakeStream([[{ text: "Tap **Confirm** on the card above." }]]);
    expect(await runAgent(base({ history, stream, executeTool: jest.fn() }))).toBe("Tap **Confirm** on the card above.");
  });

  test("broken twice: the person gets the plain fallback, not the garbage", async () => {
    const stream = fakeStream([[{ text: "analysis: hmm" }], [{ text: "analysis: hmm again" }]]);
    const deltas = [];
    const final = await runAgent(base({ stream, executeTool: jest.fn(), onDelta: (t) => deltas.push(t) }));
    expect(final).toMatch(/couldn't come up with an answer/);
    expect(deltas.join("")).not.toMatch(/analysis/);
  });
});

describe("fitHistory", () => {
  const msgs = [{ role: "user", content: "a".repeat(4000) }, { role: "assistant", content: "b".repeat(400) }, { role: "user", content: "q" }];

  test("keeps the newest messages that fit and starts with a person's message", () => {
    expect(fitHistory(msgs, 200)).toEqual([{ role: "user", content: "q" }]);
    expect(fitHistory(msgs, 2000)).toHaveLength(3);
  });

  test("the new question is kept even when it alone is over budget", () => {
    expect(fitHistory([{ role: "user", content: "x".repeat(10000) }], 10)).toHaveLength(1);
  });
});

describe("runAssistant", () => {
  test("sends Sage's instructions, the always-on tools and the fitted history", async () => {
    const stream = fakeStream([[{ text: "ok" }]]);
    expect(await runAssistant([{ role: "user", content: "hi" }], { onDelta: noop, onStatus: noop }, {}, { stream })).toBe("ok");
    const req = stream.requests[0];
    expect(req.system).toMatch(/^You are Sage/);
    expect(req.tools.map((t) => t.name)).toEqual(expect.arrayContaining(["dues", "customer_summary", "period_summary", "find", "open_area", "run_query"]));
    expect(req.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  describe("the switchboard", () => {
    // A stand-in for an action tool in the payments area.
    const paymentsTool = { name: "propose_x", area: "payments", input: z.object({}), declaration: { name: "propose_x", description: "x", parameters: { type: "object" } }, run: async () => "ok" };
    const tools = () => [...READ_TOOLS, paymentsTool];
    const names = (req) => req.tools.map((t) => t.name);

    test("an area's tools are off until the area is open", async () => {
      const stream = fakeStream([[{ text: "Hello!" }]]);
      await runAssistant([{ role: "user", content: "hello" }], { onDelta: noop, onStatus: noop }, {}, { stream, tools: tools() });
      expect(names(stream.requests[0])).not.toContain("propose_x");
    });

    test("words in the message open likely areas up front", async () => {
      const stream = fakeStream([[{ text: "ok" }]]);
      await runAssistant([{ role: "user", content: "Bombay Saree Centre paid 500" }], { onDelta: noop, onStatus: noop }, {}, { stream, tools: tools() });
      expect(names(stream.requests[0])).toContain("propose_x");
    });

    test("open_area switches an area on for the next round", async () => {
      const stream = fakeStream([[{ toolCalls: [{ id: "c1", name: "open_area", args: { area: "payments" } }] }], [{ text: "done" }]]);
      await runAssistant([{ role: "user", content: "hello" }], { onDelta: noop, onStatus: noop }, {}, { stream, tools: tools() });
      expect([names(stream.requests[0]).includes("propose_x"), names(stream.requests[1]).includes("propose_x")]).toEqual([false, true]);
      expect(stream.requests[1].messages.at(-1).results[0].result).toMatch(/payment/i); // the guide came back
    });
  });
});
