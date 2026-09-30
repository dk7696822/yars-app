"use strict";

const { buildOrderExportRows } = require("../src/services/orderExport");

const order = {
  id: "o1", order_date: "2026-09-10", created_at: "2026-09-10T00:00:00Z", status: "PENDING",
  custom_plate_charge: null, round_off_amount: "0.00", advance_received: "0.00",
  customer: { name: "Acme", metadata: {} },
  plateType: { type_name: "4 Colour", charge: "500.00" },
  payments: [],
  orderProductSizes: [
    { unit: "KG", quantity_kg: "10.00", rate_per_kg: "150.00", productSize: { size_label: "8x10", rate_per_kg: "150.00" } },
    { unit: "PIECES", quantity_kg: null, rate_per_kg: null, quantity_pieces: 5000, price_amount: "375.0000", price_pieces_count: 1000,
      weight_kg: "100.000", weight_pieces_count: 10000, weight_source: "SIZE",
      productSize: { size_label: "10x12", rate_per_kg: null, piece_price_amount: "375.0000", piece_price_count: 1000 } },
    { unit: "PIECES", quantity_kg: null, rate_per_kg: null, quantity_pieces: 2000, price_amount: "0.5000", price_pieces_count: 1,
      weight_kg: null, weight_pieces_count: null, weight_source: null,
      productSize: { size_label: "12x14", rate_per_kg: null, piece_price_amount: "0.5000", piece_price_count: 1 } },
  ],
};

describe("buildOrderExportRows", () => {
  const rows = buildOrderExportRows([order]);
  const [kgRow, pcsRow, unweighedRow] = rows;
  const totals = rows[rows.length - 1];

  test("kg line keeps kg columns; pieces columns blank", () => {
    expect(kgRow["Unit"]).toBe("KG");
    expect(kgRow["Quantity (kg)"]).toBe(10);
    expect(kgRow["Quantity (pcs)"]).toBe("");
    expect(kgRow["Product Line Total"]).toBe(1500);
  });

  test("pieces line: price as entered, est. kg, weight source", () => {
    expect(pcsRow["Unit"]).toBe("PIECES");
    expect(pcsRow["Quantity (kg)"]).toBe("");
    expect(pcsRow["Quantity (pcs)"]).toBe(5000);
    expect(pcsRow["Price"]).toBe("₹375 / 1000 pcs");
    expect(pcsRow["Est. kg"]).toBe(50);
    expect(pcsRow["Weight source"]).toBe("Size");
    expect(pcsRow["Product Line Total"]).toBe(1875);
    expect(unweighedRow["Est. kg"]).toBe("");
  });

  test("order total uses shared math", () => {
    expect(kgRow["Total Order Amount"]).toBe(1500 + 1875 + 1000 + 500);
  });

  test("totals row counts every line once", () => {
    expect(totals["Order ID"]).toBe("SUMMARY TOTALS");
    expect(totals["Quantity (kg)"]).toBe(10);
    expect(totals["Quantity (pcs)"]).toBe(7000);
    expect(totals["Est. kg"]).toBe(50);
    expect(totals["Total kg sold"]).toBe(60);
    expect(totals["Pcs without weight"]).toBe(2000);
  });
});
