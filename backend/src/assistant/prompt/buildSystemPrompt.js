"use strict";

const fs = require("fs");
const path = require("path");
const { ASSISTANT_NAME } = require("../config");
const { guideIndex } = require("../guides");

const CORE = fs.readFileSync(path.join(__dirname, "core.md"), "utf8").trim();

/** The system prompt: core rules + one line per area + one line per action. */
const buildSystemPrompt = ({ today, actions = [] } = {}) =>
  CORE.replaceAll("{{name}}", ASSISTANT_NAME)
    .replace("{{today}}", today)
    .replace("{{guides}}", guideIndex())
    .replace("{{actions}}", actions.length ? actions.map((a) => `- ${a.area}: ${a.toolName} — ${a.summary}`).join("\n") : "- none yet");

module.exports = { buildSystemPrompt };
