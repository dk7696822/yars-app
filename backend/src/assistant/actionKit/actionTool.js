"use strict";

const { propose } = require("./actionService");

/** An action as a tool the model calls (on while its area is open): it reads one line, the app gets the card. */
const actionTool = (action) =>
  Object.freeze({
    name: action.toolName,
    area: action.area,
    description: action.description,
    input: action.input,
    declaration: action.declaration,
    run: async (args, ctx) => {
      const shown = await propose(action, args, ctx);
      return {
        text: `Card shown to the person: ${shown.card.title}. They must tap Confirm. Tell them in one line; do not say it is saved.`,
        action: shown,
      };
    },
  });

module.exports = { actionTool };
