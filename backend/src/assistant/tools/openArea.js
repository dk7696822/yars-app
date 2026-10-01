"use strict";

const { z } = require("zod");
const { defineTool } = require("./defineTool");
const { loadGuides } = require("../guides");

const guides = loadGuides();

module.exports = defineTool({
  name: "open_area",
  description: "Open one area of the app: returns its guide (screens, labels, links, tables) and switches on its propose_ tools. Open it before run_query or proposing there.",
  input: z.object({ area: z.enum(guides.map((g) => g.area)) }),
  run: ({ area }) => ({ text: guides.find((g) => g.area === area).body, openArea: area }),
});
