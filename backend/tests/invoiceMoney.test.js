"use strict";

const db = require("../src/models");
const { invoiceMoney } = require("../src/services/invoiceMoney");
const { buildInvoiceList } = require("../src/services/lists/invoiceList");
const { generateInvoice, getInvoiceById, listInvoices, updateInvoiceStatus } = require("../src/controllers/invoiceController");
const { createPayment, updatePayment, deletePayment } = require("../src/controllers/paymentController");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const TODAY = "2026-09-30";
const order = (payments = [], o = {}) => ({
  id: "o1", status: "DELIVERED", custom_plate_charge: null, round_off_amount: "0.00", advance_received: "0.00",
  plateType: { charge: "0.00" }, orderProductSizes: [{ unit: "KG", quantity_kg: "10.00", rate_per_kg: "100.00", productSize: { rate_per_kg: "100.00" } }],
  payments, ...o,
}); // total 1000
const pay = (amount, payment_type = "PARTIAL") => ({ amount: String(amount), payment_type });
const inv = (o) => ({ final_amount: "1180.00", status: "PENDING", payment_due_date: "2026-10-30", ...o }); // 1000 + 18% GST

describe("invoiceMoney", () => {
  test("due includes tax and counts payments on the invoice's orders", () => {
    expect(invoiceMoney(inv(), [order([pay(1000, "FINAL")])], [], TODAY))
      .toEqual({ amountPaid: 1000, amountDue: 180, amountExtra: 0, derivedStatus: "PENDING", overdueDays: 0 });
  });
  test("paid in full incl. tax → PAID", () => {
    expect(invoiceMoney(inv(), [order([pay(1000), pay(180)])], [], TODAY).derivedStatus).toBe("PAID");
  });
  test("past the due date and unpaid → OVERDUE with days", () => {
    expect(invoiceMoney(inv({ payment_due_date: "2026-09-10" }), [order()], [], TODAY)).toMatchObject({ derivedStatus: "OVERDUE", overdueDays: 20, amountDue: 1180 });
  });
  test("cancelled stays cancelled", () => {
    expect(invoiceMoney(inv({ status: "CANCELLED" }), [order()], [], TODAY).derivedStatus).toBe("CANCELLED");
  });
  test("a stored PAID without payments is not trusted", () => {
    expect(invoiceMoney(inv({ status: "PAID" }), [order()], [], TODAY).derivedStatus).toBe("PENDING");
  });
  test("more received than billed shows as extra, due 0", () => {
    expect(invoiceMoney(inv(), [order([pay(1300, "FINAL")])], [], TODAY)).toMatchObject({ amountDue: 0, amountExtra: 120, derivedStatus: "PAID" });
  });
  test("refunds reduce paid; invoice-only payments count; legacy advance column counts", () => {
    const m = invoiceMoney(inv(), [order([pay(600), pay(100, "REFUND")]), order([], { id: "o2", advance_received: "200.00" })], [pay(80)], TODAY);
    expect(m.amountPaid).toBe(780);
  });
});

describe("buildInvoiceList", () => {
  const invoices = [
    { id: "i1", invoice_number: "00000031", invoice_date: "2026-07-14", payment_due_date: "2026-08-13", customer_id: "c1", customer: { name: "Sri V", metadata: { phone: "9876543210" } }, total_amount: "18000.00", tax_percent: "0.00", tax_amount: "0.00", final_amount: "18000.00" },
    { id: "i2", invoice_number: "00000033", invoice_date: "2026-09-20", payment_due_date: "2026-10-20", customer_id: "c2", customer: { name: "Bombay Saree", metadata: {} }, total_amount: "12600.00", tax_percent: "0.00", tax_amount: "0.00", final_amount: "12600.00" },
    { id: "i3", invoice_number: "00000034", invoice_date: "2026-09-28", payment_due_date: "2026-10-28", customer_id: "c3", customer: { name: "Festival Bags", metadata: {} }, total_amount: "9050.00", tax_percent: "0.00", tax_amount: "0.00", final_amount: "9050.00" },
  ];
  const money = new Map([
    ["i1", { amountPaid: 0, amountDue: 18000, amountExtra: 0, derivedStatus: "OVERDUE", overdueDays: 48, orders: [{}] }],
    ["i2", { amountPaid: 12600, amountDue: 0, amountExtra: 0, derivedStatus: "PAID", overdueDays: 0, orders: [{}, {}] }],
    ["i3", { amountPaid: 5000, amountDue: 4050, amountExtra: 0, derivedStatus: "PENDING", overdueDays: 0, orders: [{}, {}] }],
  ]);

  test("newest first, counts and total due", () => {
    const out = buildInvoiceList(invoices, money, {});
    expect(out.rows.map((r) => r.number)).toEqual(["00000034", "00000033", "00000031"]);
    expect(out.counts).toEqual({ all: 3, unpaid: 2, overdue: 1 });
    expect(out.summary).toEqual({ due: 22050 });
    expect(out.rows[0]).toEqual({
      id: "i3", number: "00000034", invoiceDate: "2026-09-28", dueDate: "2026-10-28", customer: { id: "c3", name: "Festival Bags", phone: null },
      subtotal: 9050, taxPercent: 0, taxAmount: 0, finalAmount: 9050, ordersCount: 2, amountPaid: 5000, amountDue: 4050, amountExtra: 0, derivedStatus: "PENDING", overdueDays: 0,
    });
  });
  test("chips and search", () => {
    expect(buildInvoiceList(invoices, money, { chip: "unpaid" }).rows.map((r) => r.id)).toEqual(["i3", "i1"]);
    expect(buildInvoiceList(invoices, money, { chip: "overdue" }).rows.map((r) => r.id)).toEqual(["i1"]);
    expect(buildInvoiceList(invoices, money, { search: "saree" }).rows.map((r) => r.id)).toEqual(["i2"]);
    expect(buildInvoiceList(invoices, money, { search: "031" }).rows.map((r) => r.id)).toEqual(["i1"]);
  });
});

describe("invoice endpoints", () => {
  const call = async (fn, req) => {
    const res = mockRes();
    await fn({ query: {}, params: {}, body: {}, ...req }, res);
    return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
  };
  afterEach(() => jest.useRealTimers());

  const setup = async () => {
    const customer = await createCustomer("Festival Bags");
    const plate = await createPlateType("0.00");
    const size = await createSize({ rate_per_kg: "100.00" });
    const line = { product_size_id: size.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "100.00" };
    const o1 = await createOrderWithLines({ customer, plateType: plate, order_date: "2026-09-10", lines: [line] });
    const o2 = await createOrderWithLines({ customer, plateType: plate, order_date: "2026-09-12", lines: [line] });
    return { customer, o1, o2 };
  };

  test("detail and list show due incl. tax from payments on the orders; paying never rewrites the stored status", async () => {
    const { customer, o1, o2 } = await setup();
    await db.Payment.create({ order_id: o1.id, customer_id: customer.id, amount: "1000.00", payment_type: "FINAL", payment_date: "2026-09-11" });
    const made = await call(generateInvoice, { body: { customer_id: customer.id, order_ids: [o1.id, o2.id], tax_percent: 10, payment_due_date: "2099-01-01" } });
    expect(made.status).toBe(201);
    const id = made.body.data.id;

    let detail = (await call(getInvoiceById, { params: { id } })).body.data;
    expect(detail.money).toEqual({ amountPaid: 1000, amountDue: 1200, amountExtra: 0, derivedStatus: "PENDING", overdueDays: 0 });
    expect(detail.orderMoney.map((o) => [o.orderDate, o.due])).toEqual([["2026-09-10", 0], ["2026-09-12", 1000]]);
    expect(detail.payment_summary).toEqual({ total_paid: 1000, remaining_balance: 1200, is_fully_paid: false });

    const paid = await call(createPayment, { body: { invoice_id: id, order_id: o2.id, amount: "1200", payment_type: "FINAL", payment_date: "2026-09-20" } });
    expect(paid.status).toBe(201);
    detail = (await call(getInvoiceById, { params: { id } })).body.data;
    expect(detail.money.derivedStatus).toBe("PAID");
    expect(detail.status).toBe("PENDING");
    expect(detail.orderPayments).toHaveLength(2);

    const list = (await call(listInvoices, { query: { chip: "all" } })).body.data;
    expect(list.rows[0]).toMatchObject({ id, derivedStatus: "PAID", amountDue: 0, ordersCount: 2 });
  });

  test("a deleted order's payments still count toward its invoice", async () => {
    const { customer, o1 } = await setup();
    const id = (await call(generateInvoice, { body: { customer_id: customer.id, order_ids: [o1.id] } })).body.data.id;
    await db.Payment.create({ order_id: o1.id, customer_id: customer.id, amount: "400.00", payment_type: "PARTIAL", payment_date: "2026-09-11" });
    await o1.update({ is_archived: true });
    expect((await call(getInvoiceById, { params: { id } })).body.data.money.amountPaid).toBe(400);
  });

  test("editing or deleting a payment never overwrites a cancelled invoice", async () => {
    const { customer, o1 } = await setup();
    const id = (await call(generateInvoice, { body: { customer_id: customer.id, order_ids: [o1.id] } })).body.data.id;
    const paid = await call(createPayment, { body: { invoice_id: id, order_id: o1.id, amount: "500", payment_type: "PARTIAL", payment_date: "2026-09-20" } });
    await call(updateInvoiceStatus, { params: { id }, body: { status: "CANCELLED" } });
    expect((await call(updatePayment, { params: { id: paid.body.data.id }, body: { amount: "1000" } })).status).toBe(200);
    expect((await db.Invoice.findByPk(id)).status).toBe("CANCELLED");
    expect((await call(deletePayment, { params: { id: paid.body.data.id } })).status).toBe(200);
    expect((await db.Invoice.findByPk(id)).status).toBe("CANCELLED");
  });

  test("only Pending and Cancelled can be set by hand", async () => {
    const { customer, o1 } = await setup();
    const id = (await call(generateInvoice, { body: { customer_id: customer.id, order_ids: [o1.id] } })).body.data.id;
    const res = await call(updateInvoiceStatus, { params: { id }, body: { status: "PAID" } });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Paid is worked out from recorded payments");
    expect((await call(updateInvoiceStatus, { params: { id }, body: { status: "CANCELLED" } })).status).toBe(200);
  });

  test("invoice dates default to India's today", async () => {
    const { customer, o1 } = await setup();
    jest.useFakeTimers({ now: new Date("2026-09-30T20:00:00Z"), doNotFake: ["nextTick", "setImmediate", "clearImmediate", "setTimeout", "setInterval", "clearTimeout", "clearInterval", "queueMicrotask", "performance", "hrtime"] }); // only Date is faked
    const made = (await call(generateInvoice, { body: { customer_id: customer.id, order_ids: [o1.id] } })).body.data;
    expect([made.invoice_date, made.billing_period_end, made.payment_due_date]).toEqual(["2026-10-01", "2026-10-01", "2026-10-31"]);
  });
});
