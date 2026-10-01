"use strict";

const { loadGuides, parseGuide } = require("../src/assistant/guides");
const { areasFor } = require("../src/assistant/router");
const { buildSystemPrompt } = require("../src/assistant/prompt/buildSystemPrompt");
const { toolsFor } = require("../src/assistant/toolset");
const { estimateTokens } = require("../src/assistant/tokens");
const { CORE_BUDGET, GUIDE_BUDGET } = require("../src/assistant/config");

const guides = loadGuides();

describe("guides", () => {
  test("every guide names an area and a summary, and areas are unique", () => {
    expect(guides.length).toBeGreaterThanOrEqual(10);
    for (const g of guides) expect([g.area, g.summary].every(Boolean)).toBe(true);
    expect(new Set(guides.map((g) => g.area)).size).toBe(guides.length);
  });

  test.each(guides.map((g) => [g.file, g]))("%s fits the guide budget", (_, g) => {
    expect(estimateTokens(g.body)).toBeLessThanOrEqual(GUIDE_BUDGET);
  });

  test("links are app paths only", () => {
    for (const g of guides) for (const m of g.body.matchAll(/\]\(([^)]+)\)/g)) expect(m[1].startsWith("/")).toBe(true);
  });

  test("nothing mentions the old name or Hindi", () => {
    for (const g of guides) expect(g.body).not.toMatch(/jarvis|hindi|hinglish/i);
  });

  test("each tested SQL block is in exactly one guide", () => {
    for (const name of ["pending", "volume"]) expect(guides.filter((g) => g.body.includes(`<!-- canonical:${name} -->`))).toHaveLength(1);
  });

  test("a guide without front matter is refused", () => {
    expect(() => parseGuide("x.md", "# Title\nbody")).toThrow(/front matter/);
  });

  test("keywords are single lower-case words", () => {
    for (const g of guides) for (const k of g.keywords) expect(k).toMatch(/^[a-z0-9]+$/);
  });
});

describe("switchboard first guess", () => {
  test.each([
    ["Bombay Saree Centre paid 5000 by UPI", "payments"],
    ["new order for Laxmi Stores, 20 kg", "orders"],
    ["add a customer Ganesh Textiles", "customers"],
    ["how much did we spend on expenses this month", "expenses"],
  ])("%s → %s", (text, area) => expect(areasFor(text)).toContain(area));

  test("nothing matched opens nothing, and never more than 3", () => {
    expect(areasFor("hello there")).toEqual([]);
    expect(areasFor("order payment customer expense stock invoice supplier").length).toBeLessThanOrEqual(3);
  });
});

describe("prompt budget", () => {
  test("core instructions plus the always-on tools fit the budget", () => {
    const system = buildSystemPrompt({ today: "2026-10-01" });
    const tools = JSON.stringify(toolsFor(new Set()).map((t) => t.declaration));
    expect(estimateTokens(system) + estimateTokens(tools)).toBeLessThanOrEqual(CORE_BUDGET);
  });

  test("the prompt carries the name, today's date and every guide", () => {
    const system = buildSystemPrompt({ today: "2026-10-01" });
    expect(system).toContain("Today is 2026-10-01");
    for (const g of guides) expect(system).toContain(`- ${g.area}: ${g.summary}`);
    expect(system).not.toMatch(/\{\{/);
  });
});
