"use strict";

const { z } = require("zod");
const db = require("../src/models");
const { executeTool } = require("../src/assistant/tools/executeTool");
const { defineTool, parseArgs } = require("../src/assistant/tools/defineTool");
const { money } = require("../src/assistant/tools/fields");
const { READ_TOOLS } = require("../src/assistant/tools");
const { closePool } = require("../src/assistant/db/assistantDb");
const { computeOverview, computePeriod } = require("../src/services/dashboard/metrics");
const { loadLedger, loadOrders } = require("../src/services/dashboard/ledger");
const { buildCustomerSummary } = require("../src/services/lists/customerDirectory");
const { todayIST, resolvePeriod } = require("../src/services/dashboard/dateRanges");
const { rupee } = require("../src/assistant/format");
const { TOOL_RESULT_CHARS } = require("../src/assistant/config");
const { createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

afterAll(() => closePool());

const run = async (name, args) => (await executeTool(READ_TOOLS, { name, args }, {})).text;

describe("read tools", () => {
  let surat;
  let delhi;
  let plate;
  let pcsSize;

  beforeEach(async () => {
    surat = await db.Customer.create({ name: "Sharma Traders", metadata: { phone: "9876500001", city: "Surat" } });
    delhi = await db.Customer.create({ name: "Sharma Traders", metadata: { phone: "9876500002", city: "Delhi" } });
    plate = await createPlateType("1500.00");
    const kgSize = await createSize({ size_label: "12 x 16", rate_per_kg: "180.00" });
    pcsSize = await createSize({ size_label: "14 x 18", rate_per_kg: "0.00", piece_price_amount: "375", piece_price_count: 1000 });
    const order = await createOrderWithLines({
      customer: surat, plateType: plate, order_date: todayIST(),
      lines: [{ product_size_id: kgSize.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "180.00" }],
    });
    await db.Payment.create({ order_id: order.id, customer_id: surat.id, amount: "1000.00", payment_type: "PARTIAL", payment_date: todayIST() });
  });

  test("find customer by name lists every match with its id", async () => {
    const text = await run("find", { kind: "customer", text: "sharma" });
    expect(text).toContain(`${surat.id} | Sharma Traders | 9876500001 | Surat`);
    expect(text).toContain(`${delhi.id} | Sharma Traders | 9876500002 | Delhi`);
  });

  test("find customer by phone digits", async () => {
    const text = await run("find", { kind: "customer", text: "500002" });
    expect(text).toContain(delhi.id);
    expect(text).not.toContain(surat.id);
  });

  test("find size matches labels written either way and says what is not saved", async () => {
    const text = await run("find", { kind: "size", text: "14x18" });
    expect(text).toBe(`${pcsSize.id} | 14 x 18 | rate/kg not saved | pcs price ₹375 per 1000`);
  });

  test("find plate lists plates with their charge", async () => {
    expect(await run("find", { kind: "plate", text: null })).toContain(`${plate.id} | ${plate.type_name} | ₹1,500`);
  });

  test("find order lists a customer's orders with the due the screens show", async () => {
    const text = await run("find", { kind: "order", customer_id: surat.id });
    expect(text).toMatch(/\| 12 x 16 10 kg \| Pending \| total ₹3,300 \| due ₹2,300$/);
    expect(await run("find", { kind: "order" })).toMatch(/customer_id/);
  });

  test("dues gives the dashboard's figures", async () => {
    const o = computeOverview(await loadLedger(db), todayIST());
    const text = await run("dues", {});
    expect(text).toContain(`To collect ${rupee(o.toCollect)} from 1 customers`);
    expect(text).toContain(`${surat.id} | Sharma Traders | ₹2,300 | 1 orders`);
  });

  test("customer_summary gives the customer page's figures", async () => {
    const s = buildCustomerSummary(surat.toJSON(), await loadOrders(db, { is_archived: false, customer_id: surat.id }), todayIST());
    const text = await run("customer_summary", { customer_id: surat.id });
    expect(text).toContain(`Owes ${rupee(s.owes)} | credit ${rupee(s.credit)} | business ${rupee(s.totalBusiness)} | received ${rupee(s.received)}`);
    expect(await run("customer_summary", { customer_id: "00000000-0000-4000-8000-000000000000" })).toMatch(/No customer with that id/);
  });

  test("period_summary gives the dashboard period card's figures", async () => {
    const ledger = await loadLedger(db);
    const { range, compare } = resolvePeriod({ preset: "this_month" }, todayIST(), ledger.earliest, ledger.latest);
    const p = computePeriod(ledger, range, compare);
    const text = await run("period_summary", { preset: "this_month" });
    expect(text).toContain(`Sales ${rupee(p.sales.value)}`);
    expect(text).toContain(`Collected ${rupee(p.collected.value)}`);
    expect(await run("period_summary", { preset: "custom", from: "2026-09-10", to: "2026-09-01" })).toBe("From date must be on or before To date");
  });

  test("run_query answers with rows", async () => {
    expect(await run("run_query", { sql: "SELECT 1 AS n" })).toBe('{"rowCount":1,"rows":[{"n":1}]}');
  });
});

describe("executeTool", () => {
  const echo = defineTool({ name: "echo", description: "d", input: z.object({ word: z.string() }), run: ({ word }) => word.repeat(10000) });

  test("bad arguments come back as an error the model can read", async () => {
    expect((await executeTool([echo], { name: "echo", args: { word: 5 } }, {})).text).toMatch(/^\{"error":"word: /);
  });

  test("an unknown tool is an error, not a crash", async () => {
    expect((await executeTool([echo], { name: "nope", args: {} }, {})).text).toBe('{"error":"There is no tool called nope"}');
  });

  test("long results are cut to the budget", async () => {
    const { text } = await executeTool([echo], { name: "echo", args: { word: "ab" } }, {});
    expect(text.length).toBeLessThanOrEqual(TOOL_RESULT_CHARS + 10);
    expect(text.endsWith("…[cut]")).toBe(true);
  });

  test("nulls are treated as not given, at any depth", () => {
    const schema = z.object({ a: z.string().optional(), list: z.array(z.object({ b: z.number().optional() })) });
    expect(parseArgs(schema, { a: null, list: [{ b: null }] })).toEqual({ list: [{}] });
  });

  test("money accepts text with ₹ and commas", () => {
    const schema = z.object({ amount: money() });
    expect(["5,000", "₹5000", "5000.00", 5000].map((amount) => parseArgs(schema, { amount }).amount)).toEqual([5000, 5000, 5000, 5000]);
    expect(() => parseArgs(schema, { amount: "five" })).toThrow(/amount/);
  });

  test("every read tool declares JSON Schema parameters", () => {
    for (const t of READ_TOOLS) expect(t.declaration.parameters).toMatchObject({ type: "object" });
  });
});
