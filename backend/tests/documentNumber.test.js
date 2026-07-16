"use strict";

const db = require("../src/models");
const { generateDocumentNumber } = require("../src/services/documentNumber");
const { createSupplier } = require("./helpers/factories");

describe("generateDocumentNumber", () => {
  it("starts a new prefix at 0001 for the year", async () => {
    const number = await generateDocumentNumber(db.PurchaseOrder, "po_number", "PO", 2026);
    expect(number).toBe("PO-2026-0001");
  });

  it("increments from the highest existing number for that year", async () => {
    const supplier = await createSupplier();
    await db.PurchaseOrder.create({
      po_number: "PO-2026-0007",
      supplier_id: supplier.id,
      order_date: "2026-07-11",
    });

    const number = await generateDocumentNumber(db.PurchaseOrder, "po_number", "PO", 2026);
    expect(number).toBe("PO-2026-0008");
  });

  it("does not let a different year's numbers bleed in", async () => {
    const supplier = await createSupplier();
    await db.PurchaseOrder.create({
      po_number: "PO-2025-0042",
      supplier_id: supplier.id,
      order_date: "2025-07-11",
    });

    const number = await generateDocumentNumber(db.PurchaseOrder, "po_number", "PO", 2026);
    expect(number).toBe("PO-2026-0001");
  });
});
