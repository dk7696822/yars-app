"use strict";

const fs = require("fs");
const path = require("path");

const KNOWLEDGE_DIR = path.join(__dirname, "../../../knowledge");

let cache = null;
let cacheKey = null;

// Concatenate knowledge/*.md (sorted, so 00-instructions.md leads) into one
// system-prompt string. Re-reads only when any file's mtime changes.
const loadKnowledge = () => {
  const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".md")).sort();
  const key = files
    .map((f) => `${f}:${fs.statSync(path.join(KNOWLEDGE_DIR, f)).mtimeMs}`)
    .join("|");

  if (cache !== null && key === cacheKey) return cache;

  cache = files
    .map((f) => `<!-- knowledge: ${f} -->\n${fs.readFileSync(path.join(KNOWLEDGE_DIR, f), "utf8")}`)
    .join("\n\n");
  cacheKey = key;
  return cache;
};

module.exports = { loadKnowledge };
