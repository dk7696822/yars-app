"use strict";

/**
 * Checks that a card uses what the person actually said. Free models sometimes
 * swap a name or a number; a card built from invented values is refused before
 * it is shown, and the model is told to use the person's words or ask.
 */
const numbersIn = (text) => (String(text || "").match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => Number(n.replace(/,/g, "")));
const saidNumber = (text, n) => numbersIn(text).some((x) => Math.abs(x - Number(n)) < 0.005);
const squash = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const mentions = (text, phrase) => squash(phrase).length > 0 && squash(text).includes(squash(phrase));

const notSaid = (value) => `${value} isn't something the person said — use their exact words and numbers, or ask them.`;

module.exports = { numbersIn, saidNumber, mentions, notSaid };
