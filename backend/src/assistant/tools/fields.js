"use strict";

const { z } = require("zod");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An id the model got from find — never a name. */
const recordId = () => z.string({ error: "missing — call find first to get this id" }).regex(UUID, { error: "use an id from find, not a name" });

const isoDate = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "use a date like 2026-10-01" });

/** Rupees as a number; "₹5,000" and "5000.00" are read as 5000. */
const money = () =>
  z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/[₹,\s]/g, "")) : v),
    z.number({ error: "give the amount as a number" }).positive({ error: "the amount must be above 0" })
  );

module.exports = { recordId, isoDate, money };
