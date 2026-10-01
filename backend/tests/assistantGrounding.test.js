"use strict";

const db = require("../src/models");
const service = require("../src/assistant/actionKit/actionService");
const { registry } = require("../src/assistant/actionKit/registry");
const { numbersIn, mentions } = require("../src/assistant/actionKit/grounding");
const { createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

describe("what the person said", () => {
  test("numbers are read with commas and decimals", () => {
    expect(numbersIn("paid ₹5,000 and 12.5 kg, 1,00,000 pcs")).toEqual([5000, 12.5, 100000]);
  });
  test("names match ignoring case, spaces and punctuation", () => {
    expect(mentions("add a customer ganesh  textiles, hubli", "Ganesh Textiles")).toBe(true);
    expect(mentions("add a customer Ganesh Textiles", "Rohit Traders")).toBe(false);
  });
});

describe("a card only uses values the person gave", () => {
  let conversationId;
  let bombay;
  let plate;
  let size;
  let order;
  beforeEach(async () => {
    conversationId = (await db.AssistantConversation.create({})).id;
    bombay = await db.Customer.create({ name: "Bombay Saree Centre" });
    plate = await createPlateType("1500.00");
    size = await createSize({ size_label: "12 x 16", rate_per_kg: "180.00" });
    order = await createOrderWithLines({ customer: bombay, plateType: plate, lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "180.00" }] });
  });
  const propose = (name, args, userText) => service.propose(registry.get(name), args, { conversationId, userText });

  test("a customer name the person never wrote is refused", async () => {
    await expect(propose("create_customer", { name: "Rohit Traders" }, "Add a new customer Ganesh Textiles, city Hubli")).rejects.toThrow(/Rohit Traders/);
    await expect(propose("create_customer", { name: "Ganesh Textiles" }, "Add a new customer Ganesh Textiles, city Hubli")).resolves.toMatchObject({ status: "pending" });
  });

  test("an order quantity or rate the person never wrote is refused", async () => {
    const args = { customer_id: bombay.id, plate_type_id: plate.id, lines: [{ size_id: size.id, unit: "KG", quantity: 25, rate_per_kg: 200 }] };
    await expect(propose("create_order", args, "order for Bombay, 20 kg of 12 x 16 at 200")).rejects.toThrow(/25/);
    await expect(propose("create_order", { ...args, lines: [{ ...args.lines[0], quantity: 20 }] }, "order for Bombay, 20 kg of 12 x 16 at 200")).resolves.toMatchObject({ status: "pending" });
  });

  test("'per piece' / 'each' counts as a price for 1 piece", async () => {
    const args = (per) => ({ customer_id: bombay.id, plate_type_id: plate.id, lines: [{ size_id: size.id, unit: "PIECES", quantity: 2000, price: 0.6, price_per: per }] });
    await expect(propose("create_order", args(1), "2000 pcs of 12 x 16 at 0.6 per piece")).resolves.toMatchObject({ status: "pending" });
    await expect(propose("create_order", args(1), "2000 pcs of 12 x 16 at 60 paise each")).rejects.toThrow(/0.6/);
    await expect(propose("create_order", args(1), "2000 pcs of 12 x 16 at 0.6 each")).resolves.toMatchObject({ status: "pending" });
  });

  test("a payment amount must be what was said, or the order's full due", async () => {
    await expect(propose("record_payment", { order_id: order.id, amount: 5000 }, "Bombay paid 500")).rejects.toThrow(/5000|5,000/);
    await expect(propose("record_payment", { order_id: order.id, amount: 3300 }, "Bombay paid the full due")).resolves.toMatchObject({ status: "pending" });
  });

  test("without the person's words (tests, evals) nothing is checked", async () => {
    await expect(service.propose(registry.get("create_customer"), { name: "Any Name" }, { conversationId })).resolves.toMatchObject({ status: "pending" });
  });
});
