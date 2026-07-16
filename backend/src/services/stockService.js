"use strict";

const { Op } = require("sequelize");
const db = require("../models");
const { generateDocumentNumber } = require("./documentNumber");

/**
 * Stock Service
 *
 * The single place where stock is mutated. Every function here runs in a
 * transaction and keeps two things in lockstep:
 *
 *   stock_batches   — FIFO lots. quantity_remaining IS the stock on hand.
 *   stock_movements — append-only ledger. Never updated, never deleted.
 *
 * Invariant: for any item, SUM(batch.quantity_remaining) always equals
 * SUM(movement.quantity). Task 3.6 tests this.
 *
 * Sequelize returns DECIMAL as a STRING. parseFloat() everything.
 */

/** Thrown when an issue would drive stock negative. Controllers map this to a 400. */
class InsufficientStockError extends Error {
  constructor(itemName, requested, available, unit) {
    super(
      `Insufficient stock for ${itemName}: tried to issue ${requested} ${unit}, but only ${available} ${unit} available`
    );
    this.name = "InsufficientStockError";
    this.itemName = itemName;
    this.requested = requested;
    this.available = available;
  }
}

/**
 * Current stock and value for one item, derived from its open batches.
 * @returns {{quantity: number, value: number}}
 */
const getStockOnHand = async (itemId, transaction = null) => {
  const batches = await db.StockBatch.findAll({
    where: { item_id: itemId, quantity_remaining: { [Op.gt]: 0 } },
    transaction,
  });

  return batches.reduce(
    (acc, batch) => {
      const remaining = parseFloat(batch.quantity_remaining);
      const rate = parseFloat(batch.rate);
      return {
        quantity: acc.quantity + remaining,
        value: acc.value + remaining * rate,
      };
    },
    { quantity: 0, value: 0 }
  );
};

/**
 * Record a goods receipt: material physically arriving.
 *
 * Creates the receipt + lines, one stock_batch per line (this is the FIFO lot),
 * and a RECEIPT movement per line. If linked to a PO, accumulates
 * quantity_received on the PO lines and recomputes the PO status.
 *
 * Over-receiving (more than ordered) is ALLOWED — suppliers over-deliver, and
 * blocking it would only push the user to enter false numbers.
 *
 * @returns the created GoodsReceipt (with items loaded)
 */
const receiveStock = async ({
  purchase_order_id = null,
  supplier_id,
  receipt_date,
  supplier_bill_ref = null,
  notes = null,
  items,
}) => {
  if (!items || items.length === 0) {
    throw new Error("A goods receipt must have at least one item");
  }

  return db.sequelize.transaction(async (transaction) => {
    const year = new Date(receipt_date).getFullYear();
    const receiptNumber = await generateDocumentNumber(
      db.GoodsReceipt,
      "receipt_number",
      "GR",
      year,
      transaction
    );

    const receipt = await db.GoodsReceipt.create(
      {
        receipt_number: receiptNumber,
        purchase_order_id,
        supplier_id,
        receipt_date,
        supplier_bill_ref,
        notes,
      },
      { transaction }
    );

    for (const line of items) {
      const quantity = parseFloat(line.quantity_received);
      const rate = parseFloat(line.rate);

      if (!(quantity > 0)) {
        throw new Error("Received quantity must be greater than zero");
      }

      const receiptItem = await db.GoodsReceiptItem.create(
        {
          goods_receipt_id: receipt.id,
          purchase_order_item_id: line.purchase_order_item_id || null,
          item_id: line.item_id,
          quantity_received: quantity,
          rate,
        },
        { transaction }
      );

      // The FIFO lot. quantity_remaining starts full and is drawn down by issues.
      const batch = await db.StockBatch.create(
        {
          item_id: line.item_id,
          goods_receipt_item_id: receiptItem.id,
          received_date: receipt_date,
          quantity_received: quantity,
          quantity_remaining: quantity,
          rate,
        },
        { transaction }
      );

      await db.StockMovement.create(
        {
          item_id: line.item_id,
          movement_type: "RECEIPT",
          quantity, // positive: into stock
          stock_batch_id: batch.id,
          unit_cost: rate,
          total_cost: quantity * rate,
          reference_type: "GOODS_RECEIPT",
          reference_id: receipt.id,
          movement_date: receipt_date,
        },
        { transaction }
      );

      if (line.purchase_order_item_id) {
        const poItem = await db.PurchaseOrderItem.findByPk(line.purchase_order_item_id, { transaction });
        if (poItem) {
          await poItem.update(
            { quantity_received: parseFloat(poItem.quantity_received) + quantity },
            { transaction }
          );
        }
      }
    }

    if (purchase_order_id) {
      await recomputePurchaseOrderStatus(purchase_order_id, transaction);
    }

    return db.GoodsReceipt.findByPk(receipt.id, {
      include: [{ model: db.GoodsReceiptItem, as: "items" }],
      transaction,
    });
  });
};

/**
 * A PO is RECEIVED once every line has received at least what was ordered
 * (over-receipt counts as complete), PARTIALLY_RECEIVED if any material has
 * arrived, otherwise left alone. CANCELLED POs are never touched.
 */
const recomputePurchaseOrderStatus = async (purchaseOrderId, transaction) => {
  const po = await db.PurchaseOrder.findByPk(purchaseOrderId, {
    include: [{ model: db.PurchaseOrderItem, as: "items" }],
    transaction,
  });

  if (!po || po.status === "CANCELLED") return;

  const allComplete = po.items.every(
    (line) => parseFloat(line.quantity_received) >= parseFloat(line.quantity_ordered)
  );
  const anyReceived = po.items.some((line) => parseFloat(line.quantity_received) > 0);

  let status = po.status;
  if (allComplete) status = "RECEIVED";
  else if (anyReceived) status = "PARTIALLY_RECEIVED";

  if (status !== po.status) {
    await po.update({ status }, { transaction });
  }
};

module.exports = {
  InsufficientStockError,
  getStockOnHand,
  receiveStock,
  recomputePurchaseOrderStatus,
};
