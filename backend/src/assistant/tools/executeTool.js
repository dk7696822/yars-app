"use strict";

const { parseArgs } = require("./defineTool");
const { TOOL_RESULT_CHARS } = require("../config");

const cap = (text) => (text.length > TOOL_RESULT_CHARS ? `${text.slice(0, TOOL_RESULT_CHARS)} …[cut]` : text);
const errorText = (message) => JSON.stringify({ error: message });

/**
 * Run one tool call from the model. Never throws: problems come back as
 * {"error": …} so the model can fix its call or ask the person.
 * Resolves to { text, action? } — action is a card for the app.
 */
const executeTool = async (tools, call, ctx) => {
  const tool = tools.find((t) => t.name === call.name);
  if (!tool) return { text: errorText(`There is no tool called ${call.name}`) };
  try {
    const out = await tool.run(parseArgs(tool.input, call.args), ctx);
    return typeof out === "string" ? { text: cap(out) } : { ...out, text: cap(out.text) };
  } catch (err) {
    if (!err.expected) console.error(`assistant tool ${call.name} failed:`, err);
    else if (process.env.ASSISTANT_DEBUG) console.warn(`assistant tool ${call.name} said:`, err.message);
    return { text: errorText(err.message) };
  }
};

module.exports = { executeTool };
