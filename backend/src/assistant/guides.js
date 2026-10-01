"use strict";

const fs = require("fs");
const path = require("path");

const KNOWLEDGE_DIR = path.join(__dirname, "../../knowledge");

/**
 * An area of the app is a markdown guide with front matter:
 *   ---
 *   area: payments
 *   summary: Recording, editing and refunding payments.
 *   keywords: paid, payment, refund, upi
 *   tables: payments
 *   ---
 * The core prompt lists every area's summary; open_area returns the body and
 * switches on the area's propose_ tools; keywords let the switchboard open it
 * up front when a message uses them.
 */
const parseGuide = (file, text) => {
  const m = String(text).match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing front matter (--- area / summary ---)`);
  const meta = Object.fromEntries(
    m[1].split("\n").map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2].trim()])
  );
  if (!meta.area || !meta.summary) throw new Error(`${file}: front matter needs area and summary`);
  return {
    file,
    area: meta.area,
    summary: meta.summary,
    keywords: meta.keywords ? meta.keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean) : [],
    tables: meta.tables ? meta.tables.split(",").map((t) => t.trim()).filter(Boolean) : [],
    body: m[2].trim(),
  };
};

let cache = null;
const loadGuides = (dir = KNOWLEDGE_DIR) => {
  if (cache && cache.dir === dir) return cache.guides;
  const guides = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()
    .map((f) => parseGuide(f, fs.readFileSync(path.join(dir, f), "utf8")));
  cache = { dir, guides };
  return guides;
};

const guideIndex = (guides = loadGuides()) => guides.map((g) => `- ${g.area}: ${g.summary}`).join("\n");

module.exports = { parseGuide, loadGuides, guideIndex, KNOWLEDGE_DIR };
