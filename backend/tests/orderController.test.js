"use strict";

const db = require("../src/models");
const { createOrder, updateOrder, getOrderById, getAllOrders } = require("../src/controllers/orderController");
const { calculateOrderMetrics } = require("../src/services/auditService");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize } = require("./helpers/orderFactories");

const call = async (fn, req) => {
  const res = mockRes();
  await fn(req, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe("orders with pieces lines", () => {
  let customer;
  let plateType;
  let kgSize;
  let pcsSize;
  let bothSize;

  beforeEach(async () => {
    customer = await createCustomer();
    plateType = await createPlateType("500.00");
    kgSize = await createSize({ rate_per_kg: "150.00" });
    pcsSize = await createSize({ rate_per_kg: null, piece_price_amount: "375", piece_price_count: 1000 });
    bothSize = await createSize({ rate_per_kg: "180.00", piece_price_amount: "0.5", piece_price_count: 1, weight_kg: "100", weight_pieces_count: 10000 });
  });

  const base = () => ({ customer_id: customer.id, plate_type_id: plateType.id, order_date: "2026-09-10" });

  test("mixed order: stores snapshots, totals via shared math", async () => {
    const { status, body } = await call(createOrder, {
      body: {
        ...base(),
        round_off_amount: 5,
        product_sizes: [
          { product_size_id: kgSize.id, quantity_kg: 10 },
          { product_size_id: pcsSize.id, unit: "PIECES", quantity_pieces: "5000" },
          { product_size_id: bothSize.id, unit: "PIECES", quantity_pieces: 2000, price_amount: 2, price_pieces_count: 1 },
        ],
      },
    });
    expect(status).toBe(201);

    const lines = await db.OrderProductSize.findAll({ where: { order_id: body.data.id } });
    const pcsLine = lines.find((l) => l.product_size_id === pcsSize.id);
    expect(pcsLine.unit).toBe("PIECES");
    expect(Number(pcsLine.price_amount)).toBe(375);
    expect(pcsLine.price_pieces_count).toBe(1000);
    expect(pcsLine.weight_kg).toBeNull(); // size has no weight
    const bothLine = lines.find((l) => l.product_size_id === bothSize.id);
    expect(Number(bothLine.price_amount)).toBe(2); // custom price wins
    expect(bothLine.weight_source).toBe("SIZE"); // copied from size
    expect(lines.find((l) => l.product_size_id === kgSize.id).unit).toBe("KG");

    const { body: got } = await call(getOrderById, { params: { id: body.data.id } });
    // 10 × 150 + 5000 × 375/1000 + 2000 × 2 + plate 500 − 5
    expect(got.data.total_amount).toBe(1500 + 1875 + 4000 + 500 - 5);
    expect(got.data.volume).toEqual({ kgFromKgLines: 10, kgFromPieces: 20, kgSold: 30, piecesTotal: 7000, piecesWithoutWeight: 5000 });
    const gotPcs = got.data.orderProductSizes.find((l) => l.product_size_id === pcsSize.id);
    expect(gotPcs.line_amount).toBe(1875);
    expect(gotPcs.line_kg).toBeNull();
    expect(got.data.invoice).toBeNull();
  });

  test("measured weight is stored as MANUAL", async () => {
    const { body } = await call(createOrder, {
      body: { ...base(), product_sizes: [{ product_size_id: bothSize.id, unit: "PIECES", quantity_pieces: 1000, weight_kg: 11, weight_pieces_count: 1000 }] },
    });
    const [line] = await db.OrderProductSize.findAll({ where: { order_id: body.data.id } });
    expect(line.weight_source).toBe("MANUAL");
    expect(Number(line.weight_kg)).toBe(11);
  });

  test("echoed SIZE weight stays SIZE", async () => {
    const { body } = await call(createOrder, {
      body: { ...base(), product_sizes: [{ product_size_id: bothSize.id, unit: "PIECES", quantity_pieces: 1000, weight_kg: 100, weight_pieces_count: 10000, weight_source: "SIZE" }] },
    });
    const [line] = await db.OrderProductSize.findAll({ where: { order_id: body.data.id } });
    expect(line.weight_source).toBe("SIZE");
  });

  test("KG line on piece-only size → 400", async () => {
    const { status, body } = await call(createOrder, { body: { ...base(), product_sizes: [{ product_size_id: pcsSize.id, quantity_kg: 10 }] } });
    expect(status).toBe(400);
    expect(body.message).toMatch(/no rate per kg/i);
    expect(await db.Order.count()).toBe(0); // rolled back
  });

  test("PIECES line on kg-only size without a price → 400", async () => {
    const { status, body } = await call(createOrder, { body: { ...base(), product_sizes: [{ product_size_id: kgSize.id, unit: "PIECES", quantity_pieces: 10 }] } });
    expect(status).toBe(400);
    expect(body.message).toMatch(/no piece price/i);
  });

  test.each([["12.5"], ["abc"], [0], [""]])("quantity_pieces validation rejects %p", async (qty) => {
    const { status } = await call(createOrder, { body: { ...base(), product_sizes: [{ product_size_id: bothSize.id, unit: "PIECES", quantity_pieces: qty }] } });
    expect(status).toBe(400);
  });

  test("unknown unit → 400", async () => {
    const { status } = await call(createOrder, { body: { ...base(), product_sizes: [{ product_size_id: kgSize.id, unit: "BOX", quantity_kg: 1 }] } });
    expect(status).toBe(400);
  });

  test("update with old-style KG payload keeps total identical", async () => {
    const { body } = await call(createOrder, { body: { ...base(), product_sizes: [{ product_size_id: kgSize.id, quantity_kg: 12.35, rate_per_kg: 181.25 }] } });
    const before = (await call(getOrderById, { params: { id: body.data.id } })).body.data.total_amount;
    await call(updateOrder, { params: { id: body.data.id }, body: { product_sizes: [{ product_size_id: kgSize.id, quantity_kg: 12.35, rate_per_kg: 181.25 }] } });
    const after = (await call(getOrderById, { params: { id: body.data.id } })).body.data.total_amount;
    expect(after).toBe(before);
  });

  test("update can change a pieces price after the fact", async () => {
    const { body } = await call(createOrder, { body: { ...base(), product_sizes: [{ product_size_id: bothSize.id, unit: "PIECES", quantity_pieces: 1000 }] } });
    await call(updateOrder, {
      params: { id: body.data.id },
      body: { product_sizes: [{ product_size_id: bothSize.id, unit: "PIECES", quantity_pieces: 1000, price_amount: 2, price_pieces_count: 1, weight_kg: 100, weight_pieces_count: 10000, weight_source: "SIZE" }] },
    });
    const got = (await call(getOrderById, { params: { id: body.data.id } })).body.data;
    expect(got.total_amount).toBe(2000 + 500);
  });

  test("list returns volume per order and audit metrics are not NaN for pieces orders", async () => {
    const { body } = await call(createOrder, { body: { ...base(), product_sizes: [{ product_size_id: bothSize.id, unit: "PIECES", quantity_pieces: 5000 }] } });
    const list = (await call(getAllOrders, { query: {} })).body.data;
    expect(list[0].volume.kgSold).toBe(50);
    const metrics = await calculateOrderMetrics(db, body.data.id);
    expect(metrics.total_amount).toBe(2500 + 500);
  });
});

describe("orders survive archived master data", () => {
  test("an order whose size, plate and customer were archived still shows every line", async () => {
    const customer = await createCustomer("Archived Co");
    const plate = await createPlateType("100.00");
    const size = await createSize({ rate_per_kg: "50.00" });
    const created = await call(createOrder, { body: {
      customer_id: customer.id, plate_type_id: plate.id, order_date: "2026-09-10",
      product_sizes: [{ product_size_id: size.id, unit: "KG", quantity_kg: "2.00", rate_per_kg: "50.00" }],
    } });
    const id = created.body.data.id;
    await size.update({ is_archived: true });
    await plate.update({ is_archived: true });
    await customer.update({ is_archived: true });

    const one = await call(getOrderById, { params: { id } });
    expect(one.status).toBe(200);
    expect(one.body.data.orderProductSizes).toHaveLength(1);
    expect(one.body.data.total_amount).toBe(200);

    const all = await call(getAllOrders, { query: {} });
    expect(all.body.data.map((o) => o.id)).toContain(id);
  });
});

describe("dates default to India's today", () => {
  const { todayIST } = require("../src/services/dashboard/dateRanges");
  afterEach(() => jest.useRealTimers());

  test("an order without a date is dated today in India, even at 1:30 am IST", async () => {
    // 20:00 UTC on 30 Sept = 01:30 IST on 1 Oct.
    jest.useFakeTimers({ now: new Date("2026-09-30T20:00:00Z"), doNotFake: ["nextTick", "setImmediate", "clearImmediate", "setTimeout", "setInterval", "clearTimeout", "clearInterval", "queueMicrotask", "performance", "hrtime"] }); // only Date is faked
    const customer = await createCustomer();
    const plate = await createPlateType("0.00");
    const size = await createSize({ rate_per_kg: "10.00" });
    const res = await call(createOrder, { body: {
      customer_id: customer.id, plate_type_id: plate.id, advance_received: "5",
      product_sizes: [{ product_size_id: size.id, unit: "KG", quantity_kg: "1.00", rate_per_kg: "10.00" }],
    } });
    expect(res.status).toBe(201);
    expect(todayIST()).toBe("2026-10-01");
    const saved = await db.Order.findByPk(res.body.data.id, { include: [{ model: db.Payment, as: "payments" }] });
    expect(saved.order_date).toBe("2026-10-01");
    expect(saved.payments[0].payment_date).toBe("2026-10-01");
  });
});
