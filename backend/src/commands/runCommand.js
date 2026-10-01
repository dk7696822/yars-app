"use strict";

const { sequelize } = require("../models");

const APP = Object.freeze({ source: "app" });

/**
 * Check the input, then run. Inside the caller's `transaction` when one is
 * given (the caller commits or rolls back); otherwise in a new transaction
 * that commits on success and rolls back on any error.
 */
const runCommand = async (command, raw, { actor = APP, transaction } = {}) => {
  const input = command.parse(raw);
  if (transaction) return command.run(input, { transaction, actor });
  return sequelize.transaction((t) => command.run(input, { transaction: t, actor }));
};

module.exports = { runCommand };
