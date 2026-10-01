"use strict";

/** A refusal the person can act on. `status` is the HTTP status the screens get. */
class CommandError extends Error {
  constructor(message, status) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}

class ValidationError extends CommandError {
  constructor(message) {
    super(message, 400);
  }
}

class NotFoundError extends CommandError {
  constructor(message) {
    super(message, 404);
  }
}

module.exports = { CommandError, ValidationError, NotFoundError };
