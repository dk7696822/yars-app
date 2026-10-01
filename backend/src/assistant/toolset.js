"use strict";

const { READ_TOOLS } = require("./tools");
const { ACTIONS } = require("./actionKit/registry");
const { actionTool } = require("./actionKit/actionTool");

/** Every tool: read tools (always on), then one propose_ tool per action (on with its area). */
const allTools = () => [...READ_TOOLS, ...ACTIONS.map(actionTool)];

/**
 * The switchboard: a tool without an area is always on; an area's tools are on
 * only while that area is open. What one round sends stays small however many
 * features the app grows.
 */
const toolsFor = (open, tools = allTools()) => tools.filter((t) => !t.area || open.has(t.area));

module.exports = { allTools, toolsFor };
