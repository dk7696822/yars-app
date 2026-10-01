"use strict";

const { loadGuides } = require("./guides");

const MAX_OPEN = 3;
const wordsOf = (text) => new Set(String(text || "").toLowerCase().match(/[a-z0-9]+/g) || []);

/**
 * The switchboard's free first guess: the areas whose guide keywords appear in
 * the message, most hits first. A wrong guess costs nothing — Sage opens any
 * other area itself with open_area.
 */
const areasFor = (text, guides = loadGuides()) => {
  const said = wordsOf(text);
  return guides
    .map((g) => ({ area: g.area, hits: g.keywords.filter((k) => said.has(k)).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, MAX_OPEN)
    .map((x) => x.area);
};

module.exports = { areasFor };
