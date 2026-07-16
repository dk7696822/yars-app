"use strict";

const { Op } = require("sequelize");

/**
 * Generate the next sequential document number for a year, e.g. "PO-2026-0004".
 *
 * Reads the highest existing number for the prefix+year and adds one. Must be
 * called inside the same transaction as the insert it numbers, so two concurrent
 * creates cannot claim the same number — the unique constraint on the column is
 * the final backstop.
 */
const generateDocumentNumber = async (model, field, prefix, year, transaction = null) => {
  const yearPrefix = `${prefix}-${year}-`;

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
