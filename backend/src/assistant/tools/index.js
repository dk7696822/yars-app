"use strict";

/** Tools that only read. Typed tools first: their figures match the screens. */
const READ_TOOLS = [
  require("./dues"),
  require("./customerSummary"),
  require("./periodSummary"),
  require("./find"),
  require("./openArea"),
  require("./runQuery"),
];

module.exports = { READ_TOOLS };
