"use strict";

const { runQuery, closePool } = require("../src/assistant/db/assistantDb");
const db = require("../src/models");

afterAll(async () => {
  await closePool();
});

describe("assistantDb.runQuery", () => {
  test("executes a valid SELECT and returns rows as JSON string", async () => {
    await db.Supplier.create({ name: "Test Supplier" });
    const out = await runQuery("SELECT name FROM suppliers");
    const parsed = JSON.parse(out);
    expect(parsed.rows).toEqual([{ name: "Test Supplier" }]);
    expect(parsed.rowCount).toBe(1);
  });

  test("rejects a write (guard throws before reaching the DB)", async () => {
    await expect(runQuery("DELETE FROM suppliers")).rejects.toThrow(/only select/i);
  });

  test("truncates oversized results", async () => {
    const out = await runQuery("SELECT repeat('x', 500) AS blob FROM generate_series(1, 100)");
    expect(out.length).toBeLessThanOrEqual(8100);
    expect(out).toMatch(/truncated/i);
  });
});
