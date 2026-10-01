"use strict";

const { AssistantConversation, AssistantMessage } = require("../models");
const { success, error } = require("../utils/response");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
const { runAssistant } = require("../assistant");
const { formatWait } = require("../assistant/chain");
const { ASSISTANT_NAME } = require("../assistant/config");

const listConversations = async (req, res) => {
  try {
    const pagination = getPagination(req.query);
    const { rows, count } = await AssistantConversation.findAndCountAll({
      where: { is_archived: false },
      order: [["updated_at", "DESC"]],
      limit: pagination.limit,
      offset: pagination.offset,
    });
    return success(res, 200, "Conversations", buildPaginatedResponse(rows, count, pagination));
  } catch (err) {
    console.error(err);
    return error(res, 500, "Failed to list conversations");
  }
};

const createConversation = async (req, res) => {
  try {
    const conv = await AssistantConversation.create({});
    return success(res, 201, "Conversation created", conv);
  } catch (err) {
    console.error(err);
    return error(res, 500, "Failed to create conversation");
  }
};

const getConversation = async (req, res) => {
  try {
    const conv = await AssistantConversation.findOne({
      where: { id: req.params.id, is_archived: false },
      include: [{ model: AssistantMessage, as: "messages" }],
      order: [[{ model: AssistantMessage, as: "messages" }, "created_at", "ASC"]],
    });
    if (!conv) return error(res, 404, "Conversation not found");
    return success(res, 200, "Conversation", conv);
  } catch (err) {
    console.error(err);
    return error(res, 500, "Failed to load conversation");
  }
};

const deleteConversation = async (req, res) => {
  try {
    const conv = await AssistantConversation.findByPk(req.params.id);
    if (!conv || conv.is_archived) return error(res, 404, "Conversation not found");
    await conv.update({ is_archived: true });
    return success(res, 200, "Conversation deleted");
  } catch (err) {
    console.error(err);
    return error(res, 500, "Failed to delete conversation");
  }
};

// ---- SSE ----

const sendEvent = (res, event, data) => {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

const sendMessage = async (req, res) => {
  const { id } = req.params;
  const text = (req.body?.text || "").trim();

  try {
    if (!text) return error(res, 400, "Message text is required");
    const conv = await AssistantConversation.findOne({ where: { id, is_archived: false } });
    if (!conv) return error(res, 404, "Conversation not found");

    // Persist the user message before doing anything fallible.
    await AssistantMessage.create({ conversation_id: id, role: "user", content: text });
    const isFirst = (await AssistantMessage.count({ where: { conversation_id: id } })) === 1;

    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    const history = (
      await AssistantMessage.findAll({ where: { conversation_id: id }, order: [["created_at", "ASC"]] })
    ).map((m) => ({ role: m.role, content: m.content }));

    let finalText;
    try {
      finalText = await runAssistant(
        history,
        {
          onDelta: (t) => sendEvent(res, "delta", { text: t }),
          onStatus: (t) => sendEvent(res, "status", { text: t }),
        },
        { conversationId: id, userId: req.user?.sub || null, requestText: text }
      );
    } catch (err) {
      console.error("assistant failed:", err);
      const message =
        err.name === "QuotaExhaustedError"
          ? `${ASSISTANT_NAME}'s free daily limit is used up for now. Please try again in about ${formatWait(err.retryAfterSeconds)}.`
          : `${ASSISTANT_NAME} is busy right now — try again in a minute.`;
      sendEvent(res, "error", { message });
      return res.end();
    }

    const saved = await AssistantMessage.create({ conversation_id: id, role: "assistant", content: finalText });

    let title;
    if (isFirst) {
      title = text.length > 60 ? `${text.slice(0, 57)}…` : text;
      await conv.update({ title });
    } else {
      conv.changed("updated_at", true);
      await conv.update({ updated_at: new Date() }); // bump ordering
    }

    sendEvent(res, "done", { messageId: saved.id, conversationId: id, ...(title ? { title } : {}) });
    return res.end();
  } catch (err) {
    console.error("sendMessage failed:", err);
    if (!res.headersSent) return error(res, 500, "Failed to send message");
    sendEvent(res, "error", { message: "Something went wrong." });
    return res.end();
  }
};

module.exports = { listConversations, createConversation, getConversation, deleteConversation, sendMessage };
