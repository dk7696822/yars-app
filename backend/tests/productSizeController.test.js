"use strict";

const db = require("../src/models");
const { createProductSize, updateProductSize } = require("../src/controllers/productSizeController");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const call = async (fn, req) => {
  const res = mockRes();
  await fn(req, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe("product sizes — pricing fields", () => {
  test("old client (rate only) still works", async () => {
    const { status, body } = await call(createProductSize, { body: { size_label: "8x10", rate_per_kg: 180 } });
    expect(status).toBe(201);
    expect(body.data.piece_price_amount).toBeNull();
  });

  test("piece-only size is allowed", async () => {
    const { status, body } = await call(createProductSize, { body: { size_label: "10x12", piece_price_amount: 250, piece_price_count: 100 } });
    expect(status).toBe(201);
    expect(body.data.rate_per_kg).toBeNull();
    expect(Number(body.data.piece_price_amount)).toBe(250);
    expect(body.data.piece_price_count).toBe(100);
  });

  test.each([
    [{ size_label: "A" }, /rate per kg or a piece price/i],
    [{ size_label: "A", rate_per_kg: 100, piece_price_amount: 5 }, /piece price: enter both/i],
    [{ size_label: "A", rate_per_kg: 100, weight_kg: 1, weight_pieces_count: 0 }, /whole number, 1 or more/i],
    [{ size_label: "A", rate_per_kg: 100, weight_kg: 0, weight_pieces_count: 100 }, /greater than 0/i],
    [{ size_label: "A", rate_per_kg: -1 }, /rate per kg/i],
    [{ size_label: "A", rate_per_kg: 100, piece_price_amount: 5, piece_price_count: 2.5 }, /whole number/i],
  ])("rejects %o", async (body, message) => {
    const { status, body: out } = await call(createProductSize, { body });
    expect(status).toBe(400);
    expect(out.message).toMatch(message);
  });
});

describe("product sizes — weight back-fill", () => {
  let size;
  let pieceLineNoWeight;
  let pieceLineManual;
  let otherSizeLine;

  beforeEach(async () => {
    const customer = await createCustomer();
    const plateType = await createPlateType();
    size = await createSize({ piece_price_amount: "0.5", piece_price_count: 1 });
    const other = await createSize({ piece_price_amount: "1", piece_price_count: 1 });
    const order = await createOrderWithLines({
      customer, plateType,
      lines: [
        { product_size_id: size.id, unit: "PIECES", quantity_pieces: 5000, price_amount: "0.5", price_pieces_count: 1 },
        { product_size_id: size.id, unit: "PIECES", quantity_pieces: 100, price_amount: "0.5", price_pieces_count: 1, weight_kg: "2", weight_pieces_count: 100, weight_source: "MANUAL" },
        { product_size_id: size.id, unit: "KG", quantity_kg: "10", rate_per_kg: "180" },
        { product_size_id: other.id, unit: "PIECES", quantity_pieces: 10, price_amount: "1", price_pieces_count: 1 },
      ],
    });
    const lines = await db.OrderProductSize.findAll({ where: { order_id: order.id } });
    pieceLineNoWeight = lines.find((l) => l.quantity_pieces === 5000);
    pieceLineManual = lines.find((l) => l.quantity_pieces === 100);
    otherSizeLine = lines.find((l) => l.product_size_id === other.id);
  });

  const setWeight = (kg, count) =>
    call(updateProductSize, {
      params: { id: size.id },
      body: { size_label: size.size_label, rate_per_kg: size.rate_per_kg, piece_price_amount: "0.5", piece_price_count: 1, weight_kg: kg, weight_pieces_count: count },
    });

  test("fills only NULL-weight pieces lines of that size; money untouched", async () => {
    const { status, body } = await setWeight(100, 10000);
    expect(status).toBe(200);
    expect(body.data.backfilled_lines).toBe(1);

    await pieceLineNoWeight.reload();
    expect(Number(pieceLineNoWeight.weight_kg)).toBe(100);
    expect(pieceLineNoWeight.weight_pieces_count).toBe(10000);
    expect(pieceLineNoWeight.weight_source).toBe("SIZE");
    expect(Number(pieceLineNoWeight.price_amount)).toBe(0.5);

    await pieceLineManual.reload();
    expect(Number(pieceLineManual.weight_kg)).toBe(2);
    expect(pieceLineManual.weight_source).toBe("MANUAL");

    await otherSizeLine.reload();
    expect(otherSizeLine.weight_kg).toBeNull();
  });

  test("second weight change does not overwrite lines that already have a weight", async () => {
    await setWeight(100, 10000);
    const { body } = await setWeight(120, 10000);
    expect(body.data.backfilled_lines).toBe(0);
    await pieceLineNoWeight.reload();
    expect(Number(pieceLineNoWeight.weight_kg)).toBe(100);
  });

  test("removing a size's weight clears nothing", async () => {
    await setWeight(100, 10000);
    await call(updateProductSize, {
      params: { id: size.id },
      body: { size_label: size.size_label, rate_per_kg: size.rate_per_kg, piece_price_amount: "0.5", piece_price_count: 1, weight_kg: "", weight_pieces_count: "" },
    });
    await pieceLineNoWeight.reload();
    expect(Number(pieceLineNoWeight.weight_kg)).toBe(100);
  });
});
