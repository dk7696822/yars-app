"use strict";

/**
 * "Is this shop already a customer?" — a warning, never a block.
 * Similar = same name ignoring case/spaces/punctuation (100), one name inside
 * the other (50), or sharing a distinctive word of 4+ letters (10 each).
 * Trade words every shop uses don't count as distinctive.
 */
const COMMON = new Set([
  "sri", "shri", "shree", "enterprises", "enterprise", "traders", "trading", "textiles", "textile", "garments",
  "stores", "store", "centre", "center", "sarees", "saree", "packaging", "packers", "industries", "general",
  "agency", "agencies", "bags", "company", "brothers", "sons", "mart", "shop", "house", "emporium",
]);
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const words = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
const squash = (s) => words(s).join("");
const distinctive = (s) => words(s).filter((w) => w.length >= 4 && !COMMON.has(w));

const score = (a, b) => {
  const A = squash(a);
  const B = squash(b);
  if (A.length < 3 || B.length < 3) return 0;
  if (A === B) return 100;
  if (A.includes(B) || B.includes(A)) return 50;
  const other = new Set(distinctive(b));
  return distinctive(a).filter((w) => other.has(w)).length * 10;
};

const findSimilar = (name, customers, excludeId, limit = 5) =>
  customers
    .filter((c) => c.id !== excludeId)
    .map((c) => ({ c, s: score(name, c.name) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s || collator.compare(x.c.name, y.c.name))
    .slice(0, limit)
    .map((x) => x.c);

module.exports = { findSimilar };
