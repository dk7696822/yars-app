"use strict";

const { z } = require("zod");
const { defineAction } = require("../actionKit/defineAction");
const { findSimilar } = require("../../services/customerSimilar");
const { mobileStatus, mobileDigits } = require("../../services/phone");
const command = require("../../commands/customers/createCustomer");

const FIELDS = [["name", "Name"], ["phone", "Phone"], ["city", "City"], ["email", "Email"], ["address", "Address"], ["gstin", "GSTIN"]];

module.exports = defineAction({
  name: "create_customer",
  area: "customers",
  summary: "a new customer",
  description: "Card to add a customer. Only name is required.",
  input: z.object({
    name: z.string().min(1),
    phone: z.string().optional(),
    city: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    gstin: z.string().optional(),
  }),
  trialRunSafe: true,
  command,
  resolve: async (args, { models }) => {
    // The same clean-up as the customer form (toCustomerPayload).
    const fields = { name: args.name.trim() };
    if (args.phone) fields.phone = mobileStatus(args.phone) === "valid" ? mobileDigits(args.phone) : args.phone.trim();
    for (const key of ["city", "email", "address"]) if (args[key]?.trim()) fields[key] = args[key].trim();
    if (args.gstin?.trim()) fields.gstin = args.gstin.trim().toUpperCase();
    const all = (await models.Customer.findAll({ where: { is_archived: false }, attributes: ["id", "name", "metadata"] })).map((c) => c.toJSON());
    return { fields, similar: findSimilar(fields.name, all, null, 3) };
  },
  toCommandInput: (r) => r.fields,
  preview: async (r) => ({
    title: `New customer ${r.fields.name}`,
    rows: FIELDS.filter(([key]) => r.fields[key]).map(([key, label]) => ({ label, value: r.fields[key] })),
    warnings: r.similar.map((c) => `Looks like an existing customer: ${c.name}${c.metadata?.phone ? ` (${c.metadata.phone})` : ""}`),
  }),
  resultLink: (result) => `/customers/${result.id}`,
  formLink: (payload, id) => `/customers/new?assistant=${id}`,
  evals: [
    { ask: "Add a new customer Ganesh Textiles, phone 98450 12345, in Hubli", expect: { action: "create_customer", args: { name: "Ganesh Textiles", city: "Hubli" } } },
    { ask: "Add customer Laxmi Stores", expect: { action: "create_customer", args: { name: "Laxmi Stores" } } },
    { ask: "Add a customer", expect: { asks: true } },
  ],
});
