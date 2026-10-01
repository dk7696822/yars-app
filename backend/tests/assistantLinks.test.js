"use strict";

const { linksAreKnown } = require("../src/assistant/links");

describe("links in a reply must be real app screens", () => {
  const ok = linksAreKnown();

  test.each([
    ["[Orders](/orders)", true],
    ["[Open the order](/orders/8f1c2d3e-0000-4000-8000-000000000001)", true],
    ["[Dues](/dues?age=90+)", true],
    ["[Dashboard](/)", true],
    ["no links at all", true],
    ["[Payments](/payments)", false],
    ["[Orders](/orders) and [Reports](/reports)", false],
  ])("%s → %s", (text, expected) => expect(ok(text)).toBe(expected));
});
