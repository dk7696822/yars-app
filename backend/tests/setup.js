"use strict";

const db = require("../src/models");

// Tables are truncated in dependency order (children first) before each test.
const TABLES = [
  "stock_movements",
  "stock_issue_items",
  "stock_issues",
  "stock_batches",
  "goods_receipt_items",
  "goods_receipts",
  "purchase_order_items",
  "purchase_orders",
  "inventory_items",
  "inventory_categories",
  "suppliers",
];

beforeEach(async () => {
  await db.sequelize.query(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`
  );
});

afterAll(async () => {
  await db.sequelize.close();
});
