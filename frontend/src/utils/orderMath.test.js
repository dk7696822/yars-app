import { readFileSync } from "node:fs";
import { describe, test, expect } from "vitest";
import * as m from "./orderMath";

const vectors = JSON.parse(
  readFileSync(new URL("../../../backend/tests/fixtures/order-math-vectors.json", import.meta.url), "utf8")
);

describe("orderMath (same vectors as the backend)", () => {
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
    expect(pos.remaining).toBeCloseTo(expected.remaining, 6);
    expect(pos.totalReceived).toBeCloseTo(expected.totalReceived, 6);
  });
  test.each(vectors.volume)("volumeSummary: $name", ({ orders, expected }) => {
    expect(m.volumeSummary(orders)).toEqual(expected);
  });
});
