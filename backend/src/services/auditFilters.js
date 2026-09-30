"use strict";

const { Op } = require("sequelize");
const { addDays } = require("./dashboard/dateRanges");

class AuditFilterError extends Error {}

const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;

/** 00:00 India time on that day. The server runs in UTC, so this is spelled out. */
const istStart = (d) => new Date(`${d}T00:00:00+05:30`);

/** /audit-logs query → Sequelize where. Dates are whole India days. */
const auditWhere = ({ entity_type, action, from_date, to_date, entity_id } = {}) => {
  const where = {};
  if (entity_type) {
    const types = String(entity_type).toUpperCase().split(",").map((t) => t.trim()).filter(Boolean);
    where.entity_type = types.length === 1 ? types[0] : { [Op.in]: types };
  }
  if (action) where.action = String(action).toUpperCase();
  if (entity_id) where.entity_id = entity_id;
  if (from_date || to_date) {
    for (const d of [from_date, to_date]) if (d && !isDate(d)) throw new AuditFilterError("Dates must look like 2026-09-30");
    where.created_at = {};
    if (from_date) where.created_at[Op.gte] = istStart(from_date);
    if (to_date) where.created_at[Op.lt] = istStart(addDays(to_date, 1));
  }
  return where;
};

module.exports = { auditWhere, AuditFilterError };
