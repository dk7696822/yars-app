"use strict";

const db = require("../src/models");
const stockService = require("../src/services/stockService");
const { createItem, createSupplier, givenBatch } = require("./helpers/factories");

describe("C1: quantities are quantized to the DECIMAL(12,3) grid before any arithmetic", () => {
  it("quantizes a wastage_quantity finer than the grid so batches and the ledger stay reconciled", async () => {
    const item = await createItem();
    const supplier = await createSupplier();
    await stockService.receiveStock({
      supplier_id: supplier.id,
      receipt_date: "2026-01-01",
      items: [{ item_id: item.id, quantity_received: 100, rate: 80 }],
    });

    // 0.0005 is not representable at 3dp. Math.round rounds half-up, so it
    // quantizes to 0.001 — a real, tiny, but legal wastage — rather than being
    // silently truncated to 0 or left to round independently downstream.
    await stockService.issueStock({
      issue_date: "2026-07-11",
      items: [{ item_id: item.id, quantity: 10, wastage_quantity: 0.0005 }],
    });

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBeCloseTo(89.999, 3);

    const batches = await db.StockBatch.findAll({ where: { item_id: item.id } });
    const movements = await db.StockMovement.findAll({ where: { item_id: item.id } });
    const batchTotal = batches.reduce((sum, b) => sum + parseFloat(b.quantity_remaining), 0);
    const ledgerTotal = movements.reduce((sum, m) => sum + parseFloat(m.quantity), 0);
    expect(batchTotal).toBeCloseTo(ledgerTotal, 3);
  });

  it("quantizes a wastage_quantity that rounds to zero into no wastage at all", async () => {
    const item = await createItem();
    const supplier = await createSupplier();
    await stockService.receiveStock({
      supplier_id: supplier.id,
      receipt_date: "2026-01-01",
      items: [{ item_id: item.id, quantity_received: 100, rate: 80 }],
    });

    // 0.0004 rounds DOWN to 0 — quantized-to-zero wastage is legal (means "no
    // wastage"), not an error, and must not write a zero-quantity movement.
    const issue = await stockService.issueStock({
      issue_date: "2026-07-11",
      items: [{ item_id: item.id, quantity: 10, wastage_quantity: 0.0004 }],
    });

    const wasteMoves = await db.StockMovement.findAll({
      where: { item_id: item.id, movement_type: "WASTAGE" },
    });
    expect(wasteMoves).toHaveLength(0);

    const line = (await db.StockIssueItem.findAll({ where: { stock_issue_id: issue.id } }))[0];
    expect(parseFloat(line.wastage_quantity)).toBe(0);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(90);
  });

  it("rejects a primary quantity that quantizes to zero", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 100, rate: 80, received_date: "2026-01-01" });

    await expect(
      stockService.issueStock({
        issue_date: "2026-07-11",
        items: [{ item_id: item.id, quantity: 0.0004 }],
      })
    ).rejects.toThrow(/quantity/i);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(100);
  });

  it("keeps batches and the ledger exact to 3 decimal places when a quantity splits across batches", async () => {
    const item = await createItem();
    // givenBatch seeds batches directly (no RECEIPT movement), so this test
    // checks the two ledgers independently rather than against each other:
    // the remaining batch quantity must sum to exactly what's left, and the
    // movements this issue writes must sum to exactly what was taken — both
    // to 3dp, with no drift introduced by the FIFO split itself.
    await givenBatch(item, { quantity: 20.001, rate: 80, received_date: "2026-01-01" });
    await givenBatch(item, { quantity: 50, rate: 90, received_date: "2026-02-01" });

    await stockService.issueStock({
      issue_date: "2026-07-11",
      items: [{ item_id: item.id, quantity: 33.333 }],
    });

    const batches = await db.StockBatch.findAll({ where: { item_id: item.id } });
    const movements = await db.StockMovement.findAll({
      where: { item_id: item.id, movement_type: "ISSUE" },
    });
    const batchTotal = batches.reduce((sum, b) => sum + parseFloat(b.quantity_remaining), 0);
    const movementTotal = movements.reduce((sum, m) => sum + parseFloat(m.quantity), 0);

    expect(batchTotal).toBeCloseTo(20.001 + 50 - 33.333, 3); // 36.668
    expect(movementTotal).toBeCloseTo(-33.333, 3);
    // Two batches touched means two movements — the split itself must not
    // lose or gain any quantity versus what was requested.
    expect(movements).toHaveLength(2);
  });
});

describe("I1: document year is derived from the date string, not local-timezone Date parsing", () => {
  // `new Date("2026-01-01").getFullYear()` reads back 2025 on a host west of
  // UTC (e.g. America/New_York), because "2026-01-01" parses as UTC midnight,
  // which is still 2025-12-31 evening in that timezone. These tests pass
  // under any TZ the host happens to be running (this repo's CI runs east of
  // UTC), so they don't by themselves prove the bug — but the fix
  // (`Number(String(dateStr).slice(0, 4))`) is what makes the result correct
  // regardless of TZ, which a `getFullYear()` implementation is not.
  it("derives the receipt document year from the date string", async () => {
    const item = await createItem();
    const supplier = await createSupplier();
    const receipt = await stockService.receiveStock({
      supplier_id: supplier.id,
      receipt_date: "2026-01-01",
      items: [{ item_id: item.id, quantity_received: 10, rate: 5 }],
    });
    expect(receipt.receipt_number).toContain("2026");
  });

  it("derives the issue document year from the date string", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 10, rate: 5, received_date: "2026-01-01" });
    const issue = await stockService.issueStock({
      issue_date: "2026-01-01",
      items: [{ item_id: item.id, quantity: 1 }],
    });
    expect(issue.issue_number).toContain("2026");
  });

  it("derives the adjustment document year from the date string", async () => {
    const item = await createItem();
    const issue = await stockService.adjustStock({
      issue_date: "2026-01-01",
      issue_type: "ADJUSTMENT_IN",
      reason: "test",
      items: [{ item_id: item.id, quantity: 1 }],
    });
    expect(issue.issue_number).toContain("2026");
  });
});

describe("I3: ADJUSTMENT_IN rate lookup prefers a receipt-backed batch", () => {
  it("does not let a rate-zero adjustment batch poison later ADJUSTMENT_IN rates", async () => {
    const item = await createItem();
    const supplier = await createSupplier();
    // A real, receipt-backed batch, older — goods_receipt_item_id set, via
    // the actual receiveStock path (givenBatch never sets that column, so it
    // can't stand in for "receipt-backed" here).
    await stockService.receiveStock({
      supplier_id: supplier.id,
      receipt_date: "2026-01-01",
      items: [{ item_id: item.id, quantity_received: 10, rate: 80 }],
    });
    // A prior ADJUSTMENT_IN batch, newer, rated 0 (e.g. an earlier "found
    // stock we don't know the value of" correction) — no goods_receipt_item_id.
    await db.StockBatch.create({
      item_id: item.id,
      goods_receipt_item_id: null,
      received_date: "2026-02-01",
      quantity_received: 5,
      quantity_remaining: 5,
      rate: 0,
    });

    await stockService.adjustStock({
      issue_date: "2026-07-11",
      issue_type: "ADJUSTMENT_IN",
      reason: "Stock take surplus",
      items: [{ item_id: item.id, quantity: 20 }],
    });

    const newBatch = await db.StockBatch.findOne({
      where: { item_id: item.id, received_date: "2026-07-11" },
    });
    expect(parseFloat(newBatch.rate)).toBe(80);
  });

  it("falls back to the newest batch of any kind when the item has never been formally received", async () => {
    const item = await createItem();
    // Only an adjustment-in batch exists — no real receipt ever happened.
    await db.StockBatch.create({
      item_id: item.id,
      goods_receipt_item_id: null,
      received_date: "2026-01-01",
      quantity_received: 5,
      quantity_remaining: 5,
      rate: 42,
    });

    await stockService.adjustStock({
      issue_date: "2026-07-11",
      issue_type: "ADJUSTMENT_IN",
      reason: "Stock take surplus",
      items: [{ item_id: item.id, quantity: 20 }],
    });

    const newBatch = await db.StockBatch.findOne({
      where: { item_id: item.id, received_date: "2026-07-11" },
    });
    expect(parseFloat(newBatch.rate)).toBe(42);
  });
});

describe("M2: FIFO line cost is exactly the sum of its movement total_costs", () => {
  it("holds for odd rates split across two batches", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 100, rate: 123.45, received_date: "2026-01-01" });
    await givenBatch(item, { quantity: 100, rate: 67.89, received_date: "2026-02-01" });

    const issue = await stockService.issueStock({
      issue_date: "2026-07-11",
      items: [{ item_id: item.id, quantity: 150 }],
    });

    const line = (await db.StockIssueItem.findAll({ where: { stock_issue_id: issue.id } }))[0];
    const movements = await db.StockMovement.findAll({
      where: { item_id: item.id, movement_type: "ISSUE" },
    });
    const movementTotal = movements.reduce((sum, m) => sum + parseFloat(m.total_cost), 0);

    expect(parseFloat(line.total_cost)).toBe(movementTotal);
  });
});

describe("M3: StockReconciliationError is a distinct, named, exported error class", () => {
  it("is exported and distinguishable from InsufficientStockError", () => {
    expect(stockService.StockReconciliationError).toBeDefined();
    expect(stockService.StockReconciliationError).not.toBe(stockService.InsufficientStockError);

    const err = new stockService.StockReconciliationError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("StockReconciliationError");
  });
});
