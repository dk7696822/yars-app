import { describe, test, expect } from "vitest";
import { formatPiecePrice, perPiecePriceHint, perPieceWeightHint, formatSizePricing, formatLineQuantity, formatLineKg, formatInvoiceQty, formatInvoiceRate } from "./formatters";

describe("piece formatters", () => {
  test("price per 1 piece", () => expect(formatPiecePrice("0.5000", 1)).toBe("₹0.50/pc"));
  test("price per N pieces keeps what was typed", () => expect(formatPiecePrice("375.0000", 1000)).toBe("₹375.00 / 1,000 pcs"));
  test("price with 3 decimals", () => expect(formatPiecePrice("0.3750", 1)).toBe("₹0.375/pc"));
  test("per-piece hints", () => {
    expect(perPiecePriceHint(375, 1000)).toBe("= ₹0.375 per piece");
    expect(perPieceWeightHint(100, 10000)).toBe("≈ 10 g per piece");
  });
  test("size pricing summary", () => {
    expect(formatSizePricing({ rate_per_kg: "180.00", piece_price_amount: "0.5000", piece_price_count: 1, weight_kg: "100.000", weight_pieces_count: 10000 }))
      .toBe("₹180.00/kg · ₹0.50/pc · 10 g/pc");
    expect(formatSizePricing({ rate_per_kg: "180.00", piece_price_amount: null, weight_kg: null })).toBe("₹180.00/kg · — · —");
  });
  test("line quantity and kg text", () => {
    expect(formatLineQuantity({ unit: "KG", quantity_kg: "50.00" })).toBe("50 kg");
    expect(formatLineQuantity({ unit: "PIECES", quantity_pieces: 5000 })).toBe("5,000 pcs");
    expect(formatLineKg({ unit: "PIECES", quantity_pieces: 5000, weight_kg: "100.000", weight_pieces_count: 10000, weight_source: "SIZE" })).toBe("≈ 50 kg");
    expect(formatLineKg({ unit: "PIECES", quantity_pieces: 5000, weight_kg: "0.011", weight_pieces_count: 1, weight_source: "MANUAL" })).toBe("≈ 55 kg (measured)");
    expect(formatLineKg({ unit: "PIECES", quantity_pieces: 5000, weight_kg: null, weight_pieces_count: null })).toBe("kg: weight not set");
    expect(formatLineKg({ unit: "KG", quantity_kg: "5.00" })).toBeNull();
  });
  test("invoice items: legacy (unit null) unchanged, new ones labelled", () => {
    expect(formatInvoiceQty({ unit: null, quantity: "50.00" })).toBe("50.00");
    expect(formatInvoiceQty({ unit: "KG", quantity: "50.00" })).toBe("50 kg");
    expect(formatInvoiceQty({ unit: "PIECES", quantity: "5000.00" })).toBe("5,000 pcs");
    expect(formatInvoiceRate({ unit: "PIECES", unit_price: "0.38", price_amount: "375.0000", price_pieces_count: 1000 })).toBe("₹375.00 / 1,000 pcs");
  });
});
