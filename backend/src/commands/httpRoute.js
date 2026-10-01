"use strict";

const { success, error } = require("../utils/response");
const { CommandError } = require("./errors");
const { runCommand } = require("./runCommand");

/**
 * An Express handler for a command. `toInput(req)` builds the command input
 * (default: the body); `respond(result, req)` returns { status, message, data },
 * the same body the route sent before commands existed.
 */
const httpRoute = (command, { toInput = (req) => req.body, respond, failMessage }) => async (req, res) => {
  try {
    const actor = { source: "app", userId: req.user?.sub || null };
    const result = await runCommand(command, toInput(req), { actor });
    const { status, message, data } = await respond(result, req);
    return success(res, status, message, data);
  } catch (err) {
    if (err instanceof CommandError) return error(res, err.status, err.message);
    console.error(`${command.name} failed:`, err);
    return error(res, 500, failMessage, err.message);
  }
};

module.exports = { httpRoute };
