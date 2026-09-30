import { describe, expect, test } from "vitest";
import { qty, qtyText, attributesText, poActions, PO_STATUS, ISSUE_TYPES } from "./labels";

describe("inventory labels", () => {
  test("quantities keep up to 3 decimals with Indian grouping", () => {
    expect(qtyText("1250.500")).toBe("1,250.5");
    expect(qtyText(0)).toBe("0");
    expect(qty("12.345", "KG")).toBe("12.345 kg");
    expect(qty(3, "ROLL")).toBe("3 rolls");
    expect(qty(1, "ROLL")).toBe("1 roll");
    expect(qty(2, "BOX")).toBe("2 box");
  });
  test("attributes read as one line", () => {
    expect(attributesText({ attributes: [{ attribute_name: "GSM", value: "70" }, { attribute_name: "Colour", value: "Red" }] })).toBe("GSM 70 · Colour Red");
    expect(attributesText({})).toBe("");
  });
  test("what a purchase order allows — cancel and delete only before anything is received", () => {
    const po = (status, received) => ({ status, items: [{ quantity_received: received }] });
    expect(poActions(po("PENDING", "0.000"))).toEqual({ canReceive: true, canCancel: true, canDelete: true });
    expect(poActions(po("PARTIALLY_RECEIVED", "5.000"))).toEqual({ canReceive: true, canCancel: false, canDelete: false });
    expect(poActions(po("RECEIVED", "10.000"))).toEqual({ canReceive: false, canCancel: false, canDelete: false });
    expect(poActions(po("CANCELLED", "0"))).toEqual({ canReceive: false, canCancel: false, canDelete: true });
  });
  test("every status and type has a label", () => {
    expect(Object.keys(PO_STATUS)).toEqual(["PENDING", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"]);
    expect(Object.keys(ISSUE_TYPES)).toEqual(["ISSUE", "WASTAGE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"]);
  });
});
