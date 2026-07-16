"use strict";

const { Op } = require("sequelize");
const db = require("../models");
const { generateDocumentNumber } = require("./documentNumber");
const { createAuditLog } = require("./auditService");

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
 * Thrown when FIFO consumption cannot account for the full quantity it was
 * asked to draw down, after the caller already validated availability. This
 * should be unreachable in normal operation — if it fires, the batches and
 * the availability check have disagreed, which is a data-integrity problem,
 * not a user input problem. Named separately from InsufficientStockError so
 * controllers can map it to a 500-with-alert instead of a 400, rather than
 * string-matching the message to tell the two apart.
 */
class StockReconciliationError extends Error {
  constructor(message) {
    super(message);
    this.name = "StockReconciliationError";
  }
}

/**
 * Quantities are DECIMAL(12,3) in the schema. Every public entry point below
 * quantizes its inputs through this BEFORE any arithmetic touches them. If
 * two related numbers land on different points of the grid — e.g. a caller
 * passes a wastage_quantity of 0.0005, which cannot be represented at 3
 * decimal places — Postgres rounds the batch decrement and the movement
 * quantity INDEPENDENTLY when each is written, and they can round to
 * different values: the batches/movements invariant breaks by a whole grid
 * step. Quantizing once, at the boundary, means every number downstream is
 * already grid-aligned, so both writes round to the identical value.
 */
const quantizeQuantity = (value) => Math.round(parseFloat(value) * 1000) / 1000;

/** Same idea for money: DECIMAL(14,2), quantize to the cent. */
const quantizeRate = (value) => Math.round(parseFloat(value) * 100) / 100;

/** Round a cost to the cent — used so a FIFO line's total is exactly the sum of its movements. */
const roundCents = (value) => Math.round(value * 100) / 100;

/** Extract the calendar year from a "YYYY-MM-DD" string without going through timezone-sensitive Date parsing. */
const yearFromDateString = (dateStr) => Number(String(dateStr).slice(0, 4));

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

  const receipt = await db.sequelize.transaction(async (transaction) => {
    const year = yearFromDateString(receipt_date);
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
      const quantity = quantizeQuantity(line.quantity_received);
      const rate = quantizeRate(line.rate);

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

  // Audit AFTER the transaction commits — an audit row for a rolled-back
  // receipt would be a lie. createAuditLog swallows its own errors by design;
  // logging must never break the operation it records.
  await createAuditLog(db.AuditLog, {
    entityType: "GOODS_RECEIPT",
    entityId: receipt.id,
    action: "CREATE",
    newValues: {
      receipt_number: receipt.receipt_number,
      receipt_date,
      supplier_id,
      purchase_order_id,
    },
    metadata: {
      item_count: items.length,
      total_value: roundCents(
        items.reduce(
          (sum, line) =>
            sum + quantizeQuantity(line.quantity_received) * quantizeRate(line.rate),
          0
        )
      ),
    },
  });

  return receipt;
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
    const take = quantizeQuantity(Math.min(available, remainingToConsume));
    // Round each batch's slice of the cost to the cent BEFORE writing it and
    // before folding it into the running total, so the line's total_cost
    // ends up exactly the sum of its movements' total_costs (M2) rather than
    // a separately-rounded float sum that can drift by a cent or two across
    // many batches.
    const lineCost = roundCents(take * rate);

    await batch.update({ quantity_remaining: quantizeQuantity(available - take) }, { transaction });

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
    remainingToConsume = quantizeQuantity(remainingToConsume - take);
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
    throw new StockReconciliationError(
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

  const createdIssue = await db.sequelize.transaction(async (transaction) => {
    const year = yearFromDateString(issue_date);
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
      const quantity = quantizeQuantity(line.quantity);
      // A wastage_quantity that quantizes down to zero is legal — it just
      // means "no wastage" — but a primary quantity that quantizes to zero
      // is a rejected input (see the check below).
      const wastage = quantizeQuantity(line.wastage_quantity || 0);

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

  // Audit AFTER commit — a rolled-back issue (e.g. insufficient stock) must
  // leave no audit trace. Covers ISSUE, WASTAGE, and ADJUSTMENT_OUT (which
  // adjustStock routes through here).
  await createAuditLog(db.AuditLog, {
    entityType: "STOCK_ISSUE",
    entityId: createdIssue.id,
    action: issue_type === "ADJUSTMENT_IN" || issue_type === "ADJUSTMENT_OUT" ? "UPDATE" : "CREATE",
    newValues: {
      issue_number: createdIssue.issue_number,
      issue_date,
      issue_type,
      order_id: order_id || null,
    },
    metadata: {
      issue_type,
      reason: reason || null,
      item_count: items.length,
    },
  });

  return createdIssue;
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

/**
 * Stock corrections: stock-take differences and damage.
 *
 *   ADJUSTMENT_OUT — consumes FIFO, exactly like an issue.
 *   ADJUSTMENT_IN  — creates a NEW batch, rated at the item's most recent batch
 *                    rate (or 0 if the item has never been received).
 *
 * `reason` is mandatory. An unexplained stock correction is worthless six
 * months later, when someone is trying to work out where the material went.
 */
const adjustStock = async ({ issue_date, issue_type, reason, notes = null, items }) => {
  if (!["ADJUSTMENT_IN", "ADJUSTMENT_OUT"].includes(issue_type)) {
    throw new Error("Adjustment type must be ADJUSTMENT_IN or ADJUSTMENT_OUT");
  }
  if (!reason || !reason.trim()) {
    throw new Error("A reason is required for a stock adjustment");
  }
  if (!items || items.length === 0) {
    throw new Error("A stock adjustment must have at least one item");
  }

  // Outward adjustments are just an issue with a different movement type.
  if (issue_type === "ADJUSTMENT_OUT") {
    // issueStockInternal writes the audit row for this path.
    return issueStockInternal({ issue_date, issue_type, reason, notes, items });
  }

  const createdIssue = await db.sequelize.transaction(async (transaction) => {
    const year = yearFromDateString(issue_date);
    const issueNumber = await generateDocumentNumber(
      db.StockIssue,
      "issue_number",
      "ISS",
      year,
      transaction
    );

    const issue = await db.StockIssue.create(
      { issue_number: issueNumber, issue_date, issue_type, reason, notes },
      { transaction }
    );

    for (const line of items) {
      const quantity = quantizeQuantity(line.quantity);
      if (!(quantity > 0)) {
        throw new Error("Adjustment quantity must be greater than zero");
      }

      const item = await db.InventoryItem.findByPk(line.item_id, { transaction });
      if (!item) {
        throw new Error(`Inventory item not found: ${line.item_id}`);
      }

      // Value the found stock at the newest RECEIPT-backed rate for this item.
      // A previous ADJUSTMENT_IN batch (goods_receipt_item_id IS NULL) has no
      // real pricing behind it — often literally rate 0, e.g. "found unrecorded
      // stock" — and if one happens to be the newest batch, using its rate
      // would poison every ADJUSTMENT_IN after it to 0. Only fall back to the
      // newest batch of any kind (and then to 0) if the item has never been
      // formally received at all.
      const newestReceipted = await db.StockBatch.findOne({
        where: { item_id: item.id, goods_receipt_item_id: { [Op.ne]: null } },
        order: [
          ["received_date", "DESC"],
          ["sequence_number", "DESC"],
        ],
        transaction,
      });

      let rate;
      if (newestReceipted) {
        rate = parseFloat(newestReceipted.rate);
      } else {
        const newestAny = await db.StockBatch.findOne({
          where: { item_id: item.id },
          order: [
            ["received_date", "DESC"],
            ["sequence_number", "DESC"],
          ],
          transaction,
        });
        rate = newestAny ? parseFloat(newestAny.rate) : 0;
      }

      const batch = await db.StockBatch.create(
        {
          item_id: item.id,
          goods_receipt_item_id: null, // no receipt — this stock was found, not bought
          received_date: issue_date,
          quantity_received: quantity,
          quantity_remaining: quantity,
          rate,
        },
        { transaction }
      );

      const totalCost = roundCents(quantity * rate);

      await db.StockMovement.create(
        {
          item_id: item.id,
          movement_type: "ADJUSTMENT_IN",
          quantity, // positive: into stock
          stock_batch_id: batch.id,
          unit_cost: rate,
          total_cost: totalCost,
          reference_type: "STOCK_ADJUSTMENT",
          reference_id: issue.id,
          movement_date: issue_date,
          notes: reason,
        },
        { transaction }
      );

      await db.StockIssueItem.create(
        {
          stock_issue_id: issue.id,
          item_id: item.id,
          quantity,
          total_cost: totalCost,
        },
        { transaction }
      );
    }

    return db.StockIssue.findByPk(issue.id, {
      include: [{ model: db.StockIssueItem, as: "items" }],
      transaction,
    });
  });

  // Audit AFTER commit — see issueStockInternal.
  await createAuditLog(db.AuditLog, {
    entityType: "STOCK_ISSUE",
    entityId: createdIssue.id,
    action: "UPDATE",
    newValues: {
      issue_number: createdIssue.issue_number,
      issue_date,
      issue_type,
      order_id: null,
    },
    metadata: {
      issue_type,
      reason: reason || null,
      item_count: items.length,
    },
  });

  return createdIssue;
};

module.exports = {
  InsufficientStockError,
  StockReconciliationError,
  getStockOnHand,
  receiveStock,
  recomputePurchaseOrderStatus,
  issueStock,
  adjustStock,
};
