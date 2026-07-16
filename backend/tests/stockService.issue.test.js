"use strict";

const db = require("../src/models");
const stockService = require("../src/services/stockService");
const { createItem, givenBatch } = require("./helpers/factories");

describe("issueStock", () => {
  it("consumes a single batch and costs it at that batch's rate", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 500, rate: 80, received_date: "2026-01-01" });

    const issue = await stockService.issueStock({
      issue_date: "2026-07-11",
      items: [{ item_id: item.id, quantity: 200 }],
    });

    const line = (await db.StockIssueItem.findAll({ where: { stock_issue_id: issue.id } }))[0];
    expect(parseFloat(line.total_cost)).toBe(16000); // 200 * 80

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(300);
    expect(stock.value).toBe(24000); // 300 * 80
  });

  it("walks batches oldest-first and splits the cost across them", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 300, rate: 80, received_date: "2026-01-01" });
    await givenBatch(item, { quantity: 400, rate: 90, received_date: "2026-02-01" });

    const issue = await stockService.issueStock({
      issue_date: "2026-07-11",
      items: [{ item_id: item.id, quantity: 500 }],
    });

    // 300 @ 80 (oldest batch, fully consumed) + 200 @ 90 = 24000 + 18000
    const line = (await db.StockIssueItem.findAll({ where: { stock_issue_id: issue.id } }))[0];
    expect(parseFloat(line.total_cost)).toBe(42000);

    // One movement per batch touched.
    const movements = await db.StockMovement.findAll({
      where: { item_id: item.id, movement_type: "ISSUE" },
      order: [["created_at", "ASC"]],
    });
    expect(movements).toHaveLength(2);
    expect(parseFloat(movements[0].quantity)).toBe(-300); // negative: out of stock
    expect(parseFloat(movements[0].unit_cost)).toBe(80);
    expect(parseFloat(movements[1].quantity)).toBe(-200);
    expect(parseFloat(movements[1].unit_cost)).toBe(90);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(200);
    expect(stock.value).toBe(18000); // 200 remaining @ 90
  });

  it("exhausting a batch exactly leaves it at zero, not negative", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 300, rate: 80, received_date: "2026-01-01" });
    await givenBatch(item, { quantity: 400, rate: 90, received_date: "2026-02-01" });

    await stockService.issueStock({
      issue_date: "2026-07-11",
      items: [{ item_id: item.id, quantity: 300 }],
    });

    const batches = await db.StockBatch.findAll({
      where: { item_id: item.id },
      order: [["received_date", "ASC"], ["sequence_number", "ASC"]],
    });
    expect(parseFloat(batches[0].quantity_remaining)).toBe(0);
    expect(parseFloat(batches[1].quantity_remaining)).toBe(400);
  });

  it("refuses to issue more than is available, and writes nothing", async () => {
    const item = await createItem({ name: "90 GSM White" });
    await givenBatch(item, { quantity: 100, rate: 80, received_date: "2026-01-01" });

    await expect(
      stockService.issueStock({
        issue_date: "2026-07-11",
        items: [{ item_id: item.id, quantity: 150 }],
      })
    ).rejects.toThrow(stockService.InsufficientStockError);

    // Stock untouched, no issue document, no movements.
    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(100);
    expect(await db.StockIssue.count()).toBe(0);
    expect(await db.StockMovement.count()).toBe(0);
  });

  it("rolls back the whole issue if a LATER line has insufficient stock", async () => {
    const itemA = await createItem({ name: "Item A" });
    const itemB = await createItem({ name: "Item B" });
    await givenBatch(itemA, { quantity: 500, rate: 80, received_date: "2026-01-01" });
    await givenBatch(itemB, { quantity: 10, rate: 20, received_date: "2026-01-01" });

    await expect(
      stockService.issueStock({
        issue_date: "2026-07-11",
        items: [
          { item_id: itemA.id, quantity: 100 }, // fine
          { item_id: itemB.id, quantity: 999 }, // blows up
        ],
      })
    ).rejects.toThrow(stockService.InsufficientStockError);

    // Item A must be untouched — no partial consumption.
    const stockA = await stockService.getStockOnHand(itemA.id);
    expect(stockA.quantity).toBe(500);
    expect(await db.StockIssue.count()).toBe(0);
  });

  it("wastage on a line consumes extra stock and is costed separately", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 1000, rate: 80, received_date: "2026-01-01" });

    const issue = await stockService.issueStock({
      issue_date: "2026-07-11",
      items: [{ item_id: item.id, quantity: 500, wastage_quantity: 20 }],
    });

    const line = (await db.StockIssueItem.findAll({ where: { stock_issue_id: issue.id } }))[0];
    expect(parseFloat(line.total_cost)).toBe(40000); // 500 * 80, consumption only
    expect(parseFloat(line.wastage_cost)).toBe(1600); // 20 * 80, wastage only

    // 520 total left stock.
    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(480);

    // Two distinct movement types.
    const issueMoves = await db.StockMovement.findAll({ where: { item_id: item.id, movement_type: "ISSUE" } });
    const wasteMoves = await db.StockMovement.findAll({ where: { item_id: item.id, movement_type: "WASTAGE" } });
    expect(issueMoves).toHaveLength(1);
    expect(parseFloat(issueMoves[0].quantity)).toBe(-500);
    expect(wasteMoves).toHaveLength(1);
    expect(parseFloat(wasteMoves[0].quantity)).toBe(-20);
  });

  it("validates against quantity + wastage, not quantity alone", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 510, rate: 80, received_date: "2026-01-01" });

    // 500 alone would fit; 500 + 20 wastage does not.
    await expect(
      stockService.issueStock({
        issue_date: "2026-07-11",
        items: [{ item_id: item.id, quantity: 500, wastage_quantity: 20 }],
      })
    ).rejects.toThrow(stockService.InsufficientStockError);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(510);
  });

  it("wastage can cross a batch boundary and is costed at each batch's rate", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 510, rate: 80, received_date: "2026-01-01" });
    await givenBatch(item, { quantity: 500, rate: 100, received_date: "2026-02-01" });

    const issue = await stockService.issueStock({
      issue_date: "2026-07-11",
      items: [{ item_id: item.id, quantity: 500, wastage_quantity: 20 }],
    });

    const line = (await db.StockIssueItem.findAll({ where: { stock_issue_id: issue.id } }))[0];
    // Consumption: 500 @ 80 = 40000 (batch 1 has 510, so it covers all of it)
    expect(parseFloat(line.total_cost)).toBe(40000);
    // Wastage: 10 left in batch 1 @ 80 = 800, then 10 from batch 2 @ 100 = 1000
    expect(parseFloat(line.wastage_cost)).toBe(1800);
  });

  it("tags the issue and its movements to a customer order when given", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 500, rate: 80, received_date: "2026-01-01" });

    const customer = await db.Customer.create({ name: "Test Customer" });
    const plateType = await db.PlateType.create({ type_name: "Single", charge: 100 });
    const order = await db.Order.create({
      customer_id: customer.id,
      order_date: "2026-07-01",
      plate_type_id: plateType.id,
    });

    const issue = await stockService.issueStock({
      issue_date: "2026-07-11",
      order_id: order.id,
      items: [{ item_id: item.id, quantity: 100 }],
    });

    expect(issue.order_id).toBe(order.id);
    const movement = await db.StockMovement.findOne({ where: { item_id: item.id, movement_type: "ISSUE" } });
    expect(movement.order_id).toBe(order.id);
  });

  it("generates a sequential issue number", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 500, rate: 80, received_date: "2026-01-01" });

    const issue = await stockService.issueStock({
      issue_date: "2026-07-11",
      items: [{ item_id: item.id, quantity: 10 }],
    });

    expect(issue.issue_number).toMatch(/^ISS-\d{4}-\d{4}$/);
  });

  it("never writes a zero-quantity movement, and ISSUE/WASTAGE movements are strictly negative while RECEIPT is strictly positive", async () => {
    const { createSupplier } = require("./helpers/factories");
    const item = await createItem();
    const supplier = await createSupplier();

    await stockService.receiveStock({
      supplier_id: supplier.id,
      receipt_date: "2026-01-01",
      items: [{ item_id: item.id, quantity_received: 1000, rate: 80 }],
    });

    await stockService.issueStock({
      issue_date: "2026-07-11",
      items: [{ item_id: item.id, quantity: 500, wastage_quantity: 20 }],
    });

    const movements = await db.StockMovement.findAll({ where: { item_id: item.id } });
    // RECEIPT + ISSUE + WASTAGE, at least one of each.
    expect(movements.length).toBeGreaterThanOrEqual(3);

    for (const movement of movements) {
      const quantity = parseFloat(movement.quantity);
      expect(quantity).not.toBe(0);

      if (movement.movement_type === "ISSUE" || movement.movement_type === "WASTAGE") {
        expect(quantity).toBeLessThan(0);
      }
      if (movement.movement_type === "RECEIPT" || movement.movement_type === "ADJUSTMENT_IN") {
        expect(quantity).toBeGreaterThan(0);
      }
    }
  });
});
