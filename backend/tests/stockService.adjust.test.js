"use strict";

const db = require("../src/models");
const stockService = require("../src/services/stockService");
const { createItem, givenBatch } = require("./helpers/factories");

describe("adjustStock", () => {
  it("ADJUSTMENT_OUT consumes FIFO like an issue", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 300, rate: 80, received_date: "2026-01-01" });
    await givenBatch(item, { quantity: 400, rate: 90, received_date: "2026-02-01" });

    await stockService.adjustStock({
      issue_date: "2026-07-11",
      issue_type: "ADJUSTMENT_OUT",
      reason: "Damaged by water leak",
      items: [{ item_id: item.id, quantity: 350 }],
    });

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(350); // 700 - 350

    const movements = await db.StockMovement.findAll({
      where: { item_id: item.id, movement_type: "ADJUSTMENT_OUT" },
    });
    expect(movements).toHaveLength(2); // crossed a batch boundary
  });

  it("ADJUSTMENT_IN creates a new batch at the most recent rate", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 100, rate: 80, received_date: "2026-01-01" });
    await givenBatch(item, { quantity: 100, rate: 95, received_date: "2026-06-01" });

    await stockService.adjustStock({
      issue_date: "2026-07-11",
      issue_type: "ADJUSTMENT_IN",
      reason: "Stock take surplus",
      items: [{ item_id: item.id, quantity: 50 }],
    });

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(250);
    // 100*80 + 100*95 + 50*95 (newest rate) = 8000 + 9500 + 4750
    expect(stock.value).toBe(22250);

    const movement = await db.StockMovement.findOne({
      where: { item_id: item.id, movement_type: "ADJUSTMENT_IN" },
    });
    expect(parseFloat(movement.quantity)).toBe(50); // positive
    expect(parseFloat(movement.unit_cost)).toBe(95);
  });

  it("ADJUSTMENT_IN on an item that was never received uses a rate of zero", async () => {
    const item = await createItem();

    await stockService.adjustStock({
      issue_date: "2026-07-11",
      issue_type: "ADJUSTMENT_IN",
      reason: "Found unrecorded stock",
      items: [{ item_id: item.id, quantity: 25 }],
    });

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(25);
    expect(stock.value).toBe(0);
  });

  it("requires a reason", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 100, rate: 80, received_date: "2026-01-01" });

    await expect(
      stockService.adjustStock({
        issue_date: "2026-07-11",
        issue_type: "ADJUSTMENT_OUT",
        reason: "",
        items: [{ item_id: item.id, quantity: 10 }],
      })
    ).rejects.toThrow(/reason/i);

    expect(await db.StockIssue.count()).toBe(0);
  });

  it("ADJUSTMENT_OUT cannot drive stock negative", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 100, rate: 80, received_date: "2026-01-01" });

    await expect(
      stockService.adjustStock({
        issue_date: "2026-07-11",
        issue_type: "ADJUSTMENT_OUT",
        reason: "Stock take shortfall",
        items: [{ item_id: item.id, quantity: 150 }],
      })
    ).rejects.toThrow(stockService.InsufficientStockError);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(100);
  });
});
