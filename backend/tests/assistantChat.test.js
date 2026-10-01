"use strict";

jest.mock("../src/assistant", () => ({ runAssistant: jest.fn() }));

const db = require("../src/models");
const { runAssistant } = require("../src/assistant");
const { sendMessage, getConversation } = require("../src/controllers/assistantController");
const service = require("../src/assistant/actionKit/actionService");
const { registry } = require("../src/assistant/actionKit/registry");

const sseRes = () => {
  const res = {
    events: [],
    headersSent: false,
    writableEnded: false,
    set: jest.fn(),
    flushHeaders() { res.headersSent = true; },
    write(chunk) {
      const m = chunk.match(/^event: (\w+)\ndata: (.*)\n\n$/s);
      res.events.push({ event: m[1], data: JSON.parse(m[2]) });
    },
    end() { res.writableEnded = true; },
  };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const jsonRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const send = async (id, text) => {
  const res = sseRes();
  await sendMessage({ params: { id }, body: { text }, user: { sub: null } }, res);
  return res.events;
};
const open = async (id) => {
  const res = jsonRes();
  await getConversation({ params: { id } }, res);
  return res.json.mock.calls[0][0].data;
};

let convId;
beforeEach(async () => {
  runAssistant.mockReset();
  convId = (await db.AssistantConversation.create({})).id;
});

const proposingAnswer = () =>
  runAssistant.mockImplementation(async (history, { onDelta, onAction }, ctx) => {
    onAction(await service.propose(registry.get("create_customer"), { name: "Om Traders" }, ctx));
    onDelta("Tap Confirm to add Om Traders.");
    return "Tap Confirm to add Om Traders.";
  });

describe("chat with cards", () => {
  test("a card made while answering is sent and tied to the saved reply", async () => {
    proposingAnswer();
    const events = await send(convId, "add Om Traders");
    const action = events.find((e) => e.event === "action").data;
    expect(action).toMatchObject({ status: "pending", card: { title: "New customer Om Traders" } });
    const done = events.find((e) => e.event === "done").data;
    expect((await db.AssistantAction.findByPk(action.id)).message_id).toBe(done.messageId);
    expect(runAssistant.mock.calls[0][2]).toMatchObject({ conversationId: convId, requestText: "add Om Traders" });
  });

  test("if the answer fails after a card was made, the card keeps its own reply", async () => {
    runAssistant.mockImplementation(async (history, { onAction }, ctx) => {
      onAction(await service.propose(registry.get("create_customer"), { name: "Late Fail" }, ctx));
      throw new Error("model fell over");
    });
    jest.spyOn(console, "error").mockImplementation(() => {});
    const events = await send(convId, "add Late Fail");
    console.error.mockRestore();
    expect(events.map((e) => e.event)).toEqual(["action", "error"]);
    const conv = await open(convId);
    const reply = conv.messages.find((m) => m.role === "assistant");
    expect(reply.content).toMatch(/busy/);
    expect(conv.actions[0].messageId).toBe(reply.id);
  });

  test("the model sees earlier cards and what happened to them", async () => {
    proposingAnswer();
    await send(convId, "add Om Traders");
    runAssistant.mockReset();
    runAssistant.mockResolvedValue("Okay.");
    await send(convId, "did that work?");
    const history = runAssistant.mock.calls[0][0];
    expect(history[1]).toEqual({ role: "assistant", content: "Tap Confirm to add Om Traders.\n[card: New customer Om Traders — pending]" });
    expect(history[2]).toEqual({ role: "user", content: "did that work?" });
  });

  test("reopened conversation shows expired cards", async () => {
    proposingAnswer();
    await send(convId, "add Om Traders");
    await db.AssistantAction.update({ expires_at: new Date(Date.now() - 1000) }, { where: { conversation_id: convId } });
    const conv = await open(convId);
    expect(conv.actions).toHaveLength(1);
    expect(conv.actions[0]).toMatchObject({ status: "expired", messageId: conv.messages[1].id });
    expect((await service.confirm(registry, conv.actions[0].id, {})).status).toBe("expired");
  });

  test("old conversations open without actions", async () => {
    await db.AssistantMessage.create({ conversation_id: convId, role: "user", content: "kitna baaki hai?" });
    await db.AssistantMessage.create({ conversation_id: convId, role: "assistant", content: "₹10 is due." });
    const conv = await open(convId);
    expect([conv.messages.length, conv.actions]).toEqual([2, []]);
    runAssistant.mockResolvedValue("Still ₹10.");
    const events = await send(convId, "and now?");
    expect(events.map((e) => e.event)).toEqual(["done"]);
  });

  test("when every model is resting, the message names Sage and the wait", async () => {
    runAssistant.mockRejectedValue(Object.assign(new Error("rest"), { name: "QuotaExhaustedError", retryAfterSeconds: 600 }));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const events = await send(convId, "dues?");
    expect(events).toEqual([{ event: "error", data: { message: "Sage's free daily limit is used up for now. Please try again in about 10 minutes." } }]);
    console.error.mockRestore();
  });
});
