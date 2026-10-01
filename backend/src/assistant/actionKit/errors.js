"use strict";

/** Told to the model, which asks the person (e.g. "two customers match — which one?"). */
class ActionError extends Error {
  constructor(message) {
    super(message);
    this.expected = true;
  }
}

module.exports = { ActionError };
