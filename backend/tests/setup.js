"use strict";

const db = require("../src/models");

const ALLOWED_HOSTS = ["localhost", "127.0.0.1"];

// Safety guard. The development/test/production blocks in src/config/database.js all read
// the SAME DB_* env vars, so which database we actually connect to depends entirely on
// which .env file dotenv loaded — and dotenv does not override vars already present in
// process.env. That makes it possible to aim the TRUNCATE below at production:
//   * `npx jest` (rather than `npm test`) leaves NODE_ENV unset, so the real .env loads;
//   * ambient/exported DB_* vars survive even an otherwise-correct NODE_ENV=test run.
// So we do not trust the environment — we interrogate the live connection and refuse to
// touch anything that is not demonstrably the local throwaway database.
beforeAll(() => {
  const { host, database } = db.sequelize.config;

  if (
    process.env.NODE_ENV !== "test" ||
    !ALLOWED_HOSTS.includes(host) ||
    typeof database !== "string" ||
    !database.endsWith("_test")
  ) {
    throw new Error(
      `Refusing to run tests against ${host}/${database} — this is not the throwaway test database. ` +
        `Expected NODE_ENV=test and a *_test database on localhost. Run tests with "npm test".`
    );
  }
});

// Emptied before each test so cases cannot leak state into one another.
// NOTE: TRUNCATE ... CASCADE does not respect the order listed below — it cascades to
// every table holding a foreign key into these, including future tables nobody added
// here. The blast radius therefore grows implicitly as the schema evolves, which is
// exactly why the beforeAll guard above must stay.
const TABLES = [
  "assistant_messages",
  "assistant_conversations",
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
  "users",
];

beforeEach(async () => {
  await db.sequelize.query(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`
  );
});

afterAll(async () => {
  await db.sequelize.close();
});
