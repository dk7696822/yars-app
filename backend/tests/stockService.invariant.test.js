"use strict";

const db = require("../src/models");
const stockService = require("../src/services/stockService");
const { createItem, createSupplier } = require("./helpers/factories");

/** SUM(batch.quantity_remaining) must always equal SUM(movement.quantity). */
const assertReconciled = async (itemId) => {
  const batches = await db.StockBatch.findAll({ where: { item_id: itemId } });
  const movements = await db.StockMovement.findAll({ where: { item_id: itemId } });

  const batchTotal = batches.reduce((sum, b) => sum + parseFloat(b.quantity_remaining), 0);
  const ledgerTotal = movements.reduce((sum, m) => sum + parseFloat(m.quantity), 0);

  expect(batchTotal).toBeCloseTo(ledgerTotal, 3);
  return batchTotal;
};

describe("stock invariant: batches reconcile with the movement ledger", () => {
  it("holds across a full receive → issue → waste → adjust lifecycle", async () => {
    const item = await createItem();
    const supplier = await createSupplier();

    await stockService.receiveStock({
      supplier_id: supplier.id,
      receipt_date: "2026-01-01",
      items: [{ item_id: item.id, quantity_received: 300, rate: 80 }],
    });
    await assertReconciled(item.id);

    await stockService.receiveStock({
      supplier_id: supplier.id,
      receipt_date: "2026-02-01",
      items: [{ item_id: item.id, quantity_received: 400, rate: 90 }],
    });
    await assertReconciled(item.id);

    // Consumption that crosses a batch boundary, plus wastage.
    await stockService.issueStock({
      issue_date: "2026-03-01",
      items: [{ item_id: item.id, quantity: 350, wastage_quantity: 15 }],
    });
    await assertReconciled(item.id);

    await stockService.adjustStock({
      issue_date: "2026-04-01",
      issue_type: "ADJUSTMENT_OUT",
      reason: "Water damage",
      items: [{ item_id: item.id, quantity: 25 }],
    });
    await assertReconciled(item.id);

    await stockService.adjustStock({
      issue_date: "2026-05-01",
      issue_type: "ADJUSTMENT_IN",
      reason: "Stock take surplus",
      items: [{ item_id: item.id, quantity: 10 }],
    });

    const total = await assertReconciled(item.id);

    // 300 + 400 - 350 - 15 - 25 + 10
    expect(total).toBeCloseTo(320, 3);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBeCloseTo(320, 3);
  });

  it("a failed issue leaves the ledger and the batches reconciled", async () => {
    const item = await createItem();
    const supplier = await createSupplier();

    await stockService.receiveStock({
      supplier_id: supplier.id,
      receipt_date: "2026-01-01",
      items: [{ item_id: item.id, quantity_received: 100, rate: 80 }],
    });

    await expect(
      stockService.issueStock({
        issue_date: "2026-03-01",
        items: [{ item_id: item.id, quantity: 500 }],
      })
    ).rejects.toThrow(stockService.InsufficientStockError);

    const total = await assertReconciled(item.id);
    expect(total).toBeCloseTo(100, 3);
  });

  it("concurrent issues of the same item cannot double-spend a batch", async () => {
    const item = await createItem();
    const supplier = await createSupplier();

    await stockService.receiveStock({
      supplier_id: supplier.id,
      receipt_date: "2026-01-01",
      items: [{ item_id: item.id, quantity_received: 100, rate: 80 }],
    });

    // Two issues of 60 fired at once against 100 units of stock.
    // Exactly one must win; the other must fail. 60 + 60 = 120 > 100.
    const results = await Promise.allSettled([
      stockService.issueStock({ issue_date: "2026-03-01", items: [{ item_id: item.id, quantity: 60 }] }),
      stockService.issueStock({ issue_date: "2026-03-01", items: [{ item_id: item.id, quantity: 60 }] }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(stockService.InsufficientStockError);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBeCloseTo(40, 3); // never negative
    await assertReconciled(item.id);
  });
});
