"use strict";

const vectors = require("./fixtures/order-math-vectors.json");
const m = require("../src/services/orderMath");

describe("orderMath (shared vectors — frontend runs the same file)", () => {
  test.each(vectors.lineAmount)("lineAmount: $name", ({ line, size, expected }) => {
    expect(m.lineAmount(line, size)).toBeCloseTo(expected, 6);
  });

  test.each(vectors.lineKg)("lineKg: $name", ({ line, expected }) => {
    if (expected === null) expect(m.lineKg(line)).toBeNull();
    else expect(m.lineKg(line)).toBeCloseTo(expected, 6);
  });

  test.each(vectors.linePieces)("linePieces: $name", ({ line, expected }) => {
    expect(m.linePieces(line)).toBe(expected);
  });

  test.each(vectors.orders)("orderTotal + paymentPosition: $name", ({ order, expected }) => {
    const total = m.orderTotal(order);
    expect(total).toBeCloseTo(expected.total, 6);
    const pos = m.paymentPosition(order, total);
    expect(pos.totalPaid).toBeCloseTo(expected.totalPaid, 6);
    expect(pos.advanceReceived).toBeCloseTo(expected.advanceReceived, 6);
    expect(pos.totalReceived).toBeCloseTo(expected.totalReceived, 6);
    expect(pos.remaining).toBeCloseTo(expected.remaining, 6);
  });

  test.each(vectors.volume)("volumeSummary: $name", ({ orders, expected }) => {
    expect(m.volumeSummary(orders)).toEqual(expected);
  });

  test("kg lines keep the exact legacy float expression (no rounding added)", () => {
    const line = { quantity_kg: "12.35", rate_per_kg: "181.25" };
    expect(m.lineAmount(line, {})).toBe(parseFloat("12.35") * parseFloat("181.25"));
  });
});
