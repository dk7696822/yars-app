import { describe, expect, test } from "vitest";
import { emptyItem, formFromItem, validateItem, toItemPayload } from "./itemForm";

const f = (o) => ({ ...emptyItem(), name: "PP Granules", category_id: "c1", ...o });

describe("item form", () => {
  test("name and category are required", () => {
    expect(validateItem(emptyItem())).toEqual({ name: "Enter the item name", category_id: "Choose a category" });
    expect(validateItem(f())).toEqual({});
  });
  test("reorder numbers: up to 3 decimals, 0 allowed, blank reorder level means 0", () => {
    expect(validateItem(f({ reorder_level: "12.3456" }))).toEqual({ reorder_level: "Use at most 3 decimals" });
    expect(validateItem(f({ reorder_target: "abc" }))).toEqual({ reorder_target: "Enter a number" });
    expect(toItemPayload(f({ reorder_level: "" })).reorder_level).toBe(0);
  });
  test("payload trims and sends one value per attribute", () => {
    expect(toItemPayload(f({ name: "  PP  Granules ", item_code: " ", unit: "KG", reorder_level: "500", reorder_target: "1,000", notes: "", selections: { a1: "v1", a2: "" } }))).toEqual({
      name: "PP Granules", item_code: null, category_id: "c1", unit: "KG", reorder_level: 500, reorder_target: 1000, notes: null, attribute_value_ids: ["v1"],
    });
  });
  test("editing starts from the saved item", () => {
    expect(formFromItem({ name: "X", item_code: "X1", category_id: "c1", category: { name: "Raw" }, unit: "PCS", reorder_level: "10.000", reorder_target: null, notes: null,
      attributes: [{ attribute_id: "a1", value_id: "v9" }] })).toEqual({
      name: "X", item_code: "X1", category_id: "c1", unit: "PCS", reorder_level: "10", reorder_target: "", notes: "", selections: { a1: "v9" },
    });
  });
});
