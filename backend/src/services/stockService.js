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

/**
 * Consume `quantity` of an item from its open batches, oldest first.
 *
 * Assumes the caller has ALREADY locked the item's batches and validated that
 * enough stock exists. Writes one movement per batch touched, each costed at
 * that batch's rate.
 *
 * @returns {{cost: number}} the true FIFO cost of what was consumed
 */
const consumeFifo = async (
  { item, quantity, movementType, referenceType, referenceId, movementDate, orderId, notes },
  transaction
) => {
  let remainingToConsume = quantity;
  let cost = 0;

  const batches = await db.StockBatch.findAll({
    where: { item_id: item.id, quantity_remaining: { [Op.gt]: 0 } },
    order: [
      ["received_date", "ASC"],
      ["sequence_number", "ASC"], // deterministic tie-break for same-day batches (DB identity column)
    ],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  for (const batch of batches) {
    if (remainingToConsume <= 0) break;

    const available = parseFloat(batch.quantity_remaining);
    const rate = parseFloat(batch.rate);
    const take = Math.min(available, remainingToConsume);
    const lineCost = take * rate;

    await batch.update({ quantity_remaining: available - take }, { transaction });

    await db.StockMovement.create(
      {
        item_id: item.id,
        movement_type: movementType,
        quantity: -take, // negative: out of stock
        stock_batch_id: batch.id,
        unit_cost: rate,
        total_cost: lineCost,
        reference_type: referenceType,
        reference_id: referenceId,
        order_id: orderId || null,
        movement_date: movementDate,
        notes: notes || null,
      },
      { transaction }
    );

    cost += lineCost;
    remainingToConsume -= take;
  }

  // Epsilon is 0.0005 — HALF the smallest representable quantity step. Quantities
  // are DECIMAL(12,3), so 0.001 is a legal quantity, not float noise; a tolerance
  // of 0.001 would let a request exactly one step over available slip through.
  // 0.0005 still absorbs IEEE-754 noise (~1e-15 at these magnitudes) but cannot
  // be reached by any representable quantity.
  if (remainingToConsume > 0.0005) {
    // Should be unreachable: the caller validates availability first. If we get
    // here, availability and batches disagree — fail loudly rather than write
    // a silently wrong number.
    throw new Error(
      `FIFO consumption fell short for ${item.name}: ${remainingToConsume} left unconsumed`
    );
  }

  return { cost };
};

/**
 * Record material leaving stock: production consumption, with optional wastage
 * on the same line.
 *
 * A line of quantity 500 + wastage_quantity 20 draws 520 from stock: 500 written
 * as ISSUE movements, 20 as WASTAGE movements, both FIFO-costed. Wastage is taken
 * AFTER consumption, so it eats whatever batches consumption did not.
 *
 * Throws InsufficientStockError (and rolls back the ENTIRE issue) if any line
 * would drive stock negative.
 */
const issueStockInternal = async ({
  issue_date,
  issue_type = "ISSUE",
  order_id = null,
  reason = null,
  notes = null,
  items,
}) => {
  if (!items || items.length === 0) {
    throw new Error("A stock issue must have at least one item");
  }

  return db.sequelize.transaction(async (transaction) => {
    const year = new Date(issue_date).getFullYear();
    const issueNumber = await generateDocumentNumber(
      db.StockIssue,
      "issue_number",
      "ISS",
      year,
      transaction
    );

    const issue = await db.StockIssue.create(
      { issue_number: issueNumber, issue_date, issue_type, order_id, reason, notes },
      { transaction }
    );

    for (const line of items) {
      const quantity = parseFloat(line.quantity);
      const wastage = parseFloat(line.wastage_quantity || 0);

      if (!(quantity > 0)) {
        throw new Error("Issue quantity must be greater than zero");
      }
      if (wastage < 0) {
        throw new Error("Wastage quantity cannot be negative");
      }

      const item = await db.InventoryItem.findByPk(line.item_id, { transaction });
      if (!item) {
        throw new Error(`Inventory item not found: ${line.item_id}`);
      }

      // Lock this item's batches, then check availability against the LOCKED rows.
      // Doing it in this order is what makes concurrent issues safe.
      const available = await getLockedStockOnHand(item.id, transaction);
      const required = quantity + wastage;

      // 0.0005 = half the smallest DECIMAL(12,3) step — see consumeFifo's epsilon note.
      if (required > available + 0.0005) {
        throw new InsufficientStockError(item.name, required, available, item.unit);
      }

      // A pure-wastage document has no consumption leg.
      const consumptionType = issue_type === "ISSUE" ? "ISSUE" : issue_type;

      const { cost } = await consumeFifo(
        {
          item,
          quantity,
          movementType: consumptionType,
          referenceType: "STOCK_ISSUE",
          referenceId: issue.id,
          movementDate: issue_date,
          orderId: order_id,
          notes,
        },
        transaction
      );

      let wastageCost = 0;
      if (wastage > 0) {
        const wastageResult = await consumeFifo(
          {
            item,
            quantity: wastage,
            movementType: "WASTAGE",
            referenceType: "STOCK_ISSUE",
            referenceId: issue.id,
            movementDate: issue_date,
            orderId: order_id,
            notes,
          },
          transaction
        );
        wastageCost = wastageResult.cost;
      }

      await db.StockIssueItem.create(
        {
          stock_issue_id: issue.id,
          item_id: item.id,
          quantity,
          total_cost: cost,
          wastage_quantity: wastage,
          wastage_cost: wastageCost,
        },
        { transaction }
      );
    }

    return db.StockIssue.findByPk(issue.id, {
      include: [{ model: db.StockIssueItem, as: "items" }],
      transaction,
    });
  });
};

/** Public issue entry point: production consumption and pure wastage only. */
const issueStock = async (payload) => {
  const type = payload.issue_type || "ISSUE";
  if (!["ISSUE", "WASTAGE"].includes(type)) {
    throw new Error("issueStock only handles ISSUE and WASTAGE. Use adjustStock for adjustments.");
  }
  return issueStockInternal({ ...payload, issue_type: type });
};

/**
 * Stock on hand, reading the batches with a row lock held. Used inside issue
 * transactions so the availability check cannot race another issue.
 */
const getLockedStockOnHand = async (itemId, transaction) => {
  const batches = await db.StockBatch.findAll({
    where: { item_id: itemId, quantity_remaining: { [Op.gt]: 0 } },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  return batches.reduce((total, batch) => total + parseFloat(batch.quantity_remaining), 0);
};

module.exports = {
  InsufficientStockError,
  getStockOnHand,
  receiveStock,
  recomputePurchaseOrderStatus,
  issueStock,
};
