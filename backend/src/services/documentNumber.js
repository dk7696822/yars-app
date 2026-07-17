"use strict";

const { Op } = require("sequelize");

/**
 * Generate the next sequential document number for a year, e.g. "PO-2026-0004".
 *
 * Reads the highest existing number for the prefix+year and adds one. Must be
 * called inside the same transaction as the insert it numbers, so two concurrent
 * creates cannot claim the same number.
 *
 * A plain SELECT MAX + insert is not enough on its own: two transactions can
 * both read "no rows yet" and both compute the same next number, and the
 * second only discovers the collision when its INSERT hits the unique
 * constraint — which surfaces as a generic UniqueConstraintError instead of
 * whatever domain error the caller's business logic would otherwise raise
 * (e.g. InsufficientStockError), and races on the SAME table+prefix+year
 * between callers with no order relationship are otherwise unresolved. To
 * make numbering itself race-free, take a transaction-scoped Postgres
 * advisory lock keyed on (table, field, prefix, year) first: the second
 * concurrent caller blocks here until the first transaction commits or rolls
 * back, then reads the up-to-date max and proceeds — no collision, no wasted
 * unique-constraint round trip.
 *
 * NOTE on the concurrency test in stockService.invariant.test.js: because
 * this lock currently sits at the very TOP of the function — before the
 * batch-locking in issueStock's consumeFifo/getLockedStockOnHand ever runs —
 * it fully serializes all issues of a given document type+year against each
 * other. That happens to make the concurrent-issue test deterministic, but
 * it is NOT what that test is trying to prove; it's trying to prove the
 * `FOR UPDATE` row lock on stock_batches is what prevents double-spending.
 * Right now that claim is masked: even without the row lock, this advisory
 * lock alone would serialize the two issues and the test would still pass.
 * If numbering ever moves to LATER in the transaction (e.g. only numbering
 * on success, to avoid burning numbers on rollback), the row lock becomes
 * the only thing preventing a double-spend again, and it also becomes
 * possible for two transactions to lock different items' batches out of
 * order and deadlock — at that point getLockedStockOnHand needs a stable
 * ORDER BY and multi-item calls need their `items` sorted by item_id first.
 *
 * Numeric ordering, not string ordering: document numbers are zero-padded to
 * 4 digits but are NOT fixed-width once a prefix+year passes 9999 — "...10000"
 * is 5 digits. A plain `ORDER BY field DESC` compares strings character by
 * character, so "...-9999" sorts ABOVE "...-10000" (the '9' beats the '1' at
 * the first differing position) even though 10000 > 9999 numerically. Order
 * by string length first — the longer suffix is always the larger number,
 * since all rows share the same prefix — then by the string itself for ties
 * within the same length.
 */
const generateDocumentNumber = async (model, field, prefix, year, transaction = null) => {
  const yearPrefix = `${prefix}-${year}-`;

  if (transaction) {
    const lockKey = `${model.getTableName()}:${field}:${yearPrefix}`;
    await model.sequelize.query("SELECT pg_advisory_xact_lock(hashtext(?))", {
      replacements: [lockKey],
      transaction,
    });
  }

  const latest = await model.findOne({
    where: { [field]: { [Op.like]: `${yearPrefix}%` } },
    order: [
      [model.sequelize.fn("length", model.sequelize.col(field)), "DESC"],
      [field, "DESC"],
    ],
    transaction,
    paranoid: false,
  });

  const lastSequence = latest ? parseInt(latest[field].slice(yearPrefix.length), 10) : 0;
  const next = lastSequence + 1;

  return `${yearPrefix}${String(next).padStart(4, "0")}`;
};

module.exports = { generateDocumentNumber };
