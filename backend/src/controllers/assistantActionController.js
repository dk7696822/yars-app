"use strict";

const { success, error } = require("../utils/response");
const { CommandError } = require("../commands/errors");
const service = require("../assistant/actionKit/actionService");
const { registry } = require("../assistant/actionKit/registry");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const handle = (fn, failMessage) => async (req, res) => {
  if (!UUID.test(req.params.id)) return error(res, 404, "This card no longer exists");
  try {
    return success(res, 200, "Card", await fn(req));
  } catch (err) {
    if (err instanceof CommandError) return error(res, err.status, err.message);
    console.error(`${failMessage}:`, err);
    return error(res, 500, failMessage);
  }
};

const getAction = handle((req) => service.formData(req.params.id), "Couldn't load this card");
const confirmAction = handle((req) => service.confirm(registry, req.params.id, { userId: req.user?.sub || null }), "Couldn't save this — try again");
const cancelAction = handle((req) => service.cancel(req.params.id), "Couldn't cancel this card");
const completedInForm = handle(
  (req) => service.completedInForm(req.params.id, { resultId: UUID.test(req.body?.result_id || "") ? req.body.result_id : null, saved: req.body?.saved || {} }),
  "Couldn't record that"
);

module.exports = { getAction, confirmAction, cancelAction, completedInForm };
