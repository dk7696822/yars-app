"use strict";

const { z } = require("zod");
const db = require("../src/models");
const { defineAction } = require("../src/assistant/actionKit/defineAction");
const { ActionError } = require("../src/assistant/actionKit/errors");
const service = require("../src/assistant/actionKit/actionService");
const { actionTool } = require("../src/assistant/actionKit/actionTool");
const createCustomerCommand = require("../src/commands/customers/createCustomer");

// A small action on top of a real command: add a customer by name.
const addShop = defineAction({
  name: "add_shop",
  area: "customers",
  summary: "Add a shop (test)",
  description: "Add a shop by name",
  input: z.object({ name: z.string() }),
  resolve: async ({ name }) => {
    if (name === "ask") throw new ActionError("Which shop do you mean?");
    return { name };
  },
  preview: async (resolved, { transaction, result, models }) => ({
    title: `New customer ${resolved.name}`,
    rows: [{ label: "Seen in trial", value: String(Boolean(await models.Customer.findByPk(result.id, { transaction }))) }],
    warnings: [],
  }),
  command: createCustomerCommand,
  toCommandInput: (r) => ({ name: r.name }),
  fingerprint: async (input, { models, transaction }) => ({ customers: await models.Customer.count({ transaction }) }),
  context: (r) => ({ asked: r.name }),
  resultLink: (result) => `/customers/${result.id}`,
  formLink: (input, id) => `/customers/new?assistant=${id}`,
  trialRunSafe: true,
  evals: [],
});
const registry = new Map([[addShop.name, addShop]]);

let conversationId;
beforeEach(async () => {
  conversationId = (await db.AssistantConversation.create({})).id;
});

const propose = (name) => service.propose(addShop, { name }, { conversationId, requestText: `add ${name}` });

describe("propose", () => {
  test("runs the real save, shows the card, and leaves the database as it was", async () => {
    const shown = await propose("Laxmi Stores");
    expect(shown).toMatchObject({ name: "add_shop", status: "pending", card: { title: "New customer Laxmi Stores", rows: [{ label: "Seen in trial", value: "true" }] } });
    expect(shown.formLink).toBe(`/customers/new?assistant=${shown.id}`);
    expect(await db.Customer.count()).toBe(0);
    const row = await db.AssistantAction.findByPk(shown.id);
    expect(row).toMatchObject({ payload: { name: "Laxmi Stores" }, context: { asked: "Laxmi Stores" }, fingerprint: { customers: 0 }, request_text: "add Laxmi Stores" });
  });

  test("a question back to the person stores nothing", async () => {
    await expect(propose("ask")).rejects.toThrow("Which shop do you mean?");
    expect(await db.AssistantAction.count()).toBe(0);
  });

  test("the app's own refusal is passed on", async () => {
    await expect(propose("")).rejects.toThrow("The app would refuse this: Customer name is required");
  });

  test("as a tool: the model reads a line, the app gets the card", async () => {
    const out = await actionTool(addShop).run({ name: "Om Traders" }, { conversationId });
    expect(out.text).toMatch(/^Card shown to the person: New customer Om Traders\. They must tap Confirm/);
    expect(out.action.status).toBe("pending");
    expect(actionTool(addShop).declaration).toMatchObject({ name: "propose_add_shop", parameters: { type: "object" } });
    expect(actionTool(addShop).area).toBe("customers"); // the switchboard turns it on with its area
  });
});

describe("confirm", () => {
  test("saves once; a second tap returns the same result", async () => {
    const { id } = await propose("Kept");
    const first = await service.confirm(registry, id, {});
    const second = await service.confirm(registry, id, {});
    expect(first).toMatchObject({ status: "confirmed", resultLink: expect.stringMatching(/^\/customers\//) });
    expect(second).toEqual(first);
    expect(await db.Customer.count()).toBe(1);
  });

  test("concurrent confirms save once", async () => {
    const { id } = await propose("Twice");
    const [a, b] = await Promise.all([service.confirm(registry, id, {}), service.confirm(registry, id, {})]);
    expect([a.status, b.status]).toEqual(["confirmed", "confirmed"]);
    expect(await db.Customer.count()).toBe(1);
  });

  test("an expired card can't be confirmed", async () => {
    const { id } = await propose("Late");
    await db.AssistantAction.update({ expires_at: new Date(Date.now() - 1000) }, { where: { id } });
    expect((await service.confirm(registry, id, {})).status).toBe("expired");
    expect((await db.AssistantAction.findByPk(id)).status).toBe("expired");
    expect(await db.Customer.count()).toBe(0);
  });

  test("if what the card was based on changed, it refuses", async () => {
    const { id } = await propose("Stale");
    await db.Customer.create({ name: "Someone else" });
    const shown = await service.confirm(registry, id, {});
    expect(shown).toMatchObject({ status: "failed", error: "This changed after Sage suggested it — ask again." });
    expect(await db.Customer.count()).toBe(1);
  });

  test("a refusal at confirm marks the card failed and saves nothing", async () => {
    const { id } = await propose("Fine");
    await db.AssistantAction.update({ payload: { name: "" } }, { where: { id } });
    expect(await service.confirm(registry, id, {})).toMatchObject({ status: "failed", error: "Customer name is required" });
    expect(await db.Customer.count()).toBe(0);
  });

  test("an unknown card is a 404", async () => {
    await expect(service.confirm(registry, "00000000-0000-4000-8000-000000000000", {})).rejects.toMatchObject({ status: 404 });
  });
});

describe("cancel and open in form", () => {
  test("a cancelled card stays cancelled", async () => {
    const { id } = await propose("Nope");
    expect((await service.cancel(id)).status).toBe("cancelled");
    expect((await service.confirm(registry, id, {})).status).toBe("cancelled");
    expect(await db.Customer.count()).toBe(0);
  });

  test("the form gets the payload; finishing in the form records what changed", async () => {
    const { id } = await propose("Form Shop");
    expect(await service.formData(id)).toMatchObject({ payload: { name: "Form Shop" }, context: { asked: "Form Shop" } });
    const done = await service.completedInForm(id, { resultId: "11111111-1111-4111-8111-111111111111", saved: { name: "Form Shop Ltd", phone: "98765 43210" } });
    expect(done.status).toBe("completed_in_form");
    expect((await db.AssistantAction.findByPk(id)).outcome).toEqual({ changed: ["name", "phone"] });
  });

  test("changedKeys compares form lines only on the fields the card set", () => {
    const card = { product_sizes: [{ product_size_id: "s1", unit: "KG", quantity_kg: 20, rate_per_kg: 180 }] };
    expect(service.changedKeys(card, { product_sizes: [{ product_size_id: "s1", unit: "KG", quantity_kg: "20", rate_per_kg: 180, weight_kg: "", weight_source: null }] })).toEqual([]);
    expect(service.changedKeys(card, { product_sizes: [{ product_size_id: "s1", unit: "KG", quantity_kg: 25, rate_per_kg: 180 }] })).toEqual(["product_sizes"]);
    expect(service.changedKeys(card, { product_sizes: [...card.product_sizes, { product_size_id: "s2" }] })).toEqual(["product_sizes"]);
  });

  test("finishing in the form with a bad result id still records the outcome (id dropped)", async () => {
    const { completedInForm } = require("../src/controllers/assistantActionController");
    const { mockRes } = require("./helpers/http");
    const { id } = await propose("Bad Id Shop");
    const res = mockRes();
    await completedInForm({ params: { id }, body: { result_id: "not-a-uuid", saved: { name: "Bad Id Shop" } } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect((await db.AssistantAction.findByPk(id)).result_id).toBeNull();
  });

  test("changedKeys ignores number formatting", () => {
    expect(service.changedKeys({ amount: 5000, lines: [{ q: "10" }] }, { amount: "5000.00", lines: [{ q: 10 }] })).toEqual([]);
  });
});

describe("defineAction", () => {
  test("refuses an action missing a piece", () => {
    expect(() => defineAction({ name: "x" })).toThrow(/missing area/);
    expect(() => defineAction({ ...addShop, name: "y", trialRunSafe: undefined })).toThrow(/trialRunSafe/);
  });
});
