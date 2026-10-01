"use strict";

const { toParameters } = require("../tools/defineTool");

const REQUIRED = ["name", "area", "summary", "description", "input", "resolve", "preview", "command", "toCommandInput", "resultLink", "formLink", "evals"];

/**
 * One thing Sage can propose. The file is the whole feature: what the model
 * may send (input), how ids become records (resolve), what the card shows
 * (preview), which command saves it, and the requests it must handle (evals).
 * trialRunSafe: true only when the command has no effect outside the database
 * transaction (no files, no external calls, no counters that don't roll back).
 */
const defineAction = (def) => {
  for (const key of REQUIRED) if (def[key] === undefined) throw new Error(`Action ${def.name || "?"}: missing ${key}`);
  if (!/^[a-z_]+$/.test(def.name)) throw new Error(`Action ${def.name}: name must be lower_snake_case`);
  if (typeof def.trialRunSafe !== "boolean") throw new Error(`Action ${def.name}: say trialRunSafe: true or false`);
  const toolName = `propose_${def.name}`;
  return Object.freeze({
    fingerprint: null,
    context: null,
    ...def,
    toolName,
    declaration: { name: toolName, description: def.description, parameters: toParameters(def.input) },
  });
};

module.exports = { defineAction };
