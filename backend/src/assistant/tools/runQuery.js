"use strict";

const { z } = require("zod");
const { defineTool } = require("./defineTool");
const { runQuery } = require("../db/assistantDb");

module.exports = defineTool({
  name: "run_query",
  description: "Fallback for questions the other tools don't answer: one read-only SELECT (or WITH … SELECT). Read the area's guide first. At most 200 rows.",
  input: z.object({ sql: z.string().min(1) }),
  run: async ({ sql }) => {
    try {
      return await runQuery(sql);
    } catch (err) {
      return JSON.stringify({ error: err.message }); // a bad query is normal: the model fixes it
    }
  },
});
