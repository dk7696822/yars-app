import { describe, expect, test } from "vitest";
import { newDraft, newLine, draftFromOrder, lineErrors, stepErrors, linePreview, draftTotals, toPayload, unitPriceHint, pickSize } from "./draft";

const SIZES = [
  { id: "s1", size_label: "14x18", rate_per_kg: "180.00", piece_price_amount: null, piece_price_count: null, weight_kg: null, weight_pieces_count: null },
  { id: "s2", size_label: "16x20", rate_per_kg: null, piece_price_amount: "375.0000", piece_price_count: 1000, weight_kg: "100.000", weight_pieces_count: 10000 },
];
const PLATES = [{ id: "p1", type_name: "2 colour", charge: "500.00" }];
const kg = (o) => ({ ...newLine(), product_size_id: "s1", unit: "KG", quantity_kg: "12.25", rate_per_kg: "180", ...o });
const pcs = (o) => ({ ...newLine(), product_size_id: "s2", unit: "PIECES", quantity_pieces: "10,000", price_amount: "375", price_pieces_count: "1000", weight_kg: "", weight_pieces_count: "", ...o });

describe("lines", () => {
  test("kg: up to 2 decimals; quantity and rate required", () => {
    expect(lineErrors(kg())).toEqual({});
    expect(lineErrors(kg({ quantity_kg: "12.255" }))).toEqual({ quantity: "Use at most 2 decimals" });
    expect(lineErrors(kg({ quantity_kg: "", rate_per_kg: "" }))).toEqual({ quantity: "Enter the kg", rate: "Enter the rate per kg" });
    expect(lineErrors({ ...newLine() })).toMatchObject({ size: "Choose a size" });
  });
  test("pieces: whole quantity, a full price, weight both-or-neither", () => {
    expect(lineErrors(pcs())).toEqual({});
    expect(lineErrors(pcs({ quantity_pieces: "10.5" }))).toEqual({ quantity: "Whole numbers only" });
    expect(lineErrors(pcs({ price_amount: "" }))).toEqual({ price: "Enter the price, like 1000 pcs cost ₹375" });
    expect(lineErrors(pcs({ weight_kg: "100" }))).toEqual({ weight: "Enter both the pieces and their weight in kg, or clear both" });
  });
  test("preview uses the typed numbers (commas allowed) and never crashes on bad text", () => {
    expect(linePreview(kg(), SIZES[0])).toEqual({ amount: 2205, kg: 12.25 });
    expect(linePreview(pcs({ weight_kg: "100", weight_pieces_count: "10000" }), SIZES[1])).toEqual({ amount: 3750, kg: 100 });
    expect(linePreview(pcs({ price_amount: "abc" }), SIZES[1])).toEqual({ amount: null, kg: null });
  });
});

describe("steps and totals", () => {
  test("each step's required fields", () => {
    const d = newDraft();
    expect(stepErrors(d, 0)).toEqual({ customer: "Choose a customer" });
    expect(Object.keys(stepErrors(d, 1))).toEqual(["lines"]);
    expect(stepErrors(d, 2)).toEqual({ plate: "Choose a plate type" });
    expect(stepErrors({ ...d, plateTypeId: "p1", roundOff: "-5", customPlateCharge: "0" }, 2)).toEqual({ customPlateCharge: "Must be more than 0" });
  });
  test("total = lines + plate (custom or default) − round off", () => {
    const d = { ...newDraft(), lines: [kg()], plateTypeId: "p1", roundOff: "5" };
    expect(draftTotals(d, SIZES, PLATES)).toEqual({ products: 2205, plateCharge: 500, roundOff: 5, total: 2700 });
    expect(draftTotals({ ...d, customPlateCharge: "1,000" }, SIZES, PLATES).plateCharge).toBe(1000);
  });
});

describe("payload", () => {
  const d = { ...newDraft({ id: "c1", name: "Laxmi" }), orderDate: "2026-09-30", lines: [kg(), pcs()], plateTypeId: "p1", advance: "500" };
  test("new order: numbers, the picked date string, advance included", () => {
    expect(toPayload(d, { isEdit: false })).toEqual({
      customer_id: "c1", order_date: "2026-09-30", plate_type_id: "p1", status: "PENDING", custom_plate_charge: null, round_off_amount: 0,
      product_sizes: [
        { product_size_id: "s1", unit: "KG", quantity_kg: 12.25, rate_per_kg: 180 },
        { product_size_id: "s2", unit: "PIECES", quantity_pieces: 10000, price_amount: 375, price_pieces_count: 1000 },
      ],
      advance_received: 500,
    });
  });
  test("editing never sends the advance", () => {
    expect(toPayload(d, { isEdit: true })).not.toHaveProperty("advance_received");
  });
  test("a saved order becomes a draft", () => {
    const order = {
      customer_id: "c1", customer: { name: "Laxmi", metadata: { phone: "9876543210" } }, order_date: "2026-09-10", plate_type_id: "p1",
      custom_plate_charge: null, round_off_amount: "0.00", status: "DELIVERED",
      orderProductSizes: [{ id: "l1", product_size_id: "s1", unit: "KG", quantity_kg: "12.25", rate_per_kg: "180.00", productSize: SIZES[0] }],
    };
    const draft = draftFromOrder(order);
    expect(draft).toMatchObject({ customer: { id: "c1", name: "Laxmi", phone: "9876543210" }, orderDate: "2026-09-10", plateTypeId: "p1", customPlateCharge: "", roundOff: "", status: "DELIVERED" });
    expect(draft.lines[0]).toMatchObject({ key: "l1", unit: "KG", quantity_kg: "12.25", rate_per_kg: "180" });
  });
});

describe("either unit can be chosen", () => {
  test("a size without a saved piece price asks for the price on this order", () => {
    expect(unitPriceHint({ unit: "PIECES" }, SIZES[0])).toBe("14x18 has no piece price saved — enter the price for this order");
    expect(unitPriceHint({ unit: "PIECES" }, SIZES[1])).toBeNull();
  });
  test("a size without a saved kg rate asks for the rate on this order", () => {
    expect(unitPriceHint({ unit: "KG" }, SIZES[1])).toBe("16x20 has no rate per kg saved — enter the rate for this order");
    expect(unitPriceHint({ unit: "KG" }, SIZES[0])).toBeNull();
  });
  test("no size yet, no hint", () => expect(unitPriceHint({ unit: "PIECES" }, undefined)).toBeNull());
  test("once this order's price is typed, the hint goes away", () => {
    expect(unitPriceHint({ unit: "PIECES", price_amount: "375", price_pieces_count: "1000" }, SIZES[0])).toBeNull();
    expect(unitPriceHint({ unit: "KG", rate_per_kg: "150" }, SIZES[1])).toBeNull();
  });
});

describe("sizes saved with a ₹0 kg rate (25 of 43 in production)", () => {
  const ZERO = { id: "z1", size_label: "10 x 15", rate_per_kg: "0.00", piece_price_amount: null, piece_price_count: null, weight_kg: null, weight_pieces_count: null };
  test("picking one leaves the rate empty instead of pre-filling 0", () => {
    expect(pickSize(newLine(), ZERO)).toMatchObject({ product_size_id: "z1", unit: "KG", rate_per_kg: "" });
  });
  test("…and says to enter this order's rate", () => {
    expect(unitPriceHint({ unit: "KG", rate_per_kg: "" }, ZERO)).toBe("10 x 15 has no rate per kg saved — enter the rate for this order");
  });
  test("a real saved rate is still pre-filled", () => {
    expect(pickSize(newLine(), SIZES[0])).toMatchObject({ product_size_id: "s1", rate_per_kg: 180 });
  });
});
