"use strict";

const stockService = require("../src/services/stockService");
const { createItem, givenBatch } = require("./helpers/factories");

describe("getStockOnHand", () => {
  it("is zero for an item that has never been received", async () => {
    const item = await createItem();

    const stock = await stockService.getStockOnHand(item.id);

    expect(stock.quantity).toBe(0);
    expect(stock.value).toBe(0);
  });

  it("sums the remaining quantity across open batches", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 300, rate: 80, received_date: "2026-01-01" });
    await givenBatch(item, { quantity: 400, rate: 90, received_date: "2026-02-01" });

    const stock = await stockService.getStockOnHand(item.id);

    expect(stock.quantity).toBe(700);
    // Value is per-batch rate, not an average: 300*80 + 400*90
    expect(stock.value).toBe(60000);
  });

  it("ignores exhausted batches", async () => {
    const item = await createItem();
    const empty = await givenBatch(item, { quantity: 300, rate: 80, received_date: "2026-01-01" });
    await empty.update({ quantity_remaining: 0 });
    await givenBatch(item, { quantity: 400, rate: 90, received_date: "2026-02-01" });

    const stock = await stockService.getStockOnHand(item.id);

    expect(stock.quantity).toBe(400);
    expect(stock.value).toBe(36000);
  });
});
