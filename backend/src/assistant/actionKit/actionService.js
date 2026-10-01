"use strict";

const { isDeepStrictEqual } = require("util");
const { v4: uuidv4 } = require("uuid");
const db = require("../../models");
const { runCommand } = require("../../commands/runCommand");
const { CommandError, NotFoundError } = require("../../commands/errors");
const { todayIST } = require("../../services/dashboard/dateRanges");
const { parseArgs } = require("../tools/defineTool");
const { ACTION_TTL_MINUTES, ASSISTANT_NAME } = require("../config");
const { ActionError } = require("./errors");

const effectiveStatus = (row, now = new Date()) => (row.status === "pending" && new Date(row.expires_at) <= now ? "expired" : row.status);

/** What the app shows for one card. */
const present = (row) => ({
  id: row.id,
  name: row.name,
  status: effectiveStatus(row),
  card: row.card,
  error: row.error || null,
  resultLink: row.result_link || null,
  formLink: row.form_link || null,
  expiresAt: row.expires_at,
  messageId: row.message_id || null,
});

/** Numbers and numeric text compare equal ("5000.00" = 5000); empty = missing. */
const canon = (v) => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return /^-?\d+(\.\d+)?$/.test(v.trim()) ? String(Number(v)) : v.trim();
  if (Array.isArray(v)) return v.map(canon);
  if (typeof v === "object") {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]).filter(([, x]) => x !== null));
  }
  return v;
};
const changedKeys = (before = {}, after = {}) =>
  [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
    .filter((k) => !isDeepStrictEqual(canon(before?.[k]), canon(after?.[k])))
    .sort();

/** The real save in a transaction that is always rolled back; the card reads the after-figures inside it. */
const trialRun = async (action, resolved, input) => {
  if (!action.trialRunSafe) return action.preview(resolved, { transaction: null, result: null, models: db });
  const t = await db.sequelize.transaction();
  try {
    const result = await runCommand(action.command, input, { transaction: t, actor: { source: "assistant", trial: true } });
    return await action.preview(resolved, { transaction: t, result, models: db });
  } catch (err) {
    if (err instanceof CommandError) throw new ActionError(`The app would refuse this: ${err.message}`);
    throw err;
  } finally {
    await t.rollback();
  }
};

const propose = async (action, rawArgs, { conversationId, userId = null, requestText = null, userText = null } = {}) => {
  const args = parseArgs(action.input, rawArgs);
  const resolved = await action.resolve(args, { models: db, today: todayIST() });
  // The card may only use what the person said (checked whenever their words are known).
  if (action.grounded && userText) {
    const problem = action.grounded(args, { userText, resolved });
    if (problem) throw new ActionError(problem);
  }
  const payload = action.toCommandInput(resolved);
  const card = await trialRun(action, resolved, payload);
  const id = uuidv4();
  const row = await db.AssistantAction.create({
    id,
    conversation_id: conversationId,
    user_id: userId,
    name: action.name,
    request_text: requestText,
    payload,
    context: action.context ? action.context(resolved) : null,
    card,
    fingerprint: action.fingerprint ? await action.fingerprint(payload, { models: db }) : null,
    status: "pending",
    form_link: action.formLink(payload, id),
    expires_at: new Date(Date.now() + ACTION_TTL_MINUTES * 60 * 1000),
  });
  return present(row);
};

const locked = async (id, t) => {
  const row = await db.AssistantAction.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
  if (!row) throw new NotFoundError("This card no longer exists");
  return row;
};

/**
 * Save what the card shows. The row is locked, so two taps (or two phones)
 * save once. Refuses when expired, when what it was based on changed, or when
 * the app refuses; nothing half-saves.
 */
const confirm = (registry, id, { userId = null } = {}) =>
  db.sequelize.transaction(async (t) => {
    const row = await locked(id, t);
    const status = effectiveStatus(row);
    if (status === "expired" && row.status === "pending") {
      await row.update({ status: "expired" }, { transaction: t });
      return present(row);
    }
    if (status !== "pending") return present(row);

    const action = registry.get(row.name);
    if (!action) {
      await row.update({ status: "failed", error: `${ASSISTANT_NAME} can't do this any more — use the screen.` }, { transaction: t });
      return present(row);
    }
    if (action.fingerprint) {
      const now = await action.fingerprint(row.payload, { models: db, transaction: t });
      if (!isDeepStrictEqual(now, row.fingerprint)) {
        await row.update({ status: "failed", error: action.staleMessage || `This changed after ${ASSISTANT_NAME} suggested it — ask again.` }, { transaction: t });
        return present(row);
      }
    }

    try {
      // A savepoint: if the save fails, the card can still be marked failed.
      const result = await db.sequelize.transaction({ transaction: t }, (sp) =>
        runCommand(action.command, row.payload, { transaction: sp, actor: { source: "assistant", userId, actionId: row.id } })
      );
      await row.update(
        { status: "confirmed", result_id: result.id, result_link: action.resultLink(result, row.payload), confirmed_at: new Date(), outcome: { confirmed: true } },
        { transaction: t }
      );
    } catch (err) {
      if (!(err instanceof CommandError)) throw err;
      await row.update({ status: "failed", error: err.message }, { transaction: t });
    }
    return present(row);
  });

const cancel = (id) =>
  db.sequelize.transaction(async (t) => {
    const row = await locked(id, t);
    if (effectiveStatus(row) === "pending") await row.update({ status: "cancelled", outcome: { cancelled: true } }, { transaction: t });
    return present(row);
  });

/** "Open in form" finished: record what the person changed (the learning report reads it). */
const completedInForm = (id, { resultId = null, saved = {} } = {}) =>
  db.sequelize.transaction(async (t) => {
    const row = await locked(id, t);
    if (["pending", "expired"].includes(effectiveStatus(row))) {
      await row.update({ status: "completed_in_form", result_id: resultId, outcome: { changed: changedKeys(row.payload, saved) } }, { transaction: t });
    }
    return present(row);
  });

const formData = async (id) => {
  const row = await db.AssistantAction.findByPk(id);
  if (!row) throw new NotFoundError("This card no longer exists");
  return { ...present(row), payload: row.payload, context: row.context };
};

module.exports = { propose, confirm, cancel, completedInForm, formData, present, effectiveStatus, changedKeys };
