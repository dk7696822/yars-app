"use strict";

/** Every command. Each new save is added here; the coverage guard reads this list. */
const COMMANDS = [
  require("./payments/createPayment"),
  require("./customers/createCustomer"),
  require("./orders/createOrder"),
  require("./orders/updateOrder"),
];

module.exports = { COMMANDS };
