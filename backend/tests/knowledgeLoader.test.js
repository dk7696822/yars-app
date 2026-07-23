"use strict";

const { loadKnowledge } = require("../src/services/assistant/knowledgeLoader");

describe("knowledgeLoader", () => {
  test("concatenates all knowledge files with filename headers", () => {
    const text = loadKnowledge();
    expect(text).toContain("Assistant instructions"); // from 00-instructions.md
    expect(text).toContain("<!-- knowledge: routes.md -->");
    expect(text.length).toBeGreaterThan(1000);
  });

  test("caches: second call returns the same string instance", () => {
    expect(loadKnowledge()).toBe(loadKnowledge());
  });
});
