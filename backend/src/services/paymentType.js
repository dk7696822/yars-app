"use strict";

/** Same rule as the payment sheet (frontend/src/utils/paymentType.js): the whole due is final, less is a part payment. */
const paymentTypeFor = (amount, due) => (Number(amount) >= Number(due) ? "FINAL" : "PARTIAL");

/** How much more than the due is being paid, exact to the paisa. */
const overpayment = (amount, due) => Math.max(0, Math.round(Number(amount) * 100) - Math.round(Number(due) * 100)) / 100;

module.exports = { paymentTypeFor, overpayment };
