"use strict";

const db = require("../src/models");
const service = require("../src/assistant/actionKit/actionService");
const { registry } = require("../src/assistant/actionKit/registry");
const { createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const action = (name) => registry.get(name);
let conversationId;
let bombay;
let plate;
let kgSize;
let pcsSize;
let order;

beforeEach(async () => {
  conversationId = (await db.AssistantConversation.create({})).id;
  bombay = await db.Customer.create({ name: "Bombay Saree Centre", metadata: { phone: "9876500003" } });
  plate = await createPlateType("1500.00");
  kgSize = await createSize({ size_label: "12 x 16", rate_per_kg: "180.00" });
  pcsSize = await createSize({ size_label: "14 x 18", rate_per_kg: "0.00", piece_price_amount: "375", piece_price_count: 1000 });
  order = await createOrderWithLines({
    customer: bombay, plateType: plate, order_date: "2026-09-12",
    lines: [{ product_size_id: kgSize.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "180.00" }],
  });
  await db.Payment.create({ order_id: order.id, customer_id: bombay.id, amount: "1000.00", payment_type: "PARTIAL", payment_date: "2026-09-13" });
});

const propose = (name, args) => service.propose(action(name), args, { conversationId });
const row = (card, label) => card.rows.find((r) => r.label === label);

describe("record_payment", () => {
  test("card shows the due before and after; confirm saves it as the sheet would", async () => {
    const shown = await propose("record_payment", { order_id: order.id, amount: 2000, method: "UPI", date: "2026-10-01" });
    expect(shown.card.title).toBe("Record payment ₹2,000");
    expect(row(shown.card, "Due")).toEqual({ label: "Due", value: "₹300", before: "₹2,300", after: "₹300" });
    expect(row(shown.card, "Type").value).toBe("Part payment");
    expect(shown.formLink).toBe(`/orders/${order.id}?pay=assistant:${shown.id}`);

    const done = await service.confirm(registry, shown.id, {});
    expect(done).toMatchObject({ status: "confirmed", resultLink: `/orders/${order.id}` });
    const pay = await db.Payment.findOne({ where: { order_id: order.id, payment_method: "UPI" } });
    expect([Number(pay.amount), pay.payment_type, pay.payment_date]).toEqual([2000, "PARTIAL", "2026-10-01"]);
    const log = await db.AuditLog.findOne({ where: { entity_type: "PAYMENT", entity_id: pay.id } });
    expect(log.metadata).toMatchObject({ source: "assistant", assistant_action_id: shown.id });
  });

  test("paying more than the due warns, exactly like the sheet", async () => {
    const shown = await propose("record_payment", { order_id: order.id, amount: 2500 });
    expect(shown.card.warnings).toEqual(["That's ₹200 more than the due. It will show as extra received."]);
    expect(row(shown.card, "Type").value).toBe("Final payment");
  });

  test("record_payment refuses after another payment", async () => {
    const shown = await propose("record_payment", { order_id: order.id, amount: 500 });
    await db.Payment.create({ order_id: order.id, customer_id: bombay.id, amount: "100.00", payment_type: "PARTIAL", payment_date: "2026-10-01" });
    const done = await service.confirm(registry, shown.id, {});
    expect(done.status).toBe("failed");
    expect(done.error).toMatch(/changed/);
  });

  test("record_payment refuses after the order's lines were edited", async () => {
    const shown = await propose("record_payment", { order_id: order.id, amount: 500 });
    const updateOrder = require("../src/commands/orders/updateOrder");
    const { runCommand } = require("../src/commands/runCommand");
    await runCommand(updateOrder, { id: order.id, product_sizes: [{ product_size_id: kgSize.id, unit: "KG", quantity_kg: 20, rate_per_kg: 180 }] });
    const done = await service.confirm(registry, shown.id, {});
    expect(done.status).toBe("failed");
    expect(await db.Payment.count({ where: { order_id: order.id } })).toBe(1); // only the original payment
  });

  test("two different payment cards on one order confirmed at once: only one saves", async () => {
    const a = await propose("record_payment", { order_id: order.id, amount: 300 });
    const b = await propose("record_payment", { order_id: order.id, amount: 400 });
    const results = await Promise.all([service.confirm(registry, a.id, {}), service.confirm(registry, b.id, {})]);
    expect(results.map((r) => r.status).sort()).toEqual(["confirmed", "failed"]);
    expect(await db.Payment.count({ where: { order_id: order.id } })).toBe(2); // the original + exactly one
  });

  test("a refund above what was received is refused by the app's own rule", async () => {
    await expect(propose("record_payment", { order_id: order.id, amount: 1500, refund: true })).rejects.toThrow("The app would refuse this: A refund can't be more than received (₹1,000)");
  });

  test("a cancelled order takes no payments", async () => {
    await order.update({ status: "CANCELLED" });
    await expect(propose("record_payment", { order_id: order.id, amount: 100 })).rejects.toThrow(/cancelled/);
  });
});

describe("create_customer", () => {
  test("stores the mobile the way the form does and warns about look-alikes", async () => {
    const shown = await propose("create_customer", { name: "Bombay Saree Centre", phone: "+91 98450 12345", city: "Hubli" });
    expect(row(shown.card, "Phone").value).toBe("9845012345");
    expect(shown.card.warnings).toEqual(["Looks like an existing customer: Bombay Saree Centre (9876500003)"]);
    const done = await service.confirm(registry, shown.id, {});
    const saved = await db.Customer.findByPk(done.resultLink.split("/").pop());
    expect(saved.metadata).toEqual({ phone: "9845012345", city: "Hubli" });
  });

  test("a bad GSTIN is refused with the form's message", async () => {
    await expect(propose("create_customer", { name: "X Shop", gstin: "123" })).rejects.toThrow("GSTIN should be 15 characters, like 29ABCDE1234F1Z5");
  });
});

describe("create_order", () => {
  test("uses the size's saved rate, shows the app's total, and saves the lines", async () => {
    const shown = await propose("create_order", {
      customer_id: bombay.id, plate_type_id: plate.id, order_date: "2026-10-01",
      lines: [{ size_id: kgSize.id, unit: "KG", quantity: 20 }, { size_id: pcsSize.id, unit: "PIECES", quantity: 4000 }],
    });
    // 20 × 180 + 4000 × 375/1000 + plate 1500
    expect(row(shown.card, "Total").value).toBe("₹6,600");
    expect(row(shown.card, "12 x 16").value).toBe("20 kg × ₹180 = ₹3,600");
    expect(row(shown.card, "14 x 18").value).toBe("4000 pcs at ₹375 per 1000 = ₹1,500");
    expect(shown.formLink).toBe(`/orders/new?assistant=${shown.id}`);
    const payload = (await service.formData(shown.id)).payload;
    expect(payload.product_sizes[0]).toEqual({ product_size_id: kgSize.id, unit: "KG", quantity_kg: 20, rate_per_kg: 180 });

    const done = await service.confirm(registry, shown.id, {});
    const id = done.resultLink.split("/").pop();
    expect(await db.OrderProductSize.count({ where: { order_id: id } })).toBe(2);
    const log = await db.AuditLog.findOne({ where: { entity_type: "ORDER", entity_id: id } });
    expect(log.metadata.source).toBe("assistant");
  });

  test("never invents a rate: a size without one makes Sage ask", async () => {
    await expect(propose("create_order", { customer_id: bombay.id, plate_type_id: plate.id, lines: [{ size_id: pcsSize.id, unit: "KG", quantity: 5 }] }))
      .rejects.toThrow("Line 1: 14 x 18 has no rate per kg saved — ask the person for the rate.");
  });

  test("a piece price needs both the amount and the number of pieces", async () => {
    await expect(propose("create_order", { customer_id: bombay.id, plate_type_id: plate.id, lines: [{ size_id: pcsSize.id, unit: "PIECES", quantity: 1000, price: 400 }] }))
      .rejects.toThrow(/like ₹375 for 1000 pcs/);
  });

  test("an advance shows as received", async () => {
    const shown = await propose("create_order", { customer_id: bombay.id, plate_type_id: plate.id, advance: 600, lines: [{ size_id: kgSize.id, unit: "KG", quantity: 10 }] });
    expect([row(shown.card, "Advance").value, row(shown.card, "Due").value]).toEqual(["₹600", "₹2,700"]);
  });
});

describe("set_order_status", () => {
  test("marks delivered through the screen's own update", async () => {
    const shown = await propose("set_order_status", { order_id: order.id, status: "DELIVERED" });
    expect(row(shown.card, "Status")).toMatchObject({ before: "Pending", after: "Delivered" });
    await service.confirm(registry, shown.id, {});
    expect((await order.reload()).status).toBe("DELIVERED");
  });

  test("cancelling says it leaves totals and dues", async () => {
    const shown = await propose("set_order_status", { order_id: order.id, status: "CANCELLED" });
    expect(shown.card.title).toBe("Cancel order");
    expect(row(shown.card, "Due in totals")).toMatchObject({ before: "₹2,300", after: "not counted (cancelled)" });
  });

  test("set_order_status refuses after the order's lines were edited", async () => {
    const shown = await propose("set_order_status", { order_id: order.id, status: "CANCELLED" });
    const updateOrder = require("../src/commands/orders/updateOrder");
    const { runCommand } = require("../src/commands/runCommand");
    await runCommand(updateOrder, { id: order.id, product_sizes: [{ product_size_id: kgSize.id, unit: "KG", quantity_kg: 20, rate_per_kg: 180 }] });
    expect((await service.confirm(registry, shown.id, {})).status).toBe("failed");
  });

  test("same status, or a cancelled order going anywhere but Pending, is refused", async () => {
    await expect(propose("set_order_status", { order_id: order.id, status: "PENDING" })).rejects.toThrow("That order is already Pending.");
    await order.update({ status: "CANCELLED" });
    await expect(propose("set_order_status", { order_id: order.id, status: "DELIVERED" })).rejects.toThrow(/only be restored/);
  });
});
