import { describe, test, expect } from "vitest";
import { availableUnits, emptyLine, lineFromOrderItem, applySizeSelection, applySizeWeight, previewLine, toPayloadLine } from "./orderFormLines";

const kgOnly = { id: "k", size_label: "8x10", rate_per_kg: "180.00", piece_price_amount: null, piece_price_count: null, weight_kg: null, weight_pieces_count: null };
const pcsOnly = { id: "p", size_label: "10x12", rate_per_kg: null, piece_price_amount: "375.0000", piece_price_count: 1000, weight_kg: null, weight_pieces_count: null };
const both = { id: "b", size_label: "12x14", rate_per_kg: "150.00", piece_price_amount: "0.5000", piece_price_count: 1, weight_kg: "100.000", weight_pieces_count: 10000 };

describe("order form lines", () => {
  test("available units follow the size's prices", () => {
    expect(availableUnits(kgOnly)).toEqual(["KG"]);
    expect(availableUnits(pcsOnly)).toEqual(["PIECES"]);
    expect(availableUnits(both)).toEqual(["KG", "PIECES"]);
  });

  test("picking a piece-only size switches to PIECES and prefills price", () => {
    const line = applySizeSelection(emptyLine(), pcsOnly);
    expect(line.unit).toBe("PIECES");
    expect(line.price_amount).toBe(375);
    expect(line.price_pieces_count).toBe(1000);
    expect(line.weight_kg).toBe("");
  });

  test("picking a size with a weight prefills it as SIZE", () => {
    const line = applySizeSelection({ ...emptyLine(), unit: "PIECES" }, both);
    expect(line.weight_kg).toBe(100);
    expect(line.weight_source).toBe("SIZE");
  });

  test("changing size resets pieces price/weight to the new size", () => {
    const first = applySizeSelection({ ...emptyLine(), unit: "PIECES" }, both);
    const second = applySizeSelection(first, pcsOnly);
    expect(second.price_amount).toBe(375);
    expect(second.weight_kg).toBe("");
    expect(second.weight_source).toBeNull();
  });

  test("kg rate keeps the existing prefill-only-if-empty rule", () => {
    const line = applySizeSelection({ ...emptyLine(), rate_per_kg: 200 }, kgOnly);
    expect(line.rate_per_kg).toBe(200);
  });

  test("applySizeWeight fills an empty line weight only", () => {
    const line = { ...emptyLine(), unit: "PIECES", product_size_id: "p" };
    expect(applySizeWeight(line, { ...pcsOnly, weight_kg: "50.000", weight_pieces_count: 5000 }).weight_kg).toBe(50);
    const measured = { ...line, weight_kg: 2, weight_pieces_count: 100, weight_source: "MANUAL" };
    expect(applySizeWeight(measured, { ...pcsOnly, weight_kg: "50.000", weight_pieces_count: 5000 }).weight_kg).toBe(2);
  });

  test("preview: incomplete pieces line has no amount instead of crashing", () => {
    expect(previewLine({ ...emptyLine(), unit: "PIECES", quantity_pieces: "", price_amount: 1, price_pieces_count: 1 }, both)).toEqual({ amount: null, kg: null });
    expect(previewLine({ ...emptyLine(), unit: "PIECES", quantity_pieces: 5000, price_amount: 0.5, price_pieces_count: 1, weight_kg: 100, weight_pieces_count: 10000 }, both))
      .toEqual({ amount: 2500, kg: 50 });
  });

  test("round trip: saved KG item → form → payload keeps rate", () => {
    const line = lineFromOrderItem({ product_size_id: "k", unit: "KG", quantity_kg: "12.35", rate_per_kg: "181.25", productSize: kgOnly });
    expect(toPayloadLine(line)).toEqual({ product_size_id: "k", unit: "KG", quantity_kg: 12.35, rate_per_kg: 181.25 });
  });

  test("round trip: saved PIECES item with SIZE weight echoes SIZE", () => {
    const line = lineFromOrderItem({ product_size_id: "b", unit: "PIECES", quantity_pieces: 5000, price_amount: "0.5000", price_pieces_count: 1, weight_kg: "100.000", weight_pieces_count: 10000, weight_source: "SIZE" });
    expect(toPayloadLine(line)).toEqual({ product_size_id: "b", unit: "PIECES", quantity_pieces: 5000, price_amount: 0.5, price_pieces_count: 1, weight_kg: 100, weight_pieces_count: 10000, weight_source: "SIZE" });
  });

  test("payload omits weight when blank", () => {
    const payload = toPayloadLine({ ...emptyLine(), product_size_id: "p", unit: "PIECES", quantity_pieces: 10, price_amount: 1, price_pieces_count: 1 });
    expect(payload).not.toHaveProperty("weight_kg");
  });
});
