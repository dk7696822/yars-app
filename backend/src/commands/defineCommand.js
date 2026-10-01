"use strict";

const { ValidationError } = require("./errors");

/**
 * One save, defined once and used by the screens' routes and by Sage.
 * `input` is a Zod schema carrying the messages the app shows; `run(input,
 * { transaction, actor })` does the work inside the transaction it is given
 * and returns `{ id }` of the record it saved. `route` ("POST /payments")
 * names the endpoint that serves it, for the coverage guard.
 */
const defineCommand = ({ name, route = null, input, run }) => {
  if (!name || !input || typeof run !== "function") throw new Error(`defineCommand: ${name || "?"} needs name, input and run`);
  const parse = (raw) => {
    const result = input.safeParse(raw ?? {});
    if (!result.success) throw new ValidationError(result.error.issues[0].message);
    return result.data;
  };
  return Object.freeze({ name, route, input, parse, run });
};

module.exports = { defineCommand };
