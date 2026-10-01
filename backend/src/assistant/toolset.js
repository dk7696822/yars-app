"use strict";

const { READ_TOOLS } = require("./tools");

/** Every tool. Action tools join in the action kit. */
const allTools = () => [...READ_TOOLS];

/**
 * The switchboard: a tool without an area is always on; an area's tools are on
 * only while that area is open. What one round sends stays small however many
 * features the app grows.
 */
const toolsFor = (open, tools = allTools()) => tools.filter((t) => !t.area || open.has(t.area));

module.exports = { allTools, toolsFor };
