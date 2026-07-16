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
    order: [[field, "DESC"]],
    transaction,
    paranoid: false,
  });

  const lastSequence = latest ? parseInt(latest[field].slice(yearPrefix.length), 10) : 0;
  const next = lastSequence + 1;

  return `${yearPrefix}${String(next).padStart(4, "0")}`;
};

module.exports = { generateDocumentNumber };
