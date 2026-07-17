"use strict";

const db = require("../src/models");
const stockService = require("../src/services/stockService");
const { createItem, createSupplier } = require("./helpers/factories");

const makePO = async (item, { quantity_ordered, rate }) => {
  const supplier = await createSupplier();
  const po = await db.PurchaseOrder.create({
    po_number: `PO-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
    supplier_id: supplier.id,
    order_date: "2026-07-01",
  });
  const line = await db.PurchaseOrderItem.create({
    purchase_order_id: po.id,
    item_id: item.id,
    quantity_ordered,
    rate,
  });
  return { supplier, po, line };
};

describe("receiveStock", () => {
  it("creates a batch and a RECEIPT movement, and stock reflects it", async () => {
    const item = await createItem();
    const supplier = await createSupplier();

    const receipt = await stockService.receiveStock({
      supplier_id: supplier.id,
      receipt_date: "2026-07-11",
      items: [{ item_id: item.id, quantity_received: 500, rate: 85 }],
    });

    expect(receipt.receipt_number).toMatch(/^GR-\d{4}-\d{4}$/);

    const batches = await db.StockBatch.findAll({ where: { item_id: item.id } });
    expect(batches).toHaveLength(1);
    expect(parseFloat(batches[0].quantity_remaining)).toBe(500);
    expect(parseFloat(batches[0].rate)).toBe(85);

    const movements = await db.StockMovement.findAll({ where: { item_id: item.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0].movement_type).toBe("RECEIPT");
    expect(parseFloat(movements[0].quantity)).toBe(500); // positive: into stock
    expect(parseFloat(movements[0].total_cost)).toBe(42500);
    expect(movements[0].reference_type).toBe("GOODS_RECEIPT");

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(500);
    expect(stock.value).toBe(42500);
  });

  it("receiving without a purchase order works", async () => {
    const item = await createItem();
    const supplier = await createSupplier();

    const receipt = await stockService.receiveStock({
      supplier_id: supplier.id,
      receipt_date: "2026-07-11",
      items: [{ item_id: item.id, quantity_received: 100, rate: 50 }],
    });

    expect(receipt.purchase_order_id).toBeNull();
    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(100);
  });

  it("a partial receipt moves the PO to PARTIALLY_RECEIVED", async () => {
    const item = await createItem();
    const { supplier, po, line } = await makePO(item, { quantity_ordered: 500, rate: 80 });

    await stockService.receiveStock({
      purchase_order_id: po.id,
      supplier_id: supplier.id,
      receipt_date: "2026-07-11",
      items: [{ item_id: item.id, purchase_order_item_id: line.id, quantity_received: 200, rate: 80 }],
    });

    await po.reload();
    await line.reload();
    expect(po.status).toBe("PARTIALLY_RECEIVED");
    expect(parseFloat(line.quantity_received)).toBe(200);
  });

  it("receiving the remainder moves the PO to RECEIVED and accumulates quantity_received", async () => {
    const item = await createItem();
    const { supplier, po, line } = await makePO(item, { quantity_ordered: 500, rate: 80 });

    await stockService.receiveStock({
      purchase_order_id: po.id,
      supplier_id: supplier.id,
      receipt_date: "2026-07-11",
      items: [{ item_id: item.id, purchase_order_item_id: line.id, quantity_received: 200, rate: 80 }],
    });
    await stockService.receiveStock({
      purchase_order_id: po.id,
      supplier_id: supplier.id,
      receipt_date: "2026-07-15",
      items: [{ item_id: item.id, purchase_order_item_id: line.id, quantity_received: 300, rate: 80 }],
    });

    await po.reload();
    await line.reload();
    expect(po.status).toBe("RECEIVED");
    expect(parseFloat(line.quantity_received)).toBe(500);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(500);

    // Two receipts = two separate batches, even for the same item.
    const batches = await db.StockBatch.findAll({ where: { item_id: item.id } });
    expect(batches).toHaveLength(2);
  });

  it("allows over-receipt and still marks the PO RECEIVED", async () => {
    const item = await createItem();
    const { supplier, po, line } = await makePO(item, { quantity_ordered: 500, rate: 80 });

    await stockService.receiveStock({
      purchase_order_id: po.id,
      supplier_id: supplier.id,
      receipt_date: "2026-07-11",
      items: [{ item_id: item.id, purchase_order_item_id: line.id, quantity_received: 520, rate: 80 }],
    });

    await po.reload();
    await line.reload();
    expect(po.status).toBe("RECEIVED");
    expect(parseFloat(line.quantity_received)).toBe(520);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(520);
  });

  it("the batch carries the RECEIPT rate, not the PO rate", async () => {
    const item = await createItem();
    const { supplier, po, line } = await makePO(item, { quantity_ordered: 500, rate: 80 });

    // Supplier raised the price between the PO and the delivery.
    await stockService.receiveStock({
      purchase_order_id: po.id,
      supplier_id: supplier.id,
      receipt_date: "2026-07-11",
      items: [{ item_id: item.id, purchase_order_item_id: line.id, quantity_received: 500, rate: 95 }],
    });

    const batch = await db.StockBatch.findOne({ where: { item_id: item.id } });
    expect(parseFloat(batch.rate)).toBe(95);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.value).toBe(47500); // 500 * 95, not 500 * 80
  });

  it("rolls back everything if one line is invalid", async () => {
    const item = await createItem();
    const supplier = await createSupplier();

    await expect(
      stockService.receiveStock({
        supplier_id: supplier.id,
        receipt_date: "2026-07-11",
        items: [
          { item_id: item.id, quantity_received: 100, rate: 50 },
          { item_id: "00000000-0000-0000-0000-000000000000", quantity_received: 50, rate: 10 },
        ],
      })
    ).rejects.toThrow();

    // The valid first line must NOT have been written.
    const batches = await db.StockBatch.findAll();
    const receipts = await db.GoodsReceipt.findAll();
    expect(batches).toHaveLength(0);
    expect(receipts).toHaveLength(0);
  });
});
