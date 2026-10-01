"use strict";

const express = require("express");
const router = express.Router();
const c = require("../controllers/assistantController");

router.get("/conversations", c.listConversations);
router.post("/conversations", c.createConversation);
router.get("/conversations/:id", c.getConversation);
router.delete("/conversations/:id", c.deleteConversation);
router.post("/conversations/:id/messages", c.sendMessage);

const a = require("../controllers/assistantActionController");

router.get("/actions/:id", a.getAction);
router.post("/actions/:id/confirm", a.confirmAction);
router.post("/actions/:id/cancel", a.cancelAction);
router.post("/actions/:id/completed-in-form", a.completedInForm);

module.exports = router;
