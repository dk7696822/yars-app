"use strict";

const { Pool } = require("pg");
const { validateAndWrap } = require("./sqlGuard");

// Separate pool for the assistant, using the SELECT-only role in production
// (ASSISTANT_DB_URL). Never reuse the app's main connection here.
const MAX_RESULT_CHARS = 8000;

let pool = null;

const getPool = () => {
  if (!pool) {
    if (!process.env.ASSISTANT_DB_URL) {
      throw new Error("ASSISTANT_DB_URL is not set");
    }
    pool = new Pool({
      connectionString: process.env.ASSISTANT_DB_URL,
      max: 2,
      statement_timeout: 5000,
      ssl:
        process.env.NODE_ENV === "production"
          ? { require: true, rejectUnauthorized: false }
          : false,
    });
  }
  return pool;
};

const runQuery = async (sql) => {
  const safeSql = validateAndWrap(sql); // throws on anything non-SELECT
  const result = await getPool().query(safeSql);
  const payload = JSON.stringify({ rowCount: result.rowCount, rows: result.rows });
  if (payload.length > MAX_RESULT_CHARS) {
    return payload.slice(0, MAX_RESULT_CHARS) + " …[truncated]";
  }
  return payload;
};

const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

module.exports = { runQuery, closePool, MAX_RESULT_CHARS };
