"use strict";

const fs = require("fs");
const path = require("path");

const ACTIONS_DIR = path.join(__dirname, "../actions");

/** Every file in src/assistant/actions is an action. Adding a file adds the action. */
const loadActions = (dir = ACTIONS_DIR) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort().map((f) => require(path.join(dir, f))) : [];

const ACTIONS = loadActions();
const registry = new Map(ACTIONS.map((a) => [a.name, a]));

module.exports = { ACTIONS, registry, loadActions };
