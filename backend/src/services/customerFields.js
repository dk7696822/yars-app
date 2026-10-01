"use strict";

const { ValidationError } = require("../commands/errors");

class CustomerFieldError extends ValidationError {}

const OPTIONAL = ["email", "phone", "address", "city", "gstin"];
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const clean = (v) => (typeof v === "string" ? v.trim() : v);

/**
 * Request body → { name, patch, remove }. Contact fields live in metadata:
 * a value sets it, "" or null removes it, a missing key leaves it alone.
 */
const readCustomerBody = (body = {}) => {
  const name = clean(body.name);
  if (!name) throw new CustomerFieldError("Customer name is required");
  const patch = {};
  const remove = [];
  for (const key of OPTIONAL) {
    if (body[key] === undefined) continue;
    let value = clean(body[key]);
    if (value === null || value === "") {
      remove.push(key);
      continue;
    }
    if (key === "gstin") {
      value = String(value).toUpperCase();
      if (!GSTIN.test(value)) throw new CustomerFieldError("GSTIN should be 15 characters, like 29ABCDE1234F1Z5");
    }
    patch[key] = value;
  }
  return { name, patch, remove };
};

module.exports = { readCustomerBody, CustomerFieldError };
