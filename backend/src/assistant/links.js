"use strict";

const { loadGuides } = require("./guides");

/** Every app path the guides name in backticks, like `/orders/:id`. */
const pathsIn = (guides) => [...new Set(guides.flatMap((g) => [...g.body.matchAll(/`(\/[^`\s]*)`/g)].map((m) => m[1].split("?")[0])))];
const toPattern = (path) => new RegExp(`^${path.replace(/:[a-zA-Z]+/g, "[^/]+").replace(/\//g, "\\/")}$`);

/**
 * A check for replies: every markdown link must be a real app screen (a path
 * the guides name). A made-up link would send the person to "page not found".
 */
const linksAreKnown = (guides = loadGuides()) => {
  const patterns = pathsIn(guides).map(toPattern);
  return (text) => [...String(text).matchAll(/\]\((\/[^)\s]*)\)/g)].every((m) => patterns.some((p) => p.test(m[1].split("?")[0])));
};

module.exports = { linksAreKnown };
