"use strict";

const { z } = require("zod");
const { Customer } = require("../../models");
const { defineCommand } = require("../defineCommand");
const { readCustomerBody } = require("../../services/customerFields");

// The form sends text; a number (e.g. a phone) is kept as its text, as before commands.
const text = z.preprocess((v) => (typeof v === "number" ? String(v) : v), z.string().nullish());

module.exports = defineCommand({
  name: "customers.create",
  route: "POST /customers",
  // readCustomerBody does the field checks, with the messages the form shows.
  input: z.object({ name: text, phone: text, city: text, email: text, address: text, gstin: text }),
  run: async (v, { transaction, actor }) => {
    const { name, patch } = readCustomerBody(v);
    const customer = await Customer.create({ name, metadata: patch }, { transaction, actor });
    return { id: customer.id };
  },
});
