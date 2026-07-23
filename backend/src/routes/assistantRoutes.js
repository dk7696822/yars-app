"use strict";

const express = require("express");
const router = express.Router();
const c = require("../controllers/assistantController");

router.get("/conversations", c.listConversations);
router.post("/conversations", c.createConversation);
router.get("/conversations/:id", c.getConversation);
router.delete("/conversations/:id", c.deleteConversation);
router.post("/conversations/:id/messages", c.sendMessage);

module.exports = router;
