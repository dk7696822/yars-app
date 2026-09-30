import { describe, expect, test } from "vitest";
import { emptySize, formFromSize, validateSize, toSizePayload, sizePricingText } from "./sizeForm";

const form = (o) => ({ ...emptySize(), size_label: "14 x 18", ...o });

describe("size form", () => {
  test("a label and at least one price are needed", () => {
    expect(validateSize(form({ size_label: " " , rate_per_kg: "180" }))).toEqual({ size_label: "Enter the size, like 14 x 18" });
    expect(validateSize(form())).toEqual({ form: "Enter a rate per kg or a piece price (or both)" });
    expect(validateSize(form({ rate_per_kg: "0" }))).toEqual({}); // ₹0 = rate set on each order
    expect(validateSize(form({ piece_price_amount: "0.375" }))).toEqual({});
  });
  test("number checks", () => {
    expect(validateSize(form({ rate_per_kg: "180.555" }))).toEqual({ rate_per_kg: "Use at most 2 decimals" });
    expect(validateSize(form({ piece_price_amount: "375", piece_price_count: "" }))).toEqual({ piece_price: "Enter both: how many pieces and their price" });
    expect(validateSize(form({ rate_per_kg: "180", weight_kg: "100" }))).toEqual({ weight: "Enter both the pieces and their weight in kg, or clear both" });
    expect(validateSize(form({ rate_per_kg: "180", weight_kg: "0", weight_pieces_count: "100" }))).toEqual({ weight: "Must be more than 0" });
  });
  test("payload: numbers, blanks as null, piece count only with a piece price", () => {
    expect(toSizePayload(form({ size_label: " 14 x 18 ", rate_per_kg: "180", piece_price_count: "1000", weight_pieces_count: "10,000", weight_kg: "100" }))).toEqual({
      size_label: "14 x 18", rate_per_kg: 180, piece_price_amount: null, piece_price_count: null, weight_kg: 100, weight_pieces_count: 10000,
    });
    expect(toSizePayload(form({ piece_price_amount: "375", piece_price_count: "1000" }))).toMatchObject({ rate_per_kg: null, piece_price_amount: 375, piece_price_count: 1000 });
  });
  test("editing starts from the saved values without trailing zeros", () => {
    expect(formFromSize({ size_label: "16 x 20", rate_per_kg: "190.00", piece_price_amount: "0.3750", piece_price_count: 1, weight_kg: null, weight_pieces_count: null }))
      .toEqual({ size_label: "16 x 20", rate_per_kg: "190", piece_price_amount: "0.375", piece_price_count: "1", weight_kg: "", weight_pieces_count: "" });
  });
});

describe("sizePricingText", () => {
  test("plain words for each price", () => {
    expect(sizePricingText({ rate_per_kg: "190.00" })).toBe("₹190/kg");
    expect(sizePricingText({ rate_per_kg: "0.00" })).toBe("Rate set on each order");
    expect(sizePricingText({ rate_per_kg: null, piece_price_amount: "0.5000", piece_price_count: 1 })).toBe("₹0.5 per piece");
    expect(sizePricingText({ rate_per_kg: "180.00", piece_price_amount: "375.0000", piece_price_count: 1000, weight_kg: "100.000", weight_pieces_count: 10000 }))
      .toBe("₹180/kg · ₹375 per 1,000 pcs · 10 g per piece");
  });
});
