import { describe, expect, test } from "vitest";
import { emptyPo, newPoLine, lineAmount, poTotal, poErrors, toPoPayload } from "./poDraft";

const item = { id: "i1", name: "PP Granules", unit: "KG" };
const draft = (o) => ({ ...emptyPo("2026-09-30"), supplier: { id: "s1", name: "Raj" }, lines: [{ ...newPoLine(item), key: "k1", quantity: "100", rate: "92.50" }], ...o });

describe("purchase order draft", () => {
  test("step 1 needs a supplier; expected date not before the order date", () => {
    expect(poErrors(emptyPo("2026-09-30"), 0)).toEqual({ supplier: "Choose a supplier" });
    expect(poErrors(draft({ expected_date: "2026-09-01" }), 0)).toEqual({ expected_date: "Can't be before the order date" });
    expect(poErrors(draft(), 0)).toEqual({});
  });
  test("step 2: at least one line; each line needs item, quantity (3 decimals) and rate (> 0)", () => {
    expect(poErrors(draft({ lines: [newPoLine()] }), 1)).toEqual({ lines: "Add at least one item" });
    const bad = draft({ lines: [{ ...newPoLine(item), key: "a", quantity: "1.2345", rate: "0" }, { ...newPoLine(), key: "b", quantity: "5", rate: "" }] });
    expect(poErrors(bad, 1)).toEqual({ "qty:a": "Use at most 3 decimals", "rate:a": "Must be more than 0", "item:b": "Choose an item", "rate:b": "Enter the rate" });
  });
  test("an untouched blank line is ignored", () => {
    const d = draft();
    d.lines.push(newPoLine());
    expect(poErrors(d, 1)).toEqual({});
    expect(toPoPayload(d).items).toHaveLength(1);
  });
  test("amounts to the paisa", () => {
    expect(lineAmount({ quantity: "0.333", rate: "3" })).toBe(1);
    expect(lineAmount({ quantity: "", rate: "3" })).toBeNull();
    expect(poTotal(draft({ lines: [{ ...newPoLine(item), quantity: "100", rate: "92.50" }, { ...newPoLine(item), quantity: "0.1", rate: "0.20" }] }))).toBe(9250.02);
  });
  test("payload", () => {
    expect(toPoPayload(draft({ notes: "  ", expected_date: "" }))).toEqual({
      supplier_id: "s1", order_date: "2026-09-30", expected_date: null, notes: null, items: [{ item_id: "i1", quantity_ordered: 100, rate: 92.5 }],
    });
  });
});
