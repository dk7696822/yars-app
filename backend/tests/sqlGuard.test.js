"use strict";

const { validateAndWrap } = require("../src/services/assistant/sqlGuard");

describe("sqlGuard.validateAndWrap", () => {
  // --- allowed ---
  test.each([
    ["plain select", "SELECT * FROM customers"],
    ["lowercase", "select name from suppliers where is_archived = false"],
    ["CTE", "WITH t AS (SELECT * FROM orders) SELECT count(*) FROM t"],
    ["trailing semicolon", "SELECT 1;"],
    ["leading whitespace/newlines", "  \n SELECT 1"],
  ])("allows %s", (_name, sql) => {
    expect(() => validateAndWrap(sql)).not.toThrow();
  });

  test("wraps with LIMIT 200 when no limit present", () => {
    expect(validateAndWrap("SELECT * FROM customers")).toBe(
      "SELECT * FROM (SELECT * FROM customers) AS _assistant_sub LIMIT 200"
    );
  });

  test("does not wrap when a LIMIT exists", () => {
    expect(validateAndWrap("SELECT * FROM customers LIMIT 5")).toBe("SELECT * FROM customers LIMIT 5");
  });

  // --- rejected ---
  test.each([
    ["INSERT", "INSERT INTO customers (name) VALUES ('x')"],
    ["UPDATE", "UPDATE customers SET name = 'x'"],
    ["DELETE", "DELETE FROM customers"],
    ["DROP", "DROP TABLE customers"],
    ["TRUNCATE", "TRUNCATE customers"],
    ["ALTER", "ALTER TABLE customers ADD COLUMN x int"],
    ["CREATE", "CREATE TABLE t (id int)"],
    ["GRANT", "GRANT ALL ON customers TO public"],
    ["multi-statement", "SELECT 1; SELECT 2"],
    ["piggyback write", "SELECT 1; DELETE FROM customers"],
    ["SELECT INTO", "SELECT * INTO new_table FROM customers"],
    ["FOR UPDATE lock", "SELECT * FROM customers FOR UPDATE"],
    ["line comment smuggling", "SELECT 1 -- ; DELETE FROM customers"],
    ["block comment smuggling", "SELECT /* x */ 1"],
    ["COPY", "COPY customers TO '/tmp/x'"],
    ["SET", "SET role postgres"],
    ["DO block", "DO $$ BEGIN NULL; END $$"],
    ["empty", ""],
    ["not a select", "EXPLAIN ANALYZE SELECT 1"],
  ])("rejects %s", (_name, sql) => {
    expect(() => validateAndWrap(sql)).toThrow();
  });
});
