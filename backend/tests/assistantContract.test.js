"use strict";

const fs = require("fs");
const path = require("path");
const { ACTIONS } = require("../src/assistant/actionKit/registry");
const { loadGuides } = require("../src/assistant/guides");
const { COMMANDS } = require("../src/commands");
const { SCREEN_ONLY } = require("../src/assistant/screenOnly");
const { estimateTokens } = require("../src/assistant/tokens");
const { AREA_BUDGET } = require("../src/assistant/config");

/** Every POST/PUT/PATCH/DELETE the API serves, as "METHOD /path". */
const writeRoutes = () => {
  const index = fs.readFileSync(path.join(__dirname, "../src/routes/index.js"), "utf8");
  const files = Object.fromEntries([...index.matchAll(/const (\w+) = require\("\.\/(\w+)"\)/g)].map((m) => [m[1], m[2]]));
  const out = [];
  for (const [, prefix, name] of index.matchAll(/router\.use\("([^"]+)", (\w+)\)/g)) {
    if (!files[name]) continue;
    const router = require(path.join(__dirname, "../src/routes", files[name]));
    for (const layer of router.stack) {
      if (!layer.route) continue;
      for (const method of Object.keys(layer.route.methods)) {
        if (["post", "put", "patch", "delete"].includes(method)) out.push(`${method.toUpperCase()} ${prefix}${layer.route.path === "/" ? "" : layer.route.path}`);
      }
    }
  }
  return out;
};

describe("every action is complete", () => {
  const areas = new Set(loadGuides().map((g) => g.area));

  test("phase 1 is all there", () => {
    expect(ACTIONS.map((a) => a.name).sort()).toEqual(["create_customer", "create_order", "record_payment", "set_order_status"]);
  });

  test.each(ACTIONS.map((a) => [a.name, a]))("%s has a guide, a command, a trial-run decision and at least 3 evals", (_, a) => {
    expect(areas.has(a.area)).toBe(true);
    expect(COMMANDS).toContain(a.command);
    expect(typeof a.trialRunSafe).toBe("boolean");
    expect(a.evals.length).toBeGreaterThanOrEqual(3);
    for (const e of a.evals) expect(typeof e.ask === "string" && e.expect && typeof e.expect === "object").toBe(true);
    expect(a.declaration.parameters).toMatchObject({ type: "object" });
  });

  test.each(loadGuides().map((g) => [g.area, g]))("the %s area, opened, fits its budget", (area, g) => {
    const tools = ACTIONS.filter((a) => a.area === area).map((a) => a.declaration);
    expect(estimateTokens(g.body) + estimateTokens(JSON.stringify(tools))).toBeLessThanOrEqual(AREA_BUDGET);
  });

  test("an area with actions has keywords, so the switchboard can open it up front", () => {
    const guides = loadGuides();
    for (const area of new Set(ACTIONS.map((a) => a.area))) expect(guides.find((g) => g.area === area).keywords.length).toBeGreaterThan(0);
  });
});

describe("every write endpoint is accounted for", () => {
  const routes = writeRoutes();
  const viaSage = new Set(ACTIONS.map((a) => a.command.route));

  test("each is either behind a command Sage uses or listed as screen only, with a reason", () => {
    expect(routes.filter((r) => !viaSage.has(r) && !SCREEN_ONLY[r])).toEqual([]);
    for (const [route, reason] of Object.entries(SCREEN_ONLY)) expect([route, reason.length > 5]).toEqual([route, true]);
  });

  test("no route file mounts a sub-router (the walker above reads one level)", () => {
    const fsx = require("fs");
    const dir = path.join(__dirname, "../src/routes");
    for (const f of fsx.readdirSync(dir).filter((x) => x !== "index.js")) {
      const router = require(path.join(dir, f));
      expect([f, router.stack.filter((l) => !l.route && l.handle && l.handle.stack).length]).toEqual([f, 0]);
    }
  });

  test("the screen-only list has no stale or double entries", () => {
    expect(Object.keys(SCREEN_ONLY).filter((r) => !routes.includes(r))).toEqual([]);
    expect(Object.keys(SCREEN_ONLY).filter((r) => viaSage.has(r))).toEqual([]);
  });
});
