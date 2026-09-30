"use strict";

const db = require("../src/models");
const { buildDirectory, buildCustomerSummary } = require("../src/services/lists/customerDirectory");
const { findSimilar } = require("../src/services/customerSimilar");
const { readCustomerBody, CustomerFieldError } = require("../src/services/customerFields");
const { getDirectory, getCustomerSummary, getSimilar, createCustomer: createCustomerApi, updateCustomer } = require("../src/controllers/customerController");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const TODAY = "2026-09-30";
const kg = (qty, rate) => ({ unit: "KG", quantity_kg: String(qty), rate_per_kg: String(rate), productSize: { rate_per_kg: String(rate), size_label: "14x18" } });
const order = (o) => ({
  id: "x", customer_id: "c1", customerName: "alpha Bags", customerPhone: null, order_date: "2026-09-20",
  created_at: "2026-09-20T10:00:00Z", status: "DELIVERED", custom_plate_charge: null, round_off_amount: "0.00",
  advance_received: "0.00", invoice_id: null, plateType: { charge: "0.00" }, payments: [], orderProductSizes: [kg(10, 100)], ...o,
});
const pay = (amount, payment_type = "PARTIAL") => ({ id: `p${amount}`, amount: String(amount), payment_type, payment_date: "2026-09-21", payment_method: "CASH", reference_number: null, notes: null });

const CUSTOMERS = [
  { id: "c1", name: "alpha Bags", metadata: { phone: "98765 43210", city: "Bidar" }, created_at: "2025-06-01T00:00:00Z" },
  { id: "c2", name: "Beta Stores", metadata: {} },
  { id: "c3", name: "12 Star Traders", metadata: {} },
  { id: "c4", name: "Zed", metadata: { phone: "08217 453398" } },
];
const ORDERS = [
  order({ id: "a", order_date: "2026-09-28", payments: [pay(400)] }),                                   // c1 due 600
  order({ id: "e", order_date: "2026-07-01", status: "IN_PROGRESS" }),                                  // c1 due 1000, 91 days
  order({ id: "d", order_date: "2026-09-02", status: "CANCELLED" }),                                    // c1 cancelled
  order({ id: "b", customer_id: "c2", order_date: "2026-09-28", payments: [pay(1000, "FINAL")] }),     // c2 paid
  order({ id: "c", customer_id: "c3", order_date: "2026-08-15", payments: [pay(1200, "FINAL")] }),     // c3 200 extra
];
const names = (out) => out.rows.map((r) => r.name);

describe("buildDirectory", () => {
  test("A–Z with a letter index; digits under #", () => {
    const out = buildDirectory(CUSTOMERS, ORDERS, {}, TODAY);
    expect(names(out)).toEqual(["12 Star Traders", "alpha Bags", "Beta Stores", "Zed"]);
    expect(out.letters).toEqual([{ letter: "#", index: 0 }, { letter: "A", index: 1 }, { letter: "B", index: 2 }, { letter: "Z", index: 3 }]);
  });

  test("row figures: dues only from counted orders, extra received never shown as due", () => {
    const rows = buildDirectory(CUSTOMERS, ORDERS, {}, TODAY).rows;
    expect(rows[1]).toEqual({ id: "c1", name: "alpha Bags", phone: "98765 43210", city: "Bidar", due: 1600, ordersCount: 2, lastOrderDate: "2026-09-28", oldestUnpaidDays: 91 });
    expect(rows[0]).toMatchObject({ id: "c3", due: 0, ordersCount: 1 });
    expect(rows[3]).toMatchObject({ id: "c4", due: 0, ordersCount: 0, lastOrderDate: null, oldestUnpaidDays: null });
  });

  test("owe money: only customers who owe, oldest first; summary", () => {
    const out = buildDirectory(CUSTOMERS, ORDERS, { owe: "1" }, TODAY);
    expect(names(out)).toEqual(["alpha Bags"]);
    expect(out.summary).toEqual({ count: 4, owingCount: 1, due: 1600 });
    expect(out.letters).toEqual([]);
  });

  test("search by name or by 3+ phone digits", () => {
    expect(names(buildDirectory(CUSTOMERS, ORDERS, { search: "ALPHA" }, TODAY))).toEqual(["alpha Bags"]);
    expect(names(buildDirectory(CUSTOMERS, ORDERS, { search: "43210" }, TODAY))).toEqual(["alpha Bags"]);
    expect(names(buildDirectory(CUSTOMERS, ORDERS, { search: "453" }, TODAY))).toEqual(["Zed"]);
  });

  test("recent: last order first, then name; never-ordered last", () => {
    expect(names(buildDirectory(CUSTOMERS, ORDERS, { sort: "recent" }, TODAY))).toEqual(["alpha Bags", "Beta Stores", "12 Star Traders", "Zed"]);
  });
});

describe("buildCustomerSummary", () => {
  test("figures, orders and payments for one customer", () => {
    const mine = ORDERS.filter((o) => o.customer_id === "c1");
    const s = buildCustomerSummary(CUSTOMERS[0], mine, TODAY);
    expect(s.customer).toEqual({ id: "c1", name: "alpha Bags", phone: "98765 43210", email: null, address: null, city: "Bidar", gstin: null, createdAt: "2025-06-01T00:00:00Z" });
    expect([s.owes, s.credit, s.oldestUnpaidDays, s.totalBusiness, s.received, s.ordersCount]).toEqual([1600, 0, 91, 2000, 400, 2]);
    expect(s.orders.map((o) => o.id)).toEqual(["a", "d", "e"]);
    expect(s.payments).toEqual([{ id: "p400", orderId: "a", orderDate: "2026-09-28", orderCancelled: false, amount: 400, type: "PARTIAL", method: "CASH", date: "2026-09-21", reference: null, notes: null }]);
    expect(s.legacyAdvances).toEqual([]);
  });

  test("an advance kept only on the order is listed so received adds up", () => {
    const s = buildCustomerSummary(CUSTOMERS[0], [order({ id: "L", advance_received: "300.00" })], TODAY);
    expect(s.received).toBe(300);
    expect(s.legacyAdvances).toEqual([{ orderId: "L", orderDate: "2026-09-20", amount: 300 }]);
  });
});

describe("findSimilar", () => {
  const LIST = ["Sri Veerbhadreshwar", "Veerbhadreshwar Garments", "Om Sai Tailor (Gurunath)", "Anand Packaging", "Laxmi Bags"]
    .map((name, i) => ({ id: `s${i}`, name }));
  const found = (name, excludeId) => findSimilar(name, LIST, excludeId).map((c) => c.name);

  test("shared distinctive word", () => expect(found("Veerbhadreshwar Tex")).toEqual(["Sri Veerbhadreshwar", "Veerbhadreshwar Garments"]));
  test("one name inside the other", () => expect(found("Om Sai Tailor")).toEqual(["Om Sai Tailor (Gurunath)"]));
  test("same name ignoring case and spaces", () => expect(found("laxmi  BAGS")).toEqual(["Laxmi Bags"]));
  test("common trade words alone don't match", () => expect(found("Ganesh Packaging")).toEqual([]));
  test("too short to compare", () => expect(found("La")).toEqual([]));
  test("the customer being edited is not their own duplicate", () => expect(found("Laxmi Bags", "s4")).toEqual([]));
});

describe("readCustomerBody", () => {
  test("trims, uppercases GSTIN, and marks cleared fields for removal", () => {
    expect(readCustomerBody({ name: "  Laxmi  ", phone: "9876543210", city: " Bidar ", gstin: "29abcde1234f1z5", email: "" }))
      .toEqual({ name: "Laxmi", patch: { phone: "9876543210", city: "Bidar", gstin: "29ABCDE1234F1Z5" }, remove: ["email"] });
  });
  test("name is required", () => expect(() => readCustomerBody({ name: "  " })).toThrow("Customer name is required"));
  test("GSTIN must look like one", () => {
    expect(() => readCustomerBody({ name: "X", gstin: "29ABC" })).toThrow(CustomerFieldError);
    expect(() => readCustomerBody({ name: "X", gstin: "29ABC" })).toThrow("GSTIN should be 15 characters, like 29ABCDE1234F1Z5");
  });
});

describe("customer endpoints", () => {
  const call = async (fn, req) => {
    const res = mockRes();
    await fn({ query: {}, params: {}, body: {}, ...req }, res);
    return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
  };
  let plate;
  let size;
  const orderFor = (customer, qty) => createOrderWithLines({ customer, plateType: plate, lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: String(qty), rate_per_kg: "100.00" }] });

  beforeEach(async () => {
    plate = await createPlateType("0.00");
    size = await createSize({ rate_per_kg: "100.00" });
  });

  test("a customer's page shows only their orders, even when another name contains theirs", async () => {
    const mine = await createCustomer("Veerbhadreshwar");
    const other = await createCustomer("Sri Veerbhadreshwar");
    const o = await orderFor(mine, 2);
    await orderFor(other, 5);
    const res = await call(getCustomerSummary, { params: { id: mine.id } });
    expect(res.status).toBe(200);
    expect(res.body.data.orders.map((x) => x.id)).toEqual([o.id]);
    expect(res.body.data.owes).toBe(200);
  });

  test("unknown customer → 404", async () => {
    expect((await call(getCustomerSummary, { params: { id: "00000000-0000-0000-0000-000000000000" } })).status).toBe(404);
  });

  test("directory and similar names come with dues", async () => {
    const c = await createCustomer("Laxmi Bags");
    await orderFor(c, 3);
    const dir = await call(getDirectory, { query: { owe: "1" } });
    expect(dir.body.data.rows).toEqual([expect.objectContaining({ name: "Laxmi Bags", due: 300 })]);
    const sim = await call(getSimilar, { query: { name: "laxmi bags" } });
    expect(sim.body.data).toEqual([{ id: c.id, name: "Laxmi Bags", phone: null, due: 300 }]);
  });

  test("create and edit keep city and GSTIN; a bad GSTIN is refused", async () => {
    const made = await call(createCustomerApi, { body: { name: " Laxmi ", phone: "9876543210", city: "Bidar", gstin: "29abcde1234f1z5" } });
    expect(made.status).toBe(201);
    const row = await db.Customer.findByPk(made.body.data.id);
    expect([row.name, row.metadata]).toEqual(["Laxmi", { phone: "9876543210", city: "Bidar", gstin: "29ABCDE1234F1Z5" }]);

    const edited = await call(updateCustomer, { params: { id: row.id }, body: { name: "Laxmi", city: "", address: "Main road" } });
    expect(edited.status).toBe(200);
    expect((await row.reload()).metadata).toEqual({ phone: "9876543210", gstin: "29ABCDE1234F1Z5", address: "Main road" });

    expect((await call(createCustomerApi, { body: { name: "Y", gstin: "bad" } })).status).toBe(400);
  });
});
