"use strict";

// Layer 2 of 3 for the assistant's read-only access (layer 1 is the SELECT-only
// Postgres role; layer 3 is LIMIT wrapping + statement_timeout). This validator
// is deliberately strict: it rejects some legitimate SQL (comments, EXPLAIN,
// keywords inside string literals) because false negatives are unacceptable and
// the model can always rephrase its query.

const BANNED = [
  "insert", "update", "delete", "merge", "drop", "alter", "create", "truncate",
  "grant", "revoke", "copy", "vacuum", "execute", "call", "do", "set", "reset",
  "lock", "comment", "refresh", "into", "listen", "notify", "prepare", "deallocate",
];

const ROW_LIMIT = 200;

const validateAndWrap = (sql) => {
  if (typeof sql !== "string" || !sql.trim()) {
    throw new Error("Query must be a non-empty string");
  }

  let cleaned = sql.trim();
  if (cleaned.endsWith(";")) cleaned = cleaned.slice(0, -1).trimEnd();

  if (cleaned.includes(";")) throw new Error("Multiple statements are not allowed");
  if (cleaned.includes("--") || cleaned.includes("/*")) {
    throw new Error("SQL comments are not allowed");
  }
  if (!/^(select|with)\b/i.test(cleaned)) {
    throw new Error("Only SELECT queries are allowed");
  }

  for (const word of BANNED) {
    if (new RegExp(`\\b${word}\\b`, "i").test(cleaned)) {
      throw new Error(`Keyword "${word}" is not allowed`);
    }
  }
  if (/\bfor\s+(update|no\s+key\s+update|share|key\s+share)\b/i.test(cleaned)) {
    throw new Error("Row locking is not allowed");
  }

  if (!/\blimit\b/i.test(cleaned)) {
    return `SELECT * FROM (${cleaned}) AS _assistant_sub LIMIT ${ROW_LIMIT}`;
  }
  return cleaned;
};

module.exports = { validateAndWrap, ROW_LIMIT };
