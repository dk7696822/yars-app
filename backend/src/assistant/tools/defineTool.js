"use strict";

const { z } = require("zod");

/** Told back to the model so it can fix the call or ask the person. */
class ToolInputError extends Error {
  constructor(message) {
    super(message);
    this.expected = true;
  }
}

/** Models send null for "not given"; Zod's optional() wants the key left out. */
const dropNulls = (v) => {
  if (Array.isArray(v)) return v.map(dropNulls);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null).map(([k, x]) => [k, dropNulls(x)]));
  }
  return v;
};

const parseArgs = (schema, args) => {
  const result = schema.safeParse(dropNulls(args && typeof args === "object" ? args : {}));
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw new ToolInputError(`${issue.path.join(".") || "arguments"}: ${issue.message}`);
};

/** JSON Schema for the model, made from the same Zod schema that checks its arguments. */
const toParameters = (schema) => {
  // "any" keeps preprocess steps (money()) from throwing; the model sees the output type.
  const { $schema, ...rest } = z.toJSONSchema(schema, { unrepresentable: "any" }); // eslint-disable-line no-unused-vars
  return rest;
};

/**
 * A tool the model can call. `run(args, ctx)` returns the text the model reads,
 * or { text, action } for a proposal card. Keep text compact: on the free tier
 * every character costs tokens.
 */
const defineTool = ({ name, description, input, run }) => {
  if (!/^[a-z_]+$/.test(name || "") || !description || !input || typeof run !== "function") {
    throw new Error(`defineTool: bad definition for ${name}`);
  }
  return Object.freeze({ name, description, input, run, declaration: { name, description, parameters: toParameters(input) } });
};

module.exports = { defineTool, parseArgs, toParameters, dropNulls, ToolInputError };
