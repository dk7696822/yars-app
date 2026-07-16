# Inventory Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add raw-material inventory management to YARS — suppliers, user-managed categories, user-managed item attributes (cut type, GSM, colour — extensible from the UI), purchase orders (ordered vs received), goods receipts, FIFO-costed stock batches, an append-only movement ledger, and mobile-first daily issue entry with wastage tracked separately.

**Architecture:** Eleven new Postgres tables via Sequelize migrations. Item variations (D Cut vs W Cut, 60 vs 90 GSM, colour) are **user-managed attribute definitions and values** — chosen per item via dropdowns, at most one value per attribute (enforced by a DB unique constraint on the link table), same philosophy as the user-managed categories; only `unit` stays a fixed code-level enum, because units drive stock math. Stock on hand is derived from open FIFO batch remainders (`stock_batches.quantity_remaining`), never from a cached column; every stock event is also appended to an immutable `stock_movements` ledger for history and reconciliation. All stock mutation is funnelled through a single `stockService` that runs inside a DB transaction and row-locks batches, so concurrent issues can never double-spend a batch and stock can never go negative. The REST API mirrors the existing controller/route/model split but introduces server-side pagination (a first for this codebase). The frontend adds an Inventory section built mobile-first — the factory user enters issues daily on a phone.

**Tech Stack:** Node 20, Express 5, Sequelize 6, Postgres (Supabase), React 19, Vite, Tailwind, Jest (new), Docker (new, tests only).

**Spec:** `docs/superpowers/specs/2026-07-11-inventory-module-design.md`

---

## Context for the implementer

You are working in `/Users/admin/Desktop/yars-app`. **Only touch `backend/` and `frontend/` at the repo root. Never touch the `epidermohydra/` directory — it is an unrelated project that happens to share this repo.**

**Conventions you must follow** (copy these, don't invent):
- Models: `backend/src/models/expenseCategory.js` — UUID PK via `uuidv4()`, `underscored: true`, snake_case `tableName`, explicit `created_at`/`updated_at`, `is_archived` boolean.
- Migrations: `backend/src/migrations/20240610000001-create-expense-categories.js` — `Sequelize.UUIDV4` default, `Sequelize.literal('CURRENT_TIMESTAMP')` on timestamps.
- Controllers: `backend/src/controllers/expenseCategoryController.js` — `try/catch`, `console.error`, and the `success(res, code, msg, data)` / `error(res, code, msg, errs)` helpers from `backend/src/utils/response.js`. **Always** filter `is_archived: false`. Delete = soft delete, refused if the record is still referenced.
- Routes: `backend/src/routes/expenseCategoryRoutes.js`, registered in `backend/src/routes/index.js`.
- Frontend API: `frontend/src/services/api.js` — one exported object per resource.
- Frontend pages: `frontend/src/pages/Expenses.jsx` and `ExpenseCategories.jsx`.

**Migration filenames use a `YYYYMMDDHHMMSS`-style prefix.** Existing inventory migrations must sort *after* all existing ones. Use the `20260711...` prefixes exactly as given below.

**Money/quantity types:** every quantity and rate is `DECIMAL(10,2)`. Sequelize returns DECIMAL as a **string** from Postgres. Always `parseFloat()` before arithmetic. This is the single most likely source of bugs in this module — `"300" + "200"` is `"300200"`.

---

## File Structure

**Backend — create:**

| File | Responsibility |
|---|---|
| `src/migrations/20260711000001-create-inventory-categories.js` … `-000011-create-item-attributes.js` | Schema (11 migrations) |
| `src/seeders/20260711000001-inventory-categories.js` | Seed the 5 default categories |
| `src/seeders/20260711000002-item-attributes.js` | Seed the Cut / GSM / Color attributes and their default values |
| `src/models/inventoryCategory.js` | Category model |
| `src/models/supplier.js` | Supplier model |
| `src/models/inventoryItem.js` | Item model |
| `src/models/itemAttribute.js`, `itemAttributeValue.js`, `inventoryItemAttributeValue.js` | Attribute masters + item↔value link |
| `src/models/purchaseOrder.js`, `purchaseOrderItem.js` | PO header + lines |
| `src/models/goodsReceipt.js`, `goodsReceiptItem.js` | Receipt header + lines |
| `src/models/stockBatch.js` | FIFO lots |
| `src/models/stockMovement.js` | Append-only ledger |
| `src/models/stockIssue.js`, `stockIssueItem.js` | Issue header + lines |
| **`src/services/stockService.js`** | **All stock mutation. The heart of the module.** |
| `src/services/documentNumber.js` | Generates `PO-2026-0001`, `GR-…`, `ISS-…` |
| `src/utils/pagination.js` | Shared `page`/`limit` → `{limit, offset}` + response envelope |
| `src/controllers/inventoryCategoryController.js` | Category CRUD |
| `src/controllers/itemAttributeController.js` | Attribute + value CRUD with in-use guards |
| `src/controllers/supplierController.js` | Supplier CRUD |
| `src/controllers/inventoryItemController.js` | Item CRUD (incl. `attribute_value_ids`) |
| `src/controllers/purchaseOrderController.js` | PO CRUD + `POST /:id/receive` |
| `src/controllers/goodsReceiptController.js` | Receipt list/detail/create |
| `src/controllers/stockIssueController.js` | Issues, wastage, adjustments |
| `src/controllers/stockController.js` | Stock-on-hand, summary, item detail, movements |
| `src/routes/*.js` (8 files) | Route wiring |
| `tests/` | Jest tests for `stockService` |

**Backend — modify:**
- `src/models/order.js` — add `Order.hasMany(models.StockMovement)` (one-directional; Order logic untouched).
- `src/routes/index.js` — mount 8 new routers.
- `src/controllers/exportController.js` — add `exportInventoryData`.
- `src/routes/exportRoutes.js` — add `GET /inventory`.
- `package.json` — add Jest, `test` script.

**Frontend — create:** `src/services/inventoryAPI.js`, plus pages `Stock.jsx`, `StockItemDetail.jsx`, `InventoryItems.jsx`, `CreateInventoryItem.jsx`, `EditInventoryItem.jsx`, `PurchaseOrders.jsx`, `CreatePurchaseOrder.jsx`, `PurchaseOrderDetail.jsx`, `ReceivePurchaseOrder.jsx`, `StockIssues.jsx`, `CreateStockIssue.jsx`, `Suppliers.jsx`, `CreateSupplier.jsx`, `EditSupplier.jsx`, `SupplierDetail.jsx`, `InventoryCategories.jsx`, `ItemAttributes.jsx`; components under `src/components/inventory/`; `src/components/common/Pagination.jsx`.

**Frontend — modify:** `src/App.jsx` (routes), `src/components/layout/Sidebar.jsx` (nav).

---

# Phase 0 — Test infrastructure

The repo has no tests (`npm test` is a stub). This module does FIFO cost arithmetic where a silent error compounds invisibly across every future report, so `stockService` gets real tests. Tests need a **real Postgres** (the code uses enums, `SELECT … FOR UPDATE`, and transactions — SQLite cannot stand in).

**Never point tests at the Supabase database.** It is production. Tests truncate tables.

### Task 0.1: Local test database

**Files:**
- Create: `backend/docker-compose.test.yml`
- Create: `backend/.env.test`
- Modify: `backend/src/config/database.js`
- Modify: `backend/package.json`

- [ ] **Step 1: Create the throwaway Postgres**

`backend/docker-compose.test.yml`:
```yaml
services:
  yars-test-db:
    image: postgres:16-alpine
    container_name: yars-test-db
    environment:
      POSTGRES_USER: yars
      POSTGRES_PASSWORD: yars
      POSTGRES_DB: yars_test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data
```

`tmpfs` keeps the data in RAM — the DB is wiped on every container restart, which is what we want.

**No Docker?** Skip this file, create a `yars_test` database on a local Postgres, and set the port in `.env.test` to `5432`. Everything else is identical.

- [ ] **Step 2: Test environment config**

`backend/.env.test`:
```
DB_USERNAME=yars
DB_PASSWORD=yars
DB_NAME=yars_test
DB_HOSTNAME=localhost
DB_PORT=5433
DB_DIALECT=postgres
NODE_ENV=test
```

- [ ] **Step 3: Make the `test` config load `.env.test` and drop SSL**

The `test` block in `backend/src/config/database.js` currently reuses the same env vars as production. Local Postgres has no SSL, so it must not request it. Replace the `test:` block with:

```js
  test: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOSTNAME,
    port: process.env.DB_PORT,
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: false,
    // No dialectOptions.ssl — the local test Postgres does not speak SSL.
  },
```

And change the very first line of the file from `require('dotenv').config();` to:

```js
require('dotenv').config(
  process.env.NODE_ENV === 'test' ? { path: __dirname + '/../../.env.test' } : {}
);
```

- [ ] **Step 4: Install Jest and wire up scripts**

Run: `cd backend && npm install --save-dev jest cross-env`

In `backend/package.json`, replace the `test` script and add the others:
```json
    "test": "cross-env NODE_ENV=test jest --runInBand",
    "test:db:up": "docker compose -f docker-compose.test.yml up -d",
    "test:db:down": "docker compose -f docker-compose.test.yml down",
    "test:migrate": "cross-env NODE_ENV=test sequelize db:migrate"
```

`--runInBand` is **required**: the tests share one database, and parallel workers would trample each other's tables.

Add at the top level of `package.json`:
```json
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/tests/**/*.test.js"],
    "setupFilesAfterEnv": ["<rootDir>/tests/setup.js"],
    "testTimeout": 20000
  },
```

- [ ] **Step 5: Test setup file**

`backend/tests/setup.js`:
```js
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
```

- [ ] **Step 6: Verify the harness runs**

```bash
cd backend
npm run test:db:up
sleep 3
npm test
```
Expected: Jest reports **"No tests found"** and exits — that is success at this stage. It proves config loads and the DB connects. If you instead see `ECONNREFUSED`, the container is not up. If you see `no pg_hba.conf entry ... SSL off`, Step 3 was not applied.

- [ ] **Step 7: Commit**

```bash
cd /Users/admin/Desktop/yars-app
git add backend/docker-compose.test.yml backend/.env.test backend/src/config/database.js backend/package.json backend/package-lock.json backend/tests/setup.js
git commit -m "test(backend): jest harness with throwaway postgres for inventory tests"
```

⚠️ **Check `backend/.gitignore` before committing.** Every line in it is currently commented out, so nothing is ignored. `.env.test` holds only throwaway local credentials so committing it is fine, but **do not** let `node_modules/` or the real `.env` get staged. Use `git status` and stage explicitly, as above.

---

# Phase 1 — Database schema

Eleven migrations. Run them all at the end of the phase, against the **test** DB only. Production migration happens at rollout, not now.

### Task 1.1: Categories, suppliers, items

**Files:**
- Create: `backend/src/migrations/20260711000001-create-inventory-categories.js`
- Create: `backend/src/migrations/20260711000002-create-suppliers.js`
- Create: `backend/src/migrations/20260711000003-create-inventory-items.js`

- [ ] **Step 1: `20260711000001-create-inventory-categories.js`**

```js
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("inventory_categories", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      name: { type: Sequelize.TEXT, allowNull: false, unique: true },
      is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("inventory_categories");
  },
};
```

- [ ] **Step 2: `20260711000002-create-suppliers.js`**

```js
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("suppliers", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      name: { type: Sequelize.TEXT, allowNull: false },
      phone: { type: Sequelize.TEXT, allowNull: true },
      email: { type: Sequelize.TEXT, allowNull: true },
      gst_number: { type: Sequelize.TEXT, allowNull: true },
      address: { type: Sequelize.TEXT, allowNull: true },
      is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("suppliers");
  },
};
```

- [ ] **Step 3: `20260711000003-create-inventory-items.js`**

```js
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("inventory_items", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      name: { type: Sequelize.TEXT, allowNull: false },
      item_code: { type: Sequelize.TEXT, allowNull: true, unique: true },
      category_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "inventory_categories", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      unit: { type: Sequelize.ENUM("KG", "PCS", "METRE", "ROLL", "LITRE"), allowNull: false },
      reorder_level: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      reorder_target: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("inventory_items", ["category_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("inventory_items");
    // Dropping the table leaves the enum type behind in Postgres.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_inventory_items_unit";');
  },
};
```

There are deliberately **no `gsm` or `color` columns** here. Item variations (cut type, GSM, colour, whatever comes next) are user-managed attributes — see Task 1.5. Hardcoding two of them as columns would mean a migration every time the factory's vocabulary grows.

- [ ] **Step 4: Commit**

```bash
git add backend/src/migrations/2026071100000{1,2,3}-*.js
git commit -m "feat(inventory): migrations for categories, suppliers, items"
```

### Task 1.2: Procurement tables

**Files:**
- Create: `backend/src/migrations/20260711000004-create-purchase-orders.js`
- Create: `backend/src/migrations/20260711000005-create-purchase-order-items.js`
- Create: `backend/src/migrations/20260711000006-create-goods-receipts.js`

- [ ] **Step 1: `20260711000004-create-purchase-orders.js`**

```js
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("purchase_orders", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      po_number: { type: Sequelize.TEXT, allowNull: false, unique: true },
      supplier_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "suppliers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      order_date: { type: Sequelize.DATEONLY, allowNull: false },
      expected_date: { type: Sequelize.DATEONLY, allowNull: true },
      status: {
        type: Sequelize.ENUM("PENDING", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"),
        allowNull: false,
        defaultValue: "PENDING",
      },
      notes: { type: Sequelize.TEXT, allowNull: true },
      is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("purchase_orders", ["supplier_id"]);
    await queryInterface.addIndex("purchase_orders", ["status"]);
    await queryInterface.addIndex("purchase_orders", ["order_date"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("purchase_orders");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_purchase_orders_status";');
  },
};
```

- [ ] **Step 2: `20260711000005-create-purchase-order-items.js`**

```js
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("purchase_order_items", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      purchase_order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "purchase_orders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      quantity_ordered: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      rate: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      quantity_received: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("purchase_order_items", ["purchase_order_id"]);
    await queryInterface.addIndex("purchase_order_items", ["item_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("purchase_order_items");
  },
};
```

Note `onDelete: "CASCADE"` on `purchase_order_id`: PO lines are owned by the PO. Everything else is `RESTRICT` — you must never be able to delete a supplier or item out from under a document that references it.

- [ ] **Step 3: `20260711000006-create-goods-receipts.js`** (header **and** items in one migration)

```js
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("goods_receipts", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      receipt_number: { type: Sequelize.TEXT, allowNull: false, unique: true },
      purchase_order_id: {
        type: Sequelize.UUID,
        allowNull: true, // material can arrive with no PO
        references: { model: "purchase_orders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      supplier_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "suppliers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      receipt_date: { type: Sequelize.DATEONLY, allowNull: false },
      supplier_bill_ref: { type: Sequelize.TEXT, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("goods_receipt_items", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      goods_receipt_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "goods_receipts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      purchase_order_item_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "purchase_order_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      quantity_received: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      rate: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("goods_receipts", ["supplier_id"]);
    await queryInterface.addIndex("goods_receipts", ["purchase_order_id"]);
    await queryInterface.addIndex("goods_receipt_items", ["goods_receipt_id"]);
    await queryInterface.addIndex("goods_receipt_items", ["item_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("goods_receipt_items");
    await queryInterface.dropTable("goods_receipts");
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/migrations/2026071100000{4,5,6}-*.js
git commit -m "feat(inventory): migrations for purchase orders and goods receipts"
```

### Task 1.3: Stock tables

**Files:**
- Create: `backend/src/migrations/20260711000007-create-stock-batches.js`
- Create: `backend/src/migrations/20260711000008-create-stock-issues.js`
- Create: `backend/src/migrations/20260711000009-create-stock-movements.js`
- Create: `backend/src/migrations/20260711000010-extend-audit-entity-type.js`

- [ ] **Step 1: `20260711000007-create-stock-batches.js`**

```js
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("stock_batches", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      goods_receipt_item_id: {
        type: Sequelize.UUID,
        allowNull: true, // null for ADJUSTMENT_IN batches, which have no receipt
        references: { model: "goods_receipt_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      received_date: { type: Sequelize.DATEONLY, allowNull: false },
      quantity_received: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      quantity_remaining: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      rate: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    // Every FIFO walk hits this index: open batches for an item, oldest first.
    await queryInterface.addIndex("stock_batches", ["item_id", "received_date"]);

    // Stock can never go negative. Enforce it in the database, not just in JS.
    await queryInterface.sequelize.query(`
      ALTER TABLE stock_batches
      ADD CONSTRAINT stock_batches_qty_remaining_non_negative
      CHECK (quantity_remaining >= 0);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("stock_batches");
  },
};
```

The CHECK constraint is the safety net. Even if a future bug slips past the service's validation, Postgres refuses to write negative stock and the transaction rolls back.

- [ ] **Step 2: `20260711000008-create-stock-issues.js`** (header **and** items)

```js
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("stock_issues", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      issue_number: { type: Sequelize.TEXT, allowNull: false, unique: true },
      issue_date: { type: Sequelize.DATEONLY, allowNull: false },
      issue_type: {
        type: Sequelize.ENUM("ISSUE", "WASTAGE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"),
        allowNull: false,
        defaultValue: "ISSUE",
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: true, // optional tag: which customer order consumed this
        references: { model: "orders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      reason: { type: Sequelize.TEXT, allowNull: true }, // REQUIRED for adjustments (enforced in service)
      notes: { type: Sequelize.TEXT, allowNull: true },
      is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("stock_issue_items", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      stock_issue_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "stock_issues", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      quantity: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      total_cost: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      wastage_quantity: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      wastage_cost: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("stock_issues", ["issue_date"]);
    await queryInterface.addIndex("stock_issues", ["issue_type"]);
    await queryInterface.addIndex("stock_issues", ["order_id"]);
    await queryInterface.addIndex("stock_issue_items", ["stock_issue_id"]);
    await queryInterface.addIndex("stock_issue_items", ["item_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("stock_issue_items");
    await queryInterface.dropTable("stock_issues");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_stock_issues_issue_type";');
  },
};
```

- [ ] **Step 3: `20260711000009-create-stock-movements.js`**

```js
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("stock_movements", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      movement_type: {
        type: Sequelize.ENUM("RECEIPT", "ISSUE", "WASTAGE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"),
        allowNull: false,
      },
      // Signed: positive = into stock, negative = out of stock.
      quantity: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      stock_batch_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "stock_batches", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      unit_cost: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      total_cost: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      reference_type: {
        type: Sequelize.ENUM("GOODS_RECEIPT", "STOCK_ISSUE", "STOCK_ADJUSTMENT"),
        allowNull: false,
      },
      reference_id: { type: Sequelize.UUID, allowNull: false },
      order_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "orders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      movement_date: { type: Sequelize.DATEONLY, allowNull: false },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("stock_movements", ["item_id", "movement_date"]);
    await queryInterface.addIndex("stock_movements", ["reference_type", "reference_id"]);
    await queryInterface.addIndex("stock_movements", ["movement_type"]);
    await queryInterface.addIndex("stock_movements", ["order_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("stock_movements");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_stock_movements_movement_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_stock_movements_reference_type";');
  },
};
```

`stock_movements` has **no `updated_at`** — it is append-only. Rows are never modified or deleted. The model in Phase 2 disables `updatedAt` to match.

- [ ] **Step 4: `20260711000010-extend-audit-entity-type.js`**

⚠️ **This is the migration that will fail on deploy if you get it wrong.** `ALTER TYPE … ADD VALUE` cannot run inside a transaction block in Postgres. Sequelize's CLI does not wrap migrations in a transaction by default — but if anyone adds one, this breaks. It is also not reversible, hence the explanatory `down`.

```js
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
    // Do NOT wrap these in queryInterface.sequelize.transaction().
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_audit_logs_entity_type" ADD VALUE IF NOT EXISTS 'PURCHASE_ORDER';`
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_audit_logs_entity_type" ADD VALUE IF NOT EXISTS 'GOODS_RECEIPT';`
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_audit_logs_entity_type" ADD VALUE IF NOT EXISTS 'STOCK_ISSUE';`
    );
  },

  async down() {
    // Postgres cannot remove a value from an enum type. Rolling this back would
    // require recreating the type and rewriting audit_logs. Intentionally a no-op:
    // leaving the extra values in place is harmless.
  },
};
```

Confirm the enum type name first — it is derived from the table and column:
```bash
cd backend && npm run test:db:up && sleep 3
docker exec yars-test-db psql -U yars -d yars_test -c "\dT+ enum_audit_logs_entity_type"
```
If the type is named differently, correct the migration. (It will only exist after the earlier `audit_logs` migration has run — see the next task.)

- [ ] **Step 5: Run every migration against the test DB**

```bash
cd backend
npm run test:db:up && sleep 3
npm run test:migrate
```
Expected: all migrations execute, ending with the four inventory ones, and no errors.

Then verify the schema really landed:
```bash
docker exec yars-test-db psql -U yars -d yars_test -c "\dt"
```
Expected: `inventory_categories`, `suppliers`, `inventory_items`, `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items`, `stock_batches`, `stock_issues`, `stock_issue_items`, `stock_movements` all present alongside the existing tables.

And verify the CHECK constraint is real:
```bash
docker exec yars-test-db psql -U yars -d yars_test -c \
  "SELECT conname FROM pg_constraint WHERE conname = 'stock_batches_qty_remaining_non_negative';"
```
Expected: one row.

- [ ] **Step 6: Commit**

```bash
git add backend/src/migrations/2026071100000{7,8,9}-*.js backend/src/migrations/20260711000010-*.js
git commit -m "feat(inventory): migrations for stock batches, issues, and movement ledger"
```

### Task 1.4: Seed default categories

**Files:**
- Create: `backend/src/seeders/20260711000001-inventory-categories.js`

- [ ] **Step 1: Write the seeder**

```js
"use strict";
const { v4: uuidv4 } = require("uuid");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const categories = ["Fabric", "Handle", "Thread", "Ink", "Packing"];

    await queryInterface.bulkInsert(
      "inventory_categories",
      categories.map((name) => ({
        id: uuidv4(),
        name,
        is_archived: false,
        created_at: now,
        updated_at: now,
      }))
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("inventory_categories", null, {});
  },
};
```

These are only defaults. The user can add, rename, and remove categories from the UI — that is the whole point of making categories a table rather than an enum.

- [ ] **Step 2: Commit**

```bash
git add backend/src/seeders/20260711000001-inventory-categories.js
git commit -m "feat(inventory): seed default inventory categories"
```

### Task 1.5: Item attribute tables

**Files:**
- Create: `backend/src/migrations/20260711000011-create-item-attributes.js`

Item variations follow the same philosophy as categories: **user-managed, nothing hardcoded.** Three tables in one migration (definitions + values + item link — they only make sense together, like goods receipts and their items in Task 1.2):

- `item_attributes` — the definitions ("Cut", "GSM", "Color", whatever the user adds next).
- `item_attribute_values` — the choices under each ("D Cut", "W Cut", "60", "90", …).
- `inventory_item_attribute_values` — which value each item has, at most **one per attribute**. `attribute_id` is deliberately denormalised into this row precisely so that rule can live in the database as `UNIQUE(item_id, attribute_id)` rather than in application code. The controller (Task 4.4) still validates that the chosen value actually belongs to the claimed attribute.

- [ ] **Step 1: `20260711000011-create-item-attributes.js`**

```js
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("item_attributes", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      name: { type: Sequelize.TEXT, allowNull: false, unique: true },
      is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("item_attribute_values", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      attribute_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "item_attributes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      value: { type: Sequelize.TEXT, allowNull: false },
      is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("item_attribute_values", ["attribute_id"]);
    // No duplicate values under one attribute ("W Cut" twice under "Cut").
    await queryInterface.addConstraint("item_attribute_values", {
      fields: ["attribute_id", "value"],
      type: "unique",
      name: "item_attribute_values_attribute_id_value_unique",
    });

    await queryInterface.createTable("inventory_item_attribute_values", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE", // link rows are owned by the item
      },
      attribute_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "item_attributes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      attribute_value_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "item_attribute_values", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("inventory_item_attribute_values", ["item_id"]);
    await queryInterface.addIndex("inventory_item_attribute_values", ["attribute_value_id"]);
    // An item gets at most ONE value per attribute. This is the constraint the
    // denormalised attribute_id exists for — enforce it in the database.
    await queryInterface.addConstraint("inventory_item_attribute_values", {
      fields: ["item_id", "attribute_id"],
      type: "unique",
      name: "inventory_item_attribute_values_item_id_attribute_id_unique",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("inventory_item_attribute_values");
    await queryInterface.dropTable("item_attribute_values");
    await queryInterface.dropTable("item_attributes");
  },
};
```

`backend/tests/setup.js` needs **no change**: the `TRUNCATE … CASCADE` on `inventory_items` clears the link table, and no test writes to `item_attributes` — attributes carry no stock math.

- [ ] **Step 2: Run it against the test DB and verify**

```bash
cd backend
npm run test:db:up && sleep 3
npm run test:migrate
docker exec yars-test-db psql -U yars -d yars_test -c "\dt" | grep item_attribute
```
Expected: `item_attributes`, `item_attribute_values`, `inventory_item_attribute_values` all present.

And verify the one-value-per-attribute constraint is real:
```bash
docker exec yars-test-db psql -U yars -d yars_test -c \
  "SELECT conname FROM pg_constraint WHERE conname = 'inventory_item_attribute_values_item_id_attribute_id_unique';"
```
Expected: one row.

- [ ] **Step 3: Commit**

```bash
git add backend/src/migrations/20260711000011-*.js
git commit -m "feat(inventory): migrations for user-managed item attributes"
```

### Task 1.6: Seed default attributes

**Files:**
- Create: `backend/src/seeders/20260711000002-item-attributes.js`

- [ ] **Step 1: Write the seeder**

```js
"use strict";
const { v4: uuidv4 } = require("uuid");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Color ships with no values on purpose: colours are business-specific,
    // and a wrong default is worse than an empty dropdown the user fills once.
    const defaults = {
      Cut: ["D Cut", "W Cut", "U Cut", "Loop Handle"],
      GSM: ["60", "70", "80", "90", "100"],
      Color: [],
    };

    const attributes = [];
    const values = [];

    for (const [name, attributeValues] of Object.entries(defaults)) {
      const attributeId = uuidv4();
      attributes.push({ id: attributeId, name, is_archived: false, created_at: now, updated_at: now });

      for (const value of attributeValues) {
        values.push({
          id: uuidv4(),
          attribute_id: attributeId,
          value,
          is_archived: false,
          created_at: now,
          updated_at: now,
        });
      }
    }

    await queryInterface.bulkInsert("item_attributes", attributes);
    await queryInterface.bulkInsert("item_attribute_values", values);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("inventory_item_attribute_values", null, {});
    await queryInterface.bulkDelete("item_attribute_values", null, {});
    await queryInterface.bulkDelete("item_attributes", null, {});
  },
};
```

Like the categories, these are only defaults — the user renames, extends, and deletes them from the UI. That is the point of the whole mechanism.

- [ ] **Step 2: Commit**

```bash
git add backend/src/seeders/20260711000002-item-attributes.js
git commit -m "feat(inventory): seed default item attributes (cut, gsm, color)"
```

---

# Phase 2 — Sequelize models

`backend/src/models/index.js` auto-loads every `.js` file in the directory and calls `associate()`, so new models need no registration — just create the file.

**Every model below follows the house style** (see `expenseCategory.js`): `uuidv4()` default, `underscored: true`, explicit snake_case `tableName`, explicit `created_at`/`updated_at`.

### Task 2.1: Master models

**Files:**
- Create: `backend/src/models/inventoryCategory.js`, `supplier.js`, `inventoryItem.js`

- [ ] **Step 1: `inventoryCategory.js`**

```js
"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class InventoryCategory extends Model {
    static associate(models) {
      InventoryCategory.hasMany(models.InventoryItem, {
        foreignKey: "category_id",
        as: "items",
      });
    }
  }

  InventoryCategory.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      name: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
        validate: { notEmpty: true },
      },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "InventoryCategory",
      tableName: "inventory_categories",
      timestamps: true,
      underscored: true,
    }
  );

  return InventoryCategory;
};
```

- [ ] **Step 2: `supplier.js`**

```js
"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class Supplier extends Model {
    static associate(models) {
      Supplier.hasMany(models.PurchaseOrder, { foreignKey: "supplier_id", as: "purchaseOrders" });
      Supplier.hasMany(models.GoodsReceipt, { foreignKey: "supplier_id", as: "goodsReceipts" });
    }
  }

  Supplier.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      name: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true } },
      phone: { type: DataTypes.TEXT, allowNull: true },
      email: { type: DataTypes.TEXT, allowNull: true },
      gst_number: { type: DataTypes.TEXT, allowNull: true },
      address: { type: DataTypes.TEXT, allowNull: true },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "Supplier",
      tableName: "suppliers",
      timestamps: true,
      underscored: true,
    }
  );

  return Supplier;
};
```

- [ ] **Step 3: `inventoryItem.js`**

```js
"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class InventoryItem extends Model {
    static associate(models) {
      InventoryItem.belongsTo(models.InventoryCategory, { foreignKey: "category_id", as: "category" });
      InventoryItem.hasMany(models.StockBatch, { foreignKey: "item_id", as: "batches" });
      InventoryItem.hasMany(models.StockMovement, { foreignKey: "item_id", as: "movements" });
      InventoryItem.hasMany(models.PurchaseOrderItem, { foreignKey: "item_id", as: "purchaseOrderItems" });
    }
  }

  InventoryItem.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      name: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true } },
      item_code: { type: DataTypes.TEXT, allowNull: true, unique: true },
      category_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "inventory_categories", key: "id" },
      },
      unit: {
        type: DataTypes.ENUM("KG", "PCS", "METRE", "ROLL", "LITRE"),
        allowNull: false,
      },
      reorder_level: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: { isDecimal: true, min: 0 },
      },
      reorder_target: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        validate: { isDecimal: true, min: 0 },
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "InventoryItem",
      tableName: "inventory_items",
      timestamps: true,
      underscored: true,
    }
  );

  return InventoryItem;
};
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/models/inventoryCategory.js backend/src/models/supplier.js backend/src/models/inventoryItem.js
git commit -m "feat(inventory): category, supplier, item models"
```

### Task 2.2: Procurement models

**Files:**
- Create: `backend/src/models/purchaseOrder.js`, `purchaseOrderItem.js`, `goodsReceipt.js`, `goodsReceiptItem.js`

- [ ] **Step 1: `purchaseOrder.js`**

```js
"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrder extends Model {
    static associate(models) {
      PurchaseOrder.belongsTo(models.Supplier, { foreignKey: "supplier_id", as: "supplier" });
      PurchaseOrder.hasMany(models.PurchaseOrderItem, { foreignKey: "purchase_order_id", as: "items" });
      PurchaseOrder.hasMany(models.GoodsReceipt, { foreignKey: "purchase_order_id", as: "receipts" });
    }
  }

  PurchaseOrder.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      po_number: { type: DataTypes.TEXT, allowNull: false, unique: true },
      supplier_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "suppliers", key: "id" },
      },
      order_date: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
      expected_date: { type: DataTypes.DATEONLY, allowNull: true },
      status: {
        type: DataTypes.ENUM("PENDING", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"),
        allowNull: false,
        defaultValue: "PENDING",
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "PurchaseOrder",
      tableName: "purchase_orders",
      timestamps: true,
      underscored: true,
    }
  );

  return PurchaseOrder;
};
```

- [ ] **Step 2: `purchaseOrderItem.js`**

```js
"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrderItem extends Model {
    static associate(models) {
      PurchaseOrderItem.belongsTo(models.PurchaseOrder, { foreignKey: "purchase_order_id", as: "purchaseOrder" });
      PurchaseOrderItem.belongsTo(models.InventoryItem, { foreignKey: "item_id", as: "item" });
    }
  }

  PurchaseOrderItem.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      purchase_order_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "purchase_orders", key: "id" },
      },
      item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
      },
      quantity_ordered: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: { isDecimal: true, min: 0.01 },
      },
      rate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: { isDecimal: true, min: 0 },
      },
      quantity_received: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: { isDecimal: true, min: 0 },
      },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "PurchaseOrderItem",
      tableName: "purchase_order_items",
      timestamps: true,
      underscored: true,
    }
  );

  return PurchaseOrderItem;
};
```

- [ ] **Step 3: `goodsReceipt.js`**

```js
"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class GoodsReceipt extends Model {
    static associate(models) {
      GoodsReceipt.belongsTo(models.Supplier, { foreignKey: "supplier_id", as: "supplier" });
      GoodsReceipt.belongsTo(models.PurchaseOrder, { foreignKey: "purchase_order_id", as: "purchaseOrder" });
      GoodsReceipt.hasMany(models.GoodsReceiptItem, { foreignKey: "goods_receipt_id", as: "items" });
    }
  }

  GoodsReceipt.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      receipt_number: { type: DataTypes.TEXT, allowNull: false, unique: true },
      purchase_order_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "purchase_orders", key: "id" },
      },
      supplier_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "suppliers", key: "id" },
      },
      receipt_date: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
      supplier_bill_ref: { type: DataTypes.TEXT, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "GoodsReceipt",
      tableName: "goods_receipts",
      timestamps: true,
      underscored: true,
    }
  );

  return GoodsReceipt;
};
```

- [ ] **Step 4: `goodsReceiptItem.js`**

```js
"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class GoodsReceiptItem extends Model {
    static associate(models) {
      GoodsReceiptItem.belongsTo(models.GoodsReceipt, { foreignKey: "goods_receipt_id", as: "goodsReceipt" });
      GoodsReceiptItem.belongsTo(models.PurchaseOrderItem, { foreignKey: "purchase_order_item_id", as: "purchaseOrderItem" });
      GoodsReceiptItem.belongsTo(models.InventoryItem, { foreignKey: "item_id", as: "item" });
      GoodsReceiptItem.hasOne(models.StockBatch, { foreignKey: "goods_receipt_item_id", as: "batch" });
    }
  }

  GoodsReceiptItem.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      goods_receipt_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "goods_receipts", key: "id" },
      },
      purchase_order_item_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "purchase_order_items", key: "id" },
      },
      item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
      },
      quantity_received: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: { isDecimal: true, min: 0.01 },
      },
      rate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: { isDecimal: true, min: 0 },
      },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "GoodsReceiptItem",
      tableName: "goods_receipt_items",
      timestamps: true,
      underscored: true,
    }
  );

  return GoodsReceiptItem;
};
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/purchaseOrder.js backend/src/models/purchaseOrderItem.js backend/src/models/goodsReceipt.js backend/src/models/goodsReceiptItem.js
git commit -m "feat(inventory): purchase order and goods receipt models"
```

### Task 2.3: Stock models

**Files:**
- Create: `backend/src/models/stockBatch.js`, `stockMovement.js`, `stockIssue.js`, `stockIssueItem.js`
- Modify: `backend/src/models/order.js`

- [ ] **Step 1: `stockBatch.js`**

```js
"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class StockBatch extends Model {
    static associate(models) {
      StockBatch.belongsTo(models.InventoryItem, { foreignKey: "item_id", as: "item" });
      StockBatch.belongsTo(models.GoodsReceiptItem, { foreignKey: "goods_receipt_item_id", as: "goodsReceiptItem" });
      StockBatch.hasMany(models.StockMovement, { foreignKey: "stock_batch_id", as: "movements" });
    }
  }

  StockBatch.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
      },
      goods_receipt_item_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "goods_receipt_items", key: "id" },
      },
      received_date: { type: DataTypes.DATEONLY, allowNull: false },
      quantity_received: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: { isDecimal: true, min: 0 },
      },
      quantity_remaining: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: { isDecimal: true, min: 0 },
      },
      rate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: { isDecimal: true, min: 0 },
      },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "StockBatch",
      tableName: "stock_batches",
      timestamps: true,
      underscored: true,
    }
  );

  return StockBatch;
};
```

- [ ] **Step 2: `stockMovement.js`**

Note `updatedAt: false` — this ledger is append-only.

```js
"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class StockMovement extends Model {
    static associate(models) {
      StockMovement.belongsTo(models.InventoryItem, { foreignKey: "item_id", as: "item" });
      StockMovement.belongsTo(models.StockBatch, { foreignKey: "stock_batch_id", as: "batch" });
      StockMovement.belongsTo(models.Order, { foreignKey: "order_id", as: "order" });
    }
  }

  StockMovement.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
      },
      movement_type: {
        type: DataTypes.ENUM("RECEIPT", "ISSUE", "WASTAGE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"),
        allowNull: false,
      },
      // Signed: positive into stock, negative out of stock.
      quantity: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      stock_batch_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "stock_batches", key: "id" },
      },
      unit_cost: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      total_cost: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      reference_type: {
        type: DataTypes.ENUM("GOODS_RECEIPT", "STOCK_ISSUE", "STOCK_ADJUSTMENT"),
        allowNull: false,
      },
      reference_id: { type: DataTypes.UUID, allowNull: false },
      order_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "orders", key: "id" },
      },
      movement_date: { type: DataTypes.DATEONLY, allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "StockMovement",
      tableName: "stock_movements",
      timestamps: true,
      updatedAt: false, // append-only ledger: rows are never modified
      underscored: true,
    }
  );

  return StockMovement;
};
```

- [ ] **Step 3: `stockIssue.js`**

```js
"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class StockIssue extends Model {
    static associate(models) {
      StockIssue.hasMany(models.StockIssueItem, { foreignKey: "stock_issue_id", as: "items" });
      StockIssue.belongsTo(models.Order, { foreignKey: "order_id", as: "order" });
    }
  }

  StockIssue.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      issue_number: { type: DataTypes.TEXT, allowNull: false, unique: true },
      issue_date: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
      issue_type: {
        type: DataTypes.ENUM("ISSUE", "WASTAGE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"),
        allowNull: false,
        defaultValue: "ISSUE",
      },
      order_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "orders", key: "id" },
      },
      reason: { type: DataTypes.TEXT, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "StockIssue",
      tableName: "stock_issues",
      timestamps: true,
      underscored: true,
    }
  );

  return StockIssue;
};
```

- [ ] **Step 4: `stockIssueItem.js`**

```js
"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class StockIssueItem extends Model {
    static associate(models) {
      StockIssueItem.belongsTo(models.StockIssue, { foreignKey: "stock_issue_id", as: "stockIssue" });
      StockIssueItem.belongsTo(models.InventoryItem, { foreignKey: "item_id", as: "item" });
    }
  }

  StockIssueItem.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      stock_issue_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "stock_issues", key: "id" },
      },
      item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
      },
      quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: { isDecimal: true, min: 0.01 },
      },
      total_cost: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      wastage_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: { isDecimal: true, min: 0 },
      },
      wastage_cost: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "StockIssueItem",
      tableName: "stock_issue_items",
      timestamps: true,
      underscored: true,
    }
  );

  return StockIssueItem;
};
```

- [ ] **Step 5: Add the one-directional association on Order**

In `backend/src/models/order.js`, inside `static associate(models)`, after the existing `Order.hasMany(models.Payment, ...)` block, add:

```js
      // Inventory consumption tagged to this order. One-directional:
      // Order logic never reads or depends on Inventory.
      Order.hasMany(models.StockMovement, {
        foreignKey: "order_id",
        as: "stockMovements",
      });

      Order.hasMany(models.StockIssue, {
        foreignKey: "order_id",
        as: "stockIssues",
      });
```

Change **nothing else** in `order.js`. The order hooks, status logic, and audit behaviour stay exactly as they are.

- [ ] **Step 6: Verify every model loads and associates**

```bash
cd backend
NODE_ENV=test node -e "const db=require('./src/models'); console.log(Object.keys(db).filter(k=>!['sequelize','Sequelize'].includes(k)).sort().join('\n')); db.sequelize.close();"
```
Expected output includes: `GoodsReceipt`, `GoodsReceiptItem`, `InventoryCategory`, `InventoryItem`, `PurchaseOrder`, `PurchaseOrderItem`, `StockBatch`, `StockIssue`, `StockIssueItem`, `StockMovement`, `Supplier` — alongside the existing models. Any typo in an association target throws here.

- [ ] **Step 7: Commit**

```bash
git add backend/src/models/stockBatch.js backend/src/models/stockMovement.js backend/src/models/stockIssue.js backend/src/models/stockIssueItem.js backend/src/models/order.js
git commit -m "feat(inventory): stock batch, movement ledger, and issue models"
```

### Task 2.4: Item attribute models

**Files:**
- Create: `backend/src/models/itemAttribute.js`, `itemAttributeValue.js`, `inventoryItemAttributeValue.js`
- Modify: `backend/src/models/inventoryItem.js`

- [ ] **Step 1: `itemAttribute.js`**

```js
"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class ItemAttribute extends Model {
    static associate(models) {
      ItemAttribute.hasMany(models.ItemAttributeValue, {
        foreignKey: "attribute_id",
        as: "values",
      });
    }
  }

  ItemAttribute.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      name: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
        validate: { notEmpty: true },
      },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "ItemAttribute",
      tableName: "item_attributes",
      timestamps: true,
      underscored: true,
    }
  );

  return ItemAttribute;
};
```

- [ ] **Step 2: `itemAttributeValue.js`**

```js
"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class ItemAttributeValue extends Model {
    static associate(models) {
      ItemAttributeValue.belongsTo(models.ItemAttribute, {
        foreignKey: "attribute_id",
        as: "attribute",
      });
      ItemAttributeValue.hasMany(models.InventoryItemAttributeValue, {
        foreignKey: "attribute_value_id",
        as: "itemLinks",
      });
    }
  }

  ItemAttributeValue.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      attribute_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "item_attributes", key: "id" },
      },
      value: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true } },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "ItemAttributeValue",
      tableName: "item_attribute_values",
      timestamps: true,
      underscored: true,
    }
  );

  return ItemAttributeValue;
};
```

- [ ] **Step 3: `inventoryItemAttributeValue.js`** — the link rows

```js
"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class InventoryItemAttributeValue extends Model {
    static associate(models) {
      InventoryItemAttributeValue.belongsTo(models.InventoryItem, {
        foreignKey: "item_id",
        as: "item",
      });
      InventoryItemAttributeValue.belongsTo(models.ItemAttribute, {
        foreignKey: "attribute_id",
        as: "attribute",
      });
      InventoryItemAttributeValue.belongsTo(models.ItemAttributeValue, {
        foreignKey: "attribute_value_id",
        as: "value",
      });
    }
  }

  InventoryItemAttributeValue.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
      },
      // Denormalised from the value on purpose: it lets the DB enforce
      // UNIQUE(item_id, attribute_id) — one value per attribute per item.
      attribute_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "item_attributes", key: "id" },
      },
      attribute_value_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "item_attribute_values", key: "id" },
      },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "InventoryItemAttributeValue",
      tableName: "inventory_item_attribute_values",
      timestamps: true,
      underscored: true,
    }
  );

  return InventoryItemAttributeValue;
};
```

- [ ] **Step 4: Wire the item side of the association**

In `backend/src/models/inventoryItem.js`, inside `static associate(models)`, after the existing `InventoryItem.hasMany(models.PurchaseOrderItem, ...)` line, add:

```js
      InventoryItem.hasMany(models.InventoryItemAttributeValue, {
        foreignKey: "item_id",
        as: "attributeValues",
      });
```

The read path is `item.attributeValues[].attribute.name` / `item.attributeValues[].value.value` via nested includes — Task 4.4 flattens that into a friendly `attributes` array on the API response.

- [ ] **Step 5: Verify every model loads and associates**

```bash
cd backend
NODE_ENV=test node -e "const db=require('./src/models'); console.log(Object.keys(db).filter(k=>!['sequelize','Sequelize'].includes(k)).sort().join('\n')); db.sequelize.close();"
```
Expected output now also includes: `InventoryItemAttributeValue`, `ItemAttribute`, `ItemAttributeValue`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/models/itemAttribute.js backend/src/models/itemAttributeValue.js backend/src/models/inventoryItemAttributeValue.js backend/src/models/inventoryItem.js
git commit -m "feat(inventory): item attribute models and associations"
```

---

# Phase 3 — `stockService` (TDD)

**This is the most important phase in the plan.** Every stock number the business sees comes out of this file. Write the tests first, watch them fail, then implement.

Rules this service enforces, without exception:
1. Every mutation runs inside **one transaction**. Partial writes are impossible.
2. Issues **row-lock** the batches they consume (`SELECT … FOR UPDATE`), so two concurrent issues cannot spend the same batch.
3. Stock **can never go negative**. Insufficient stock aborts the whole transaction.
4. Every mutation writes to **both** `stock_batches` and `stock_movements`. They must always reconcile.
5. **`parseFloat()` every DECIMAL.** Sequelize hands them back as strings.

### Task 3.1: Test helpers and document numbering

**Files:**
- Create: `backend/tests/helpers/factories.js`
- Create: `backend/src/services/documentNumber.js`
- Create: `backend/tests/documentNumber.test.js`

- [ ] **Step 1: Test factories**

`backend/tests/helpers/factories.js`:
```js
"use strict";

const db = require("../../src/models");

const createCategory = async (name = "Fabric") => db.InventoryCategory.create({ name });

const createSupplier = async (name = "Test Supplier") => db.Supplier.create({ name });

const createItem = async (overrides = {}) => {
  const category = overrides.category_id
    ? null
    : await createCategory(`Cat-${Math.random().toString(36).slice(2, 8)}`);

  return db.InventoryItem.create({
    name: "90 GSM White",
    unit: "KG",
    category_id: overrides.category_id || category.id,
    reorder_level: 0,
    ...overrides,
  });
};

/**
 * Put stock into an item directly, as a batch, bypassing the receipt flow.
 * Used to set up FIFO scenarios cheaply.
 */
const givenBatch = async (item, { quantity, rate, received_date }) =>
  db.StockBatch.create({
    item_id: item.id,
    received_date,
    quantity_received: quantity,
    quantity_remaining: quantity,
    rate,
  });

module.exports = { createCategory, createSupplier, createItem, givenBatch };
```

- [ ] **Step 2: Write the failing test for document numbering**

`backend/tests/documentNumber.test.js`:
```js
"use strict";

const db = require("../src/models");
const { generateDocumentNumber } = require("../src/services/documentNumber");
const { createSupplier } = require("./helpers/factories");

describe("generateDocumentNumber", () => {
  it("starts a new prefix at 0001 for the year", async () => {
    const number = await generateDocumentNumber(db.PurchaseOrder, "po_number", "PO", 2026);
    expect(number).toBe("PO-2026-0001");
  });

  it("increments from the highest existing number for that year", async () => {
    const supplier = await createSupplier();
    await db.PurchaseOrder.create({
      po_number: "PO-2026-0007",
      supplier_id: supplier.id,
      order_date: "2026-07-11",
    });

    const number = await generateDocumentNumber(db.PurchaseOrder, "po_number", "PO", 2026);
    expect(number).toBe("PO-2026-0008");
  });

  it("does not let a different year's numbers bleed in", async () => {
    const supplier = await createSupplier();
    await db.PurchaseOrder.create({
      po_number: "PO-2025-0042",
      supplier_id: supplier.id,
      order_date: "2025-07-11",
    });

    const number = await generateDocumentNumber(db.PurchaseOrder, "po_number", "PO", 2026);
    expect(number).toBe("PO-2026-0001");
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `cd backend && npm test -- documentNumber`
Expected: FAIL — `Cannot find module '../src/services/documentNumber'`.

- [ ] **Step 4: Implement**

`backend/src/services/documentNumber.js`:
```js
"use strict";

const { Op } = require("sequelize");

/**
 * Generate the next sequential document number for a year, e.g. "PO-2026-0004".
 *
 * Reads the highest existing number for the prefix+year and adds one. Must be
 * called inside the same transaction as the insert it numbers, so two concurrent
 * creates cannot claim the same number — the unique constraint on the column is
 * the final backstop.
 */
const generateDocumentNumber = async (model, field, prefix, year, transaction = null) => {
  const yearPrefix = `${prefix}-${year}-`;

  const latest = await model.findOne({
    where: { [field]: { [Op.like]: `${yearPrefix}%` } },
    order: [[field, "DESC"]],
    transaction,
    paranoid: false,
  });

  const lastSequence = latest ? parseInt(latest[field].slice(yearPrefix.length), 10) : 0;
  const next = lastSequence + 1;

  return `${yearPrefix}${String(next).padStart(4, "0")}`;
};

module.exports = { generateDocumentNumber };
```

- [ ] **Step 5: Run and verify it passes**

Run: `cd backend && npm test -- documentNumber`
Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/documentNumber.js backend/tests/documentNumber.test.js backend/tests/helpers/factories.js
git commit -m "feat(inventory): sequential document number generator with tests"
```

### Task 3.2: `getStockOnHand` — the read side

**Files:**
- Create: `backend/src/services/stockService.js`
- Create: `backend/tests/stockService.stock.test.js`

- [ ] **Step 1: Write the failing tests**

`backend/tests/stockService.stock.test.js`:
```js
"use strict";

const stockService = require("../src/services/stockService");
const { createItem, givenBatch } = require("./helpers/factories");

describe("getStockOnHand", () => {
  it("is zero for an item that has never been received", async () => {
    const item = await createItem();

    const stock = await stockService.getStockOnHand(item.id);

    expect(stock.quantity).toBe(0);
    expect(stock.value).toBe(0);
  });

  it("sums the remaining quantity across open batches", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 300, rate: 80, received_date: "2026-01-01" });
    await givenBatch(item, { quantity: 400, rate: 90, received_date: "2026-02-01" });

    const stock = await stockService.getStockOnHand(item.id);

    expect(stock.quantity).toBe(700);
    // Value is per-batch rate, not an average: 300*80 + 400*90
    expect(stock.value).toBe(60000);
  });

  it("ignores exhausted batches", async () => {
    const item = await createItem();
    const empty = await givenBatch(item, { quantity: 300, rate: 80, received_date: "2026-01-01" });
    await empty.update({ quantity_remaining: 0 });
    await givenBatch(item, { quantity: 400, rate: 90, received_date: "2026-02-01" });

    const stock = await stockService.getStockOnHand(item.id);

    expect(stock.quantity).toBe(400);
    expect(stock.value).toBe(36000);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd backend && npm test -- stockService.stock`
Expected: FAIL — `Cannot find module '../src/services/stockService'`.

- [ ] **Step 3: Implement the read side**

`backend/src/services/stockService.js`:
```js
"use strict";

const { Op } = require("sequelize");
const db = require("../models");

/**
 * Stock Service
 *
 * The single place where stock is mutated. Every function here runs in a
 * transaction and keeps two things in lockstep:
 *
 *   stock_batches   — FIFO lots. quantity_remaining IS the stock on hand.
 *   stock_movements — append-only ledger. Never updated, never deleted.
 *
 * Invariant: for any item, SUM(batch.quantity_remaining) always equals
 * SUM(movement.quantity). Task 3.6 tests this.
 *
 * Sequelize returns DECIMAL as a STRING. parseFloat() everything.
 */

/** Thrown when an issue would drive stock negative. Controllers map this to a 400. */
class InsufficientStockError extends Error {
  constructor(itemName, requested, available, unit) {
    super(
      `Insufficient stock for ${itemName}: tried to issue ${requested} ${unit}, but only ${available} ${unit} available`
    );
    this.name = "InsufficientStockError";
    this.itemName = itemName;
    this.requested = requested;
    this.available = available;
  }
}

/**
 * Current stock and value for one item, derived from its open batches.
 * @returns {{quantity: number, value: number}}
 */
const getStockOnHand = async (itemId, transaction = null) => {
  const batches = await db.StockBatch.findAll({
    where: { item_id: itemId, quantity_remaining: { [Op.gt]: 0 } },
    transaction,
  });

  return batches.reduce(
    (acc, batch) => {
      const remaining = parseFloat(batch.quantity_remaining);
      const rate = parseFloat(batch.rate);
      return {
        quantity: acc.quantity + remaining,
        value: acc.value + remaining * rate,
      };
    },
    { quantity: 0, value: 0 }
  );
};

module.exports = {
  InsufficientStockError,
  getStockOnHand,
};
```

- [ ] **Step 4: Run and verify it passes**

Run: `cd backend && npm test -- stockService.stock`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/stockService.js backend/tests/stockService.stock.test.js
git commit -m "feat(inventory): stockService.getStockOnHand derived from open batches"
```

### Task 3.3: `receiveStock` — material in

**Files:**
- Modify: `backend/src/services/stockService.js`
- Create: `backend/tests/stockService.receive.test.js`

- [ ] **Step 1: Write the failing tests**

`backend/tests/stockService.receive.test.js`:
```js
"use strict";

const db = require("../src/models");
const stockService = require("../src/services/stockService");
const { createItem, createSupplier } = require("./helpers/factories");

const makePO = async (item, { quantity_ordered, rate }) => {
  const supplier = await createSupplier();
  const po = await db.PurchaseOrder.create({
    po_number: `PO-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
    supplier_id: supplier.id,
    order_date: "2026-07-01",
  });
  const line = await db.PurchaseOrderItem.create({
    purchase_order_id: po.id,
    item_id: item.id,
    quantity_ordered,
    rate,
  });
  return { supplier, po, line };
};

describe("receiveStock", () => {
  it("creates a batch and a RECEIPT movement, and stock reflects it", async () => {
    const item = await createItem();
    const supplier = await createSupplier();

    const receipt = await stockService.receiveStock({
      supplier_id: supplier.id,
      receipt_date: "2026-07-11",
      items: [{ item_id: item.id, quantity_received: 500, rate: 85 }],
    });

    expect(receipt.receipt_number).toMatch(/^GR-\d{4}-\d{4}$/);

    const batches = await db.StockBatch.findAll({ where: { item_id: item.id } });
    expect(batches).toHaveLength(1);
    expect(parseFloat(batches[0].quantity_remaining)).toBe(500);
    expect(parseFloat(batches[0].rate)).toBe(85);

    const movements = await db.StockMovement.findAll({ where: { item_id: item.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0].movement_type).toBe("RECEIPT");
    expect(parseFloat(movements[0].quantity)).toBe(500); // positive: into stock
    expect(parseFloat(movements[0].total_cost)).toBe(42500);
    expect(movements[0].reference_type).toBe("GOODS_RECEIPT");

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(500);
    expect(stock.value).toBe(42500);
  });

  it("receiving without a purchase order works", async () => {
    const item = await createItem();
    const supplier = await createSupplier();

    const receipt = await stockService.receiveStock({
      supplier_id: supplier.id,
      receipt_date: "2026-07-11",
      items: [{ item_id: item.id, quantity_received: 100, rate: 50 }],
    });

    expect(receipt.purchase_order_id).toBeNull();
    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(100);
  });

  it("a partial receipt moves the PO to PARTIALLY_RECEIVED", async () => {
    const item = await createItem();
    const { supplier, po, line } = await makePO(item, { quantity_ordered: 500, rate: 80 });

    await stockService.receiveStock({
      purchase_order_id: po.id,
      supplier_id: supplier.id,
      receipt_date: "2026-07-11",
      items: [{ item_id: item.id, purchase_order_item_id: line.id, quantity_received: 200, rate: 80 }],
    });

    await po.reload();
    await line.reload();
    expect(po.status).toBe("PARTIALLY_RECEIVED");
    expect(parseFloat(line.quantity_received)).toBe(200);
  });

  it("receiving the remainder moves the PO to RECEIVED and accumulates quantity_received", async () => {
    const item = await createItem();
    const { supplier, po, line } = await makePO(item, { quantity_ordered: 500, rate: 80 });

    await stockService.receiveStock({
      purchase_order_id: po.id,
      supplier_id: supplier.id,
      receipt_date: "2026-07-11",
      items: [{ item_id: item.id, purchase_order_item_id: line.id, quantity_received: 200, rate: 80 }],
    });
    await stockService.receiveStock({
      purchase_order_id: po.id,
      supplier_id: supplier.id,
      receipt_date: "2026-07-15",
      items: [{ item_id: item.id, purchase_order_item_id: line.id, quantity_received: 300, rate: 80 }],
    });

    await po.reload();
    await line.reload();
    expect(po.status).toBe("RECEIVED");
    expect(parseFloat(line.quantity_received)).toBe(500);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(500);

    // Two receipts = two separate batches, even for the same item.
    const batches = await db.StockBatch.findAll({ where: { item_id: item.id } });
    expect(batches).toHaveLength(2);
  });

  it("allows over-receipt and still marks the PO RECEIVED", async () => {
    const item = await createItem();
    const { supplier, po, line } = await makePO(item, { quantity_ordered: 500, rate: 80 });

    await stockService.receiveStock({
      purchase_order_id: po.id,
      supplier_id: supplier.id,
      receipt_date: "2026-07-11",
      items: [{ item_id: item.id, purchase_order_item_id: line.id, quantity_received: 520, rate: 80 }],
    });

    await po.reload();
    await line.reload();
    expect(po.status).toBe("RECEIVED");
    expect(parseFloat(line.quantity_received)).toBe(520);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(520);
  });

  it("the batch carries the RECEIPT rate, not the PO rate", async () => {
    const item = await createItem();
    const { supplier, po, line } = await makePO(item, { quantity_ordered: 500, rate: 80 });

    // Supplier raised the price between the PO and the delivery.
    await stockService.receiveStock({
      purchase_order_id: po.id,
      supplier_id: supplier.id,
      receipt_date: "2026-07-11",
      items: [{ item_id: item.id, purchase_order_item_id: line.id, quantity_received: 500, rate: 95 }],
    });

    const batch = await db.StockBatch.findOne({ where: { item_id: item.id } });
    expect(parseFloat(batch.rate)).toBe(95);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.value).toBe(47500); // 500 * 95, not 500 * 80
  });

  it("rolls back everything if one line is invalid", async () => {
    const item = await createItem();
    const supplier = await createSupplier();

    await expect(
      stockService.receiveStock({
        supplier_id: supplier.id,
        receipt_date: "2026-07-11",
        items: [
          { item_id: item.id, quantity_received: 100, rate: 50 },
          { item_id: "00000000-0000-0000-0000-000000000000", quantity_received: 50, rate: 10 },
        ],
      })
    ).rejects.toThrow();

    // The valid first line must NOT have been written.
    const batches = await db.StockBatch.findAll();
    const receipts = await db.GoodsReceipt.findAll();
    expect(batches).toHaveLength(0);
    expect(receipts).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd backend && npm test -- stockService.receive`
Expected: FAIL — `stockService.receiveStock is not a function`.

- [ ] **Step 3: Implement `receiveStock`**

Add to `backend/src/services/stockService.js` (above `module.exports`, and add it to the exports):

```js
/**
 * Record a goods receipt: material physically arriving.
 *
 * Creates the receipt + lines, one stock_batch per line (this is the FIFO lot),
 * and a RECEIPT movement per line. If linked to a PO, accumulates
 * quantity_received on the PO lines and recomputes the PO status.
 *
 * Over-receiving (more than ordered) is ALLOWED — suppliers over-deliver, and
 * blocking it would only push the user to enter false numbers.
 *
 * @returns the created GoodsReceipt (with items loaded)
 */
const receiveStock = async ({
  purchase_order_id = null,
  supplier_id,
  receipt_date,
  supplier_bill_ref = null,
  notes = null,
  items,
}) => {
  if (!items || items.length === 0) {
    throw new Error("A goods receipt must have at least one item");
  }

  return db.sequelize.transaction(async (transaction) => {
    const year = new Date(receipt_date).getFullYear();
    const receiptNumber = await generateDocumentNumber(
      db.GoodsReceipt,
      "receipt_number",
      "GR",
      year,
      transaction
    );

    const receipt = await db.GoodsReceipt.create(
      {
        receipt_number: receiptNumber,
        purchase_order_id,
        supplier_id,
        receipt_date,
        supplier_bill_ref,
        notes,
      },
      { transaction }
    );

    for (const line of items) {
      const quantity = parseFloat(line.quantity_received);
      const rate = parseFloat(line.rate);

      if (!(quantity > 0)) {
        throw new Error("Received quantity must be greater than zero");
      }

      const receiptItem = await db.GoodsReceiptItem.create(
        {
          goods_receipt_id: receipt.id,
          purchase_order_item_id: line.purchase_order_item_id || null,
          item_id: line.item_id,
          quantity_received: quantity,
          rate,
        },
        { transaction }
      );

      // The FIFO lot. quantity_remaining starts full and is drawn down by issues.
      const batch = await db.StockBatch.create(
        {
          item_id: line.item_id,
          goods_receipt_item_id: receiptItem.id,
          received_date: receipt_date,
          quantity_received: quantity,
          quantity_remaining: quantity,
          rate,
        },
        { transaction }
      );

      await db.StockMovement.create(
        {
          item_id: line.item_id,
          movement_type: "RECEIPT",
          quantity, // positive: into stock
          stock_batch_id: batch.id,
          unit_cost: rate,
          total_cost: quantity * rate,
          reference_type: "GOODS_RECEIPT",
          reference_id: receipt.id,
          movement_date: receipt_date,
        },
        { transaction }
      );

      if (line.purchase_order_item_id) {
        const poItem = await db.PurchaseOrderItem.findByPk(line.purchase_order_item_id, { transaction });
        if (poItem) {
          await poItem.update(
            { quantity_received: parseFloat(poItem.quantity_received) + quantity },
            { transaction }
          );
        }
      }
    }

    if (purchase_order_id) {
      await recomputePurchaseOrderStatus(purchase_order_id, transaction);
    }

    return db.GoodsReceipt.findByPk(receipt.id, {
      include: [{ model: db.GoodsReceiptItem, as: "items" }],
      transaction,
    });
  });
};

/**
 * A PO is RECEIVED once every line has received at least what was ordered
 * (over-receipt counts as complete), PARTIALLY_RECEIVED if any material has
 * arrived, otherwise left alone. CANCELLED POs are never touched.
 */
const recomputePurchaseOrderStatus = async (purchaseOrderId, transaction) => {
  const po = await db.PurchaseOrder.findByPk(purchaseOrderId, {
    include: [{ model: db.PurchaseOrderItem, as: "items" }],
    transaction,
  });

  if (!po || po.status === "CANCELLED") return;

  const allComplete = po.items.every(
    (line) => parseFloat(line.quantity_received) >= parseFloat(line.quantity_ordered)
  );
  const anyReceived = po.items.some((line) => parseFloat(line.quantity_received) > 0);

  let status = po.status;
  if (allComplete) status = "RECEIVED";
  else if (anyReceived) status = "PARTIALLY_RECEIVED";

  if (status !== po.status) {
    await po.update({ status }, { transaction });
  }
};
```

Add the import at the top of the file, under the existing requires:
```js
const { generateDocumentNumber } = require("./documentNumber");
```

And extend the exports:
```js
module.exports = {
  InsufficientStockError,
  getStockOnHand,
  receiveStock,
  recomputePurchaseOrderStatus,
};
```

- [ ] **Step 4: Run and verify**

Run: `cd backend && npm test -- stockService.receive`
Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/stockService.js backend/tests/stockService.receive.test.js
git commit -m "feat(inventory): stockService.receiveStock with FIFO batch creation"
```

### Task 3.4: `issueStock` — material out, FIFO-costed, with wastage

**Files:**
- Modify: `backend/src/services/stockService.js`
- Create: `backend/tests/stockService.issue.test.js`

This is the sharp end. Read the tests carefully — they encode the FIFO arithmetic.

- [ ] **Step 1: Write the failing tests**

`backend/tests/stockService.issue.test.js`:
```js
"use strict";

const db = require("../src/models");
const stockService = require("../src/services/stockService");
const { createItem, givenBatch } = require("./helpers/factories");

describe("issueStock", () => {
  it("consumes a single batch and costs it at that batch's rate", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 500, rate: 80, received_date: "2026-01-01" });

    const issue = await stockService.issueStock({
      issue_date: "2026-07-11",
      items: [{ item_id: item.id, quantity: 200 }],
    });

    const line = (await db.StockIssueItem.findAll({ where: { stock_issue_id: issue.id } }))[0];
    expect(parseFloat(line.total_cost)).toBe(16000); // 200 * 80

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(300);
    expect(stock.value).toBe(24000); // 300 * 80
  });

  it("walks batches oldest-first and splits the cost across them", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 300, rate: 80, received_date: "2026-01-01" });
    await givenBatch(item, { quantity: 400, rate: 90, received_date: "2026-02-01" });

    const issue = await stockService.issueStock({
      issue_date: "2026-07-11",
      items: [{ item_id: item.id, quantity: 500 }],
    });

    // 300 @ 80 (oldest batch, fully consumed) + 200 @ 90 = 24000 + 18000
    const line = (await db.StockIssueItem.findAll({ where: { stock_issue_id: issue.id } }))[0];
    expect(parseFloat(line.total_cost)).toBe(42000);

    // One movement per batch touched.
    const movements = await db.StockMovement.findAll({
      where: { item_id: item.id, movement_type: "ISSUE" },
      order: [["created_at", "ASC"]],
    });
    expect(movements).toHaveLength(2);
    expect(parseFloat(movements[0].quantity)).toBe(-300); // negative: out of stock
    expect(parseFloat(movements[0].unit_cost)).toBe(80);
    expect(parseFloat(movements[1].quantity)).toBe(-200);
    expect(parseFloat(movements[1].unit_cost)).toBe(90);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(200);
    expect(stock.value).toBe(18000); // 200 remaining @ 90
  });

  it("exhausting a batch exactly leaves it at zero, not negative", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 300, rate: 80, received_date: "2026-01-01" });
    await givenBatch(item, { quantity: 400, rate: 90, received_date: "2026-02-01" });

    await stockService.issueStock({
      issue_date: "2026-07-11",
      items: [{ item_id: item.id, quantity: 300 }],
    });

    const batches = await db.StockBatch.findAll({
      where: { item_id: item.id },
      order: [["received_date", "ASC"]],
    });
    expect(parseFloat(batches[0].quantity_remaining)).toBe(0);
    expect(parseFloat(batches[1].quantity_remaining)).toBe(400);
  });

  it("refuses to issue more than is available, and writes nothing", async () => {
    const item = await createItem({ name: "90 GSM White" });
    await givenBatch(item, { quantity: 100, rate: 80, received_date: "2026-01-01" });

    await expect(
      stockService.issueStock({
        issue_date: "2026-07-11",
        items: [{ item_id: item.id, quantity: 150 }],
      })
    ).rejects.toThrow(stockService.InsufficientStockError);

    // Stock untouched, no issue document, no movements.
    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(100);
    expect(await db.StockIssue.count()).toBe(0);
    expect(await db.StockMovement.count()).toBe(0);
  });

  it("rolls back the whole issue if a LATER line has insufficient stock", async () => {
    const itemA = await createItem({ name: "Item A" });
    const itemB = await createItem({ name: "Item B" });
    await givenBatch(itemA, { quantity: 500, rate: 80, received_date: "2026-01-01" });
    await givenBatch(itemB, { quantity: 10, rate: 20, received_date: "2026-01-01" });

    await expect(
      stockService.issueStock({
        issue_date: "2026-07-11",
        items: [
          { item_id: itemA.id, quantity: 100 }, // fine
          { item_id: itemB.id, quantity: 999 }, // blows up
        ],
      })
    ).rejects.toThrow(stockService.InsufficientStockError);

    // Item A must be untouched — no partial consumption.
    const stockA = await stockService.getStockOnHand(itemA.id);
    expect(stockA.quantity).toBe(500);
    expect(await db.StockIssue.count()).toBe(0);
  });

  it("wastage on a line consumes extra stock and is costed separately", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 1000, rate: 80, received_date: "2026-01-01" });

    const issue = await stockService.issueStock({
      issue_date: "2026-07-11",
      items: [{ item_id: item.id, quantity: 500, wastage_quantity: 20 }],
    });

    const line = (await db.StockIssueItem.findAll({ where: { stock_issue_id: issue.id } }))[0];
    expect(parseFloat(line.total_cost)).toBe(40000); // 500 * 80, consumption only
    expect(parseFloat(line.wastage_cost)).toBe(1600); // 20 * 80, wastage only

    // 520 total left stock.
    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(480);

    // Two distinct movement types.
    const issueMoves = await db.StockMovement.findAll({ where: { item_id: item.id, movement_type: "ISSUE" } });
    const wasteMoves = await db.StockMovement.findAll({ where: { item_id: item.id, movement_type: "WASTAGE" } });
    expect(issueMoves).toHaveLength(1);
    expect(parseFloat(issueMoves[0].quantity)).toBe(-500);
    expect(wasteMoves).toHaveLength(1);
    expect(parseFloat(wasteMoves[0].quantity)).toBe(-20);
  });

  it("validates against quantity + wastage, not quantity alone", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 510, rate: 80, received_date: "2026-01-01" });

    // 500 alone would fit; 500 + 20 wastage does not.
    await expect(
      stockService.issueStock({
        issue_date: "2026-07-11",
        items: [{ item_id: item.id, quantity: 500, wastage_quantity: 20 }],
      })
    ).rejects.toThrow(stockService.InsufficientStockError);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(510);
  });

  it("wastage can cross a batch boundary and is costed at each batch's rate", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 510, rate: 80, received_date: "2026-01-01" });
    await givenBatch(item, { quantity: 500, rate: 100, received_date: "2026-02-01" });

    const issue = await stockService.issueStock({
      issue_date: "2026-07-11",
      items: [{ item_id: item.id, quantity: 500, wastage_quantity: 20 }],
    });

    const line = (await db.StockIssueItem.findAll({ where: { stock_issue_id: issue.id } }))[0];
    // Consumption: 500 @ 80 = 40000 (batch 1 has 510, so it covers all of it)
    expect(parseFloat(line.total_cost)).toBe(40000);
    // Wastage: 10 left in batch 1 @ 80 = 800, then 10 from batch 2 @ 100 = 1000
    expect(parseFloat(line.wastage_cost)).toBe(1800);
  });

  it("tags the issue and its movements to a customer order when given", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 500, rate: 80, received_date: "2026-01-01" });

    const customer = await db.Customer.create({ name: "Test Customer" });
    const plateType = await db.PlateType.create({ type_name: "Single", charge: 100 });
    const order = await db.Order.create({
      customer_id: customer.id,
      order_date: "2026-07-01",
      plate_type_id: plateType.id,
    });

    const issue = await stockService.issueStock({
      issue_date: "2026-07-11",
      order_id: order.id,
      items: [{ item_id: item.id, quantity: 100 }],
    });

    expect(issue.order_id).toBe(order.id);
    const movement = await db.StockMovement.findOne({ where: { item_id: item.id, movement_type: "ISSUE" } });
    expect(movement.order_id).toBe(order.id);
  });

  it("generates a sequential issue number", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 500, rate: 80, received_date: "2026-01-01" });

    const issue = await stockService.issueStock({
      issue_date: "2026-07-11",
      items: [{ item_id: item.id, quantity: 10 }],
    });

    expect(issue.issue_number).toMatch(/^ISS-\d{4}-\d{4}$/);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd backend && npm test -- stockService.issue`
Expected: FAIL — `stockService.issueStock is not a function`.

- [ ] **Step 3: Implement `issueStock`**

Add to `backend/src/services/stockService.js`:

```js
/**
 * Consume `quantity` of an item from its open batches, oldest first.
 *
 * Assumes the caller has ALREADY locked the item's batches and validated that
 * enough stock exists. Writes one movement per batch touched, each costed at
 * that batch's rate.
 *
 * @returns {{cost: number}} the true FIFO cost of what was consumed
 */
const consumeFifo = async (
  { item, quantity, movementType, referenceType, referenceId, movementDate, orderId, notes },
  transaction
) => {
  let remainingToConsume = quantity;
  let cost = 0;

  const batches = await db.StockBatch.findAll({
    where: { item_id: item.id, quantity_remaining: { [Op.gt]: 0 } },
    order: [
      ["received_date", "ASC"],
      ["created_at", "ASC"], // deterministic tie-break for same-day batches
    ],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  for (const batch of batches) {
    if (remainingToConsume <= 0) break;

    const available = parseFloat(batch.quantity_remaining);
    const rate = parseFloat(batch.rate);
    const take = Math.min(available, remainingToConsume);
    const lineCost = take * rate;

    await batch.update({ quantity_remaining: available - take }, { transaction });

    await db.StockMovement.create(
      {
        item_id: item.id,
        movement_type: movementType,
        quantity: -take, // negative: out of stock
        stock_batch_id: batch.id,
        unit_cost: rate,
        total_cost: lineCost,
        reference_type: referenceType,
        reference_id: referenceId,
        order_id: orderId || null,
        movement_date: movementDate,
        notes: notes || null,
      },
      { transaction }
    );

    cost += lineCost;
    remainingToConsume -= take;
  }

  if (remainingToConsume > 0.001) {
    // Should be unreachable: the caller validates availability first. If we get
    // here, availability and batches disagree — fail loudly rather than write
    // a silently wrong number.
    throw new Error(
      `FIFO consumption fell short for ${item.name}: ${remainingToConsume} left unconsumed`
    );
  }

  return { cost };
};

/**
 * Record material leaving stock: production consumption, with optional wastage
 * on the same line.
 *
 * A line of quantity 500 + wastage_quantity 20 draws 520 from stock: 500 written
 * as ISSUE movements, 20 as WASTAGE movements, both FIFO-costed. Wastage is taken
 * AFTER consumption, so it eats whatever batches consumption did not.
 *
 * Throws InsufficientStockError (and rolls back the ENTIRE issue) if any line
 * would drive stock negative.
 */
const issueStock = async ({
  issue_date,
  issue_type = "ISSUE",
  order_id = null,
  reason = null,
  notes = null,
  items,
}) => {
  if (!items || items.length === 0) {
    throw new Error("A stock issue must have at least one item");
  }

  return db.sequelize.transaction(async (transaction) => {
    const year = new Date(issue_date).getFullYear();
    const issueNumber = await generateDocumentNumber(
      db.StockIssue,
      "issue_number",
      "ISS",
      year,
      transaction
    );

    const issue = await db.StockIssue.create(
      { issue_number: issueNumber, issue_date, issue_type, order_id, reason, notes },
      { transaction }
    );

    for (const line of items) {
      const quantity = parseFloat(line.quantity);
      const wastage = parseFloat(line.wastage_quantity || 0);

      if (!(quantity > 0)) {
        throw new Error("Issue quantity must be greater than zero");
      }
      if (wastage < 0) {
        throw new Error("Wastage quantity cannot be negative");
      }

      const item = await db.InventoryItem.findByPk(line.item_id, { transaction });
      if (!item) {
        throw new Error(`Inventory item not found: ${line.item_id}`);
      }

      // Lock this item's batches, then check availability against the LOCKED rows.
      // Doing it in this order is what makes concurrent issues safe.
      const available = await getLockedStockOnHand(item.id, transaction);
      const required = quantity + wastage;

      if (required > available + 0.001) {
        throw new InsufficientStockError(item.name, required, available, item.unit);
      }

      // A pure-wastage document has no consumption leg.
      const consumptionType = issue_type === "WASTAGE" ? "WASTAGE" : "ISSUE";

      const { cost } = await consumeFifo(
        {
          item,
          quantity,
          movementType: consumptionType,
          referenceType: "STOCK_ISSUE",
          referenceId: issue.id,
          movementDate: issue_date,
          orderId: order_id,
          notes,
        },
        transaction
      );

      let wastageCost = 0;
      if (wastage > 0) {
        const wastageResult = await consumeFifo(
          {
            item,
            quantity: wastage,
            movementType: "WASTAGE",
            referenceType: "STOCK_ISSUE",
            referenceId: issue.id,
            movementDate: issue_date,
            orderId: order_id,
            notes,
          },
          transaction
        );
        wastageCost = wastageResult.cost;
      }

      await db.StockIssueItem.create(
        {
          stock_issue_id: issue.id,
          item_id: item.id,
          quantity,
          total_cost: cost,
          wastage_quantity: wastage,
          wastage_cost: wastageCost,
        },
        { transaction }
      );
    }

    return db.StockIssue.findByPk(issue.id, {
      include: [{ model: db.StockIssueItem, as: "items" }],
      transaction,
    });
  });
};

/**
 * Stock on hand, reading the batches with a row lock held. Used inside issue
 * transactions so the availability check cannot race another issue.
 */
const getLockedStockOnHand = async (itemId, transaction) => {
  const batches = await db.StockBatch.findAll({
    where: { item_id: itemId, quantity_remaining: { [Op.gt]: 0 } },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  return batches.reduce((total, batch) => total + parseFloat(batch.quantity_remaining), 0);
};
```

Extend the exports:
```js
module.exports = {
  InsufficientStockError,
  getStockOnHand,
  receiveStock,
  recomputePurchaseOrderStatus,
  issueStock,
};
```

- [ ] **Step 4: Run and verify**

Run: `cd backend && npm test -- stockService.issue`
Expected: 10 passing.

If the FIFO split test fails with a string-concatenation value (e.g. `"30080"`), you missed a `parseFloat`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/stockService.js backend/tests/stockService.issue.test.js
git commit -m "feat(inventory): stockService.issueStock with FIFO costing and wastage"
```

### Task 3.5: `adjustStock` — corrections

**Files:**
- Modify: `backend/src/services/stockService.js`
- Create: `backend/tests/stockService.adjust.test.js`

- [ ] **Step 1: Write the failing tests**

`backend/tests/stockService.adjust.test.js`:
```js
"use strict";

const db = require("../src/models");
const stockService = require("../src/services/stockService");
const { createItem, givenBatch } = require("./helpers/factories");

describe("adjustStock", () => {
  it("ADJUSTMENT_OUT consumes FIFO like an issue", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 300, rate: 80, received_date: "2026-01-01" });
    await givenBatch(item, { quantity: 400, rate: 90, received_date: "2026-02-01" });

    await stockService.adjustStock({
      issue_date: "2026-07-11",
      issue_type: "ADJUSTMENT_OUT",
      reason: "Damaged by water leak",
      items: [{ item_id: item.id, quantity: 350 }],
    });

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(350); // 700 - 350

    const movements = await db.StockMovement.findAll({
      where: { item_id: item.id, movement_type: "ADJUSTMENT_OUT" },
    });
    expect(movements).toHaveLength(2); // crossed a batch boundary
  });

  it("ADJUSTMENT_IN creates a new batch at the most recent rate", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 100, rate: 80, received_date: "2026-01-01" });
    await givenBatch(item, { quantity: 100, rate: 95, received_date: "2026-06-01" });

    await stockService.adjustStock({
      issue_date: "2026-07-11",
      issue_type: "ADJUSTMENT_IN",
      reason: "Stock take surplus",
      items: [{ item_id: item.id, quantity: 50 }],
    });

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(250);
    // 100*80 + 100*95 + 50*95 (newest rate) = 8000 + 9500 + 4750
    expect(stock.value).toBe(22250);

    const movement = await db.StockMovement.findOne({
      where: { item_id: item.id, movement_type: "ADJUSTMENT_IN" },
    });
    expect(parseFloat(movement.quantity)).toBe(50); // positive
    expect(parseFloat(movement.unit_cost)).toBe(95);
  });

  it("ADJUSTMENT_IN on an item that was never received uses a rate of zero", async () => {
    const item = await createItem();

    await stockService.adjustStock({
      issue_date: "2026-07-11",
      issue_type: "ADJUSTMENT_IN",
      reason: "Found unrecorded stock",
      items: [{ item_id: item.id, quantity: 25 }],
    });

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(25);
    expect(stock.value).toBe(0);
  });

  it("requires a reason", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 100, rate: 80, received_date: "2026-01-01" });

    await expect(
      stockService.adjustStock({
        issue_date: "2026-07-11",
        issue_type: "ADJUSTMENT_OUT",
        reason: "",
        items: [{ item_id: item.id, quantity: 10 }],
      })
    ).rejects.toThrow(/reason/i);

    expect(await db.StockIssue.count()).toBe(0);
  });

  it("ADJUSTMENT_OUT cannot drive stock negative", async () => {
    const item = await createItem();
    await givenBatch(item, { quantity: 100, rate: 80, received_date: "2026-01-01" });

    await expect(
      stockService.adjustStock({
        issue_date: "2026-07-11",
        issue_type: "ADJUSTMENT_OUT",
        reason: "Stock take shortfall",
        items: [{ item_id: item.id, quantity: 150 }],
      })
    ).rejects.toThrow(stockService.InsufficientStockError);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBe(100);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd backend && npm test -- stockService.adjust`
Expected: FAIL — `stockService.adjustStock is not a function`.

- [ ] **Step 3: Implement `adjustStock`**

Add to `backend/src/services/stockService.js`:

```js
/**
 * Stock corrections: stock-take differences and damage.
 *
 *   ADJUSTMENT_OUT — consumes FIFO, exactly like an issue.
 *   ADJUSTMENT_IN  — creates a NEW batch, rated at the item's most recent batch
 *                    rate (or 0 if the item has never been received).
 *
 * `reason` is mandatory. An unexplained stock correction is worthless six
 * months later, when someone is trying to work out where the material went.
 */
const adjustStock = async ({ issue_date, issue_type, reason, notes = null, items }) => {
  if (!["ADJUSTMENT_IN", "ADJUSTMENT_OUT"].includes(issue_type)) {
    throw new Error("Adjustment type must be ADJUSTMENT_IN or ADJUSTMENT_OUT");
  }
  if (!reason || !reason.trim()) {
    throw new Error("A reason is required for a stock adjustment");
  }
  if (!items || items.length === 0) {
    throw new Error("A stock adjustment must have at least one item");
  }

  // Outward adjustments are just an issue with a different movement type.
  if (issue_type === "ADJUSTMENT_OUT") {
    return issueStockInternal({ issue_date, issue_type, reason, notes, items });
  }

  return db.sequelize.transaction(async (transaction) => {
    const year = new Date(issue_date).getFullYear();
    const issueNumber = await generateDocumentNumber(
      db.StockIssue,
      "issue_number",
      "ISS",
      year,
      transaction
    );

    const issue = await db.StockIssue.create(
      { issue_number: issueNumber, issue_date, issue_type, reason, notes },
      { transaction }
    );

    for (const line of items) {
      const quantity = parseFloat(line.quantity);
      if (!(quantity > 0)) {
        throw new Error("Adjustment quantity must be greater than zero");
      }

      const item = await db.InventoryItem.findByPk(line.item_id, { transaction });
      if (!item) {
        throw new Error(`Inventory item not found: ${line.item_id}`);
      }

      // Value the found stock at the newest known rate for this item.
      const newest = await db.StockBatch.findOne({
        where: { item_id: item.id },
        order: [
          ["received_date", "DESC"],
          ["created_at", "DESC"],
        ],
        transaction,
      });
      const rate = newest ? parseFloat(newest.rate) : 0;

      const batch = await db.StockBatch.create(
        {
          item_id: item.id,
          goods_receipt_item_id: null, // no receipt — this stock was found, not bought
          received_date: issue_date,
          quantity_received: quantity,
          quantity_remaining: quantity,
          rate,
        },
        { transaction }
      );

      await db.StockMovement.create(
        {
          item_id: item.id,
          movement_type: "ADJUSTMENT_IN",
          quantity, // positive: into stock
          stock_batch_id: batch.id,
          unit_cost: rate,
          total_cost: quantity * rate,
          reference_type: "STOCK_ADJUSTMENT",
          reference_id: issue.id,
          movement_date: issue_date,
          notes: reason,
        },
        { transaction }
      );

      await db.StockIssueItem.create(
        {
          stock_issue_id: issue.id,
          item_id: item.id,
          quantity,
          total_cost: quantity * rate,
        },
        { transaction }
      );
    }

    return db.StockIssue.findByPk(issue.id, {
      include: [{ model: db.StockIssueItem, as: "items" }],
      transaction,
    });
  });
};
```

`ADJUSTMENT_OUT` delegates to the issue path. Rename the existing `issueStock` **implementation** to `issueStockInternal`, and make `issueStock` a thin wrapper that forces the type — so a caller cannot sneak an adjustment through the issue endpoint and skip the mandatory reason:

```js
/** Public issue entry point: production consumption and pure wastage only. */
const issueStock = async (payload) => {
  const type = payload.issue_type || "ISSUE";
  if (!["ISSUE", "WASTAGE"].includes(type)) {
    throw new Error("issueStock only handles ISSUE and WASTAGE. Use adjustStock for adjustments.");
  }
  return issueStockInternal({ ...payload, issue_type: type });
};
```

In `issueStockInternal`, the movement type for the consumption leg becomes:
```js
      const consumptionType = issue_type === "ISSUE" ? "ISSUE" : issue_type;
```
so `WASTAGE` and `ADJUSTMENT_OUT` documents write movements of their own type.

Final exports:
```js
module.exports = {
  InsufficientStockError,
  getStockOnHand,
  receiveStock,
  recomputePurchaseOrderStatus,
  issueStock,
  adjustStock,
};
```

- [ ] **Step 4: Run and verify**

Run: `cd backend && npm test -- stockService.adjust`
Expected: 5 passing.

Then run the whole suite to be sure the `issueStock` refactor broke nothing:
Run: `cd backend && npm test`
Expected: all suites pass (documentNumber 3, stock 3, receive 7, issue 10, adjust 5).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/stockService.js backend/tests/stockService.adjust.test.js
git commit -m "feat(inventory): stockService.adjustStock for stock-take and damage"
```

### Task 3.6: The reconciliation invariant

**Files:**
- Create: `backend/tests/stockService.invariant.test.js`

The single most valuable test in the suite. It asserts the property the whole design rests on: **batch remainders and the movement ledger always agree.** If a future change breaks that, this catches it.

- [ ] **Step 1: Write the test**

`backend/tests/stockService.invariant.test.js`:
```js
"use strict";

const db = require("../src/models");
const stockService = require("../src/services/stockService");
const { createItem, createSupplier } = require("./helpers/factories");

/** SUM(batch.quantity_remaining) must always equal SUM(movement.quantity). */
const assertReconciled = async (itemId) => {
  const batches = await db.StockBatch.findAll({ where: { item_id: itemId } });
  const movements = await db.StockMovement.findAll({ where: { item_id: itemId } });

  const batchTotal = batches.reduce((sum, b) => sum + parseFloat(b.quantity_remaining), 0);
  const ledgerTotal = movements.reduce((sum, m) => sum + parseFloat(m.quantity), 0);

  expect(batchTotal).toBeCloseTo(ledgerTotal, 2);
  return batchTotal;
};

describe("stock invariant: batches reconcile with the movement ledger", () => {
  it("holds across a full receive → issue → waste → adjust lifecycle", async () => {
    const item = await createItem();
    const supplier = await createSupplier();

    await stockService.receiveStock({
      supplier_id: supplier.id,
      receipt_date: "2026-01-01",
      items: [{ item_id: item.id, quantity_received: 300, rate: 80 }],
    });
    await assertReconciled(item.id);

    await stockService.receiveStock({
      supplier_id: supplier.id,
      receipt_date: "2026-02-01",
      items: [{ item_id: item.id, quantity_received: 400, rate: 90 }],
    });
    await assertReconciled(item.id);

    // Consumption that crosses a batch boundary, plus wastage.
    await stockService.issueStock({
      issue_date: "2026-03-01",
      items: [{ item_id: item.id, quantity: 350, wastage_quantity: 15 }],
    });
    await assertReconciled(item.id);

    await stockService.adjustStock({
      issue_date: "2026-04-01",
      issue_type: "ADJUSTMENT_OUT",
      reason: "Water damage",
      items: [{ item_id: item.id, quantity: 25 }],
    });
    await assertReconciled(item.id);

    await stockService.adjustStock({
      issue_date: "2026-05-01",
      issue_type: "ADJUSTMENT_IN",
      reason: "Stock take surplus",
      items: [{ item_id: item.id, quantity: 10 }],
    });

    const total = await assertReconciled(item.id);

    // 300 + 400 - 350 - 15 - 25 + 10
    expect(total).toBeCloseTo(320, 2);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBeCloseTo(320, 2);
  });

  it("a failed issue leaves the ledger and the batches reconciled", async () => {
    const item = await createItem();
    const supplier = await createSupplier();

    await stockService.receiveStock({
      supplier_id: supplier.id,
      receipt_date: "2026-01-01",
      items: [{ item_id: item.id, quantity_received: 100, rate: 80 }],
    });

    await expect(
      stockService.issueStock({
        issue_date: "2026-03-01",
        items: [{ item_id: item.id, quantity: 500 }],
      })
    ).rejects.toThrow(stockService.InsufficientStockError);

    const total = await assertReconciled(item.id);
    expect(total).toBeCloseTo(100, 2);
  });

  it("concurrent issues of the same item cannot double-spend a batch", async () => {
    const item = await createItem();
    const supplier = await createSupplier();

    await stockService.receiveStock({
      supplier_id: supplier.id,
      receipt_date: "2026-01-01",
      items: [{ item_id: item.id, quantity_received: 100, rate: 80 }],
    });

    // Two issues of 60 fired at once against 100 units of stock.
    // Exactly one must win; the other must fail. 60 + 60 = 120 > 100.
    const results = await Promise.allSettled([
      stockService.issueStock({ issue_date: "2026-03-01", items: [{ item_id: item.id, quantity: 60 }] }),
      stockService.issueStock({ issue_date: "2026-03-01", items: [{ item_id: item.id, quantity: 60 }] }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const stock = await stockService.getStockOnHand(item.id);
    expect(stock.quantity).toBeCloseTo(40, 2); // never negative
    await assertReconciled(item.id);
  });
});
```

- [ ] **Step 2: Run**

Run: `cd backend && npm test -- stockService.invariant`
Expected: 3 passing.

The concurrency test is the one that proves the row locking works. If it fails with *both* issues succeeding and stock at `-20`, the `lock: transaction.LOCK.UPDATE` in `getLockedStockOnHand` is missing or the availability check is happening outside the lock.

- [ ] **Step 3: Full suite**

Run: `cd backend && npm test`
Expected: 28 passing, 0 failing.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/stockService.invariant.test.js
git commit -m "test(inventory): reconciliation invariant and concurrent-issue safety"
```

---

# Phase 4 — Pagination and master CRUD

### Task 4.1: Shared pagination utility

**Files:**
- Create: `backend/src/utils/pagination.js`
- Create: `backend/tests/pagination.test.js`

No existing endpoint paginates — they all return every row and let the frontend slice. That does not work for a movement ledger. This utility is the one place pagination is defined.

- [ ] **Step 1: Write the failing test**

`backend/tests/pagination.test.js`:
```js
"use strict";

const { getPagination, buildPaginatedResponse } = require("../src/utils/pagination");

describe("getPagination", () => {
  it("defaults to page 1, limit 20", () => {
    expect(getPagination({})).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it("computes the offset from the page", () => {
    expect(getPagination({ page: "3", limit: "10" })).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it("clamps a silly limit", () => {
    expect(getPagination({ limit: "5000" }).limit).toBe(100);
  });

  it("ignores garbage input", () => {
    expect(getPagination({ page: "abc", limit: "-4" })).toEqual({ page: 1, limit: 20, offset: 0 });
  });
});

describe("buildPaginatedResponse", () => {
  it("wraps rows with pagination metadata", () => {
    const result = buildPaginatedResponse([{ id: 1 }], 45, { page: 2, limit: 20 });
    expect(result).toEqual({
      data: [{ id: 1 }],
      pagination: { page: 2, limit: 20, total: 45, totalPages: 3 },
    });
  });

  it("reports one page when there are no rows", () => {
    expect(buildPaginatedResponse([], 0, { page: 1, limit: 20 }).pagination.totalPages).toBe(0);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd backend && npm test -- pagination`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`backend/src/utils/pagination.js`:
```js
"use strict";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse page/limit query params into Sequelize's limit/offset.
 * Bad input silently falls back to the defaults — a broken query string
 * should not 500 the API.
 */
const getPagination = ({ page, limit } = {}) => {
  let parsedPage = parseInt(page, 10);
  let parsedLimit = parseInt(limit, 10);

  if (!Number.isInteger(parsedPage) || parsedPage < 1) parsedPage = 1;
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) parsedLimit = DEFAULT_LIMIT;
  if (parsedLimit > MAX_LIMIT) parsedLimit = MAX_LIMIT;

  return { page: parsedPage, limit: parsedLimit, offset: (parsedPage - 1) * parsedLimit };
};

/** Standard envelope for every paginated list endpoint. */
const buildPaginatedResponse = (rows, total, { page, limit }) => ({
  data: rows,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  },
});

module.exports = { getPagination, buildPaginatedResponse };
```

- [ ] **Step 4: Run and verify**

Run: `cd backend && npm test -- pagination`
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/pagination.js backend/tests/pagination.test.js
git commit -m "feat(backend): shared server-side pagination utility"
```

### Task 4.2: Inventory category CRUD

**Files:**
- Create: `backend/src/controllers/inventoryCategoryController.js`
- Create: `backend/src/routes/inventoryCategoryRoutes.js`

Modelled directly on `expenseCategoryController.js`, including the delete guard.

- [ ] **Step 1: Controller**

```js
"use strict";

const { InventoryCategory, InventoryItem } = require("../models");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");

const createInventoryCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return error(res, 400, "Category name is required");
    }

    const existing = await InventoryCategory.findOne({
      where: { name: { [Op.iLike]: name }, is_archived: false },
    });

    if (existing) {
      return error(res, 400, "A category with this name already exists");
    }

    const category = await InventoryCategory.create({ name });

    return success(res, 201, "Inventory category created successfully", category);
  } catch (err) {
    console.error("Error creating inventory category:", err);
    return error(res, 500, "Failed to create inventory category", err.message);
  }
};

const getAllInventoryCategories = async (req, res) => {
  try {
    const { name } = req.query;
    const whereClause = { is_archived: false };

    if (name) {
      whereClause.name = { [Op.iLike]: `%${name}%` };
    }

    const categories = await InventoryCategory.findAll({
      where: whereClause,
      order: [["name", "ASC"]],
    });

    return success(res, 200, "Inventory categories retrieved successfully", categories);
  } catch (err) {
    console.error("Error retrieving inventory categories:", err);
    return error(res, 500, "Failed to retrieve inventory categories", err.message);
  }
};

const getInventoryCategoryById = async (req, res) => {
  try {
    const category = await InventoryCategory.findOne({
      where: { id: req.params.id, is_archived: false },
    });

    if (!category) {
      return error(res, 404, "Inventory category not found");
    }

    return success(res, 200, "Inventory category retrieved successfully", category);
  } catch (err) {
    console.error("Error retrieving inventory category:", err);
    return error(res, 500, "Failed to retrieve inventory category", err.message);
  }
};

const updateInventoryCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return error(res, 400, "Category name is required");
    }

    const category = await InventoryCategory.findOne({ where: { id, is_archived: false } });

    if (!category) {
      return error(res, 404, "Inventory category not found");
    }

    const duplicate = await InventoryCategory.findOne({
      where: { name: { [Op.iLike]: name }, id: { [Op.ne]: id }, is_archived: false },
    });

    if (duplicate) {
      return error(res, 400, "Another category with this name already exists");
    }

    await category.update({ name });

    return success(res, 200, "Inventory category updated successfully", category);
  } catch (err) {
    console.error("Error updating inventory category:", err);
    return error(res, 500, "Failed to update inventory category", err.message);
  }
};

const deleteInventoryCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await InventoryCategory.findOne({ where: { id, is_archived: false } });

    if (!category) {
      return error(res, 404, "Inventory category not found");
    }

    // Never orphan an item by deleting its category.
    const itemCount = await InventoryItem.count({
      where: { category_id: id, is_archived: false },
    });

    if (itemCount > 0) {
      return error(res, 400, "Cannot delete this category as it is being used by inventory items");
    }

    await category.update({ is_archived: true });

    return success(res, 200, "Inventory category deleted successfully");
  } catch (err) {
    console.error("Error deleting inventory category:", err);
    return error(res, 500, "Failed to delete inventory category", err.message);
  }
};

module.exports = {
  createInventoryCategory,
  getAllInventoryCategories,
  getInventoryCategoryById,
  updateInventoryCategory,
  deleteInventoryCategory,
};
```

- [ ] **Step 2: Routes**

`backend/src/routes/inventoryCategoryRoutes.js`:
```js
"use strict";

const express = require("express");
const router = express.Router();
const controller = require("../controllers/inventoryCategoryController");

router.post("/", controller.createInventoryCategory);
router.get("/", controller.getAllInventoryCategories);
router.get("/:id", controller.getInventoryCategoryById);
router.put("/:id", controller.updateInventoryCategory);
router.delete("/:id", controller.deleteInventoryCategory);

module.exports = router;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/inventoryCategoryController.js backend/src/routes/inventoryCategoryRoutes.js
git commit -m "feat(inventory): inventory category CRUD"
```

### Task 4.3: Supplier CRUD

**Files:**
- Create: `backend/src/controllers/supplierController.js`
- Create: `backend/src/routes/supplierRoutes.js`

- [ ] **Step 1: Controller**

```js
"use strict";

const { Supplier, PurchaseOrder, GoodsReceipt } = require("../models");
const { success, error } = require("../utils/response");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
const { Op } = require("sequelize");

const createSupplier = async (req, res) => {
  try {
    const { name, phone, email, gst_number, address } = req.body;

    if (!name) {
      return error(res, 400, "Supplier name is required");
    }

    const supplier = await Supplier.create({
      name,
      phone: phone || null,
      email: email || null,
      gst_number: gst_number || null,
      address: address || null,
    });

    return success(res, 201, "Supplier created successfully", supplier);
  } catch (err) {
    console.error("Error creating supplier:", err);
    return error(res, 500, "Failed to create supplier", err.message);
  }
};

const getAllSuppliers = async (req, res) => {
  try {
    const { search, all } = req.query;
    const whereClause = { is_archived: false };

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { gst_number: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // `all=true` skips pagination — used to populate dropdowns.
    if (all === "true") {
      const suppliers = await Supplier.findAll({ where: whereClause, order: [["name", "ASC"]] });
      return success(res, 200, "Suppliers retrieved successfully", suppliers);
    }

    const pagination = getPagination(req.query);

    const { rows, count } = await Supplier.findAndCountAll({
      where: whereClause,
      order: [["name", "ASC"]],
      limit: pagination.limit,
      offset: pagination.offset,
    });

    return success(
      res,
      200,
      "Suppliers retrieved successfully",
      buildPaginatedResponse(rows, count, pagination)
    );
  } catch (err) {
    console.error("Error retrieving suppliers:", err);
    return error(res, 500, "Failed to retrieve suppliers", err.message);
  }
};

const getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      where: { id: req.params.id, is_archived: false },
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrders",
          where: { is_archived: false },
          required: false,
          separate: true,
          order: [["order_date", "DESC"]],
          limit: 20,
        },
      ],
    });

    if (!supplier) {
      return error(res, 404, "Supplier not found");
    }

    return success(res, 200, "Supplier retrieved successfully", supplier);
  } catch (err) {
    console.error("Error retrieving supplier:", err);
    return error(res, 500, "Failed to retrieve supplier", err.message);
  }
};

const updateSupplier = async (req, res) => {
  try {
    const { name, phone, email, gst_number, address } = req.body;

    const supplier = await Supplier.findOne({
      where: { id: req.params.id, is_archived: false },
    });

    if (!supplier) {
      return error(res, 404, "Supplier not found");
    }

    if (!name) {
      return error(res, 400, "Supplier name is required");
    }

    await supplier.update({
      name,
      phone: phone ?? supplier.phone,
      email: email ?? supplier.email,
      gst_number: gst_number ?? supplier.gst_number,
      address: address ?? supplier.address,
    });

    return success(res, 200, "Supplier updated successfully", supplier);
  } catch (err) {
    console.error("Error updating supplier:", err);
    return error(res, 500, "Failed to update supplier", err.message);
  }
};

const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findOne({ where: { id, is_archived: false } });

    if (!supplier) {
      return error(res, 404, "Supplier not found");
    }

    const poCount = await PurchaseOrder.count({ where: { supplier_id: id, is_archived: false } });
    const receiptCount = await GoodsReceipt.count({ where: { supplier_id: id, is_archived: false } });

    if (poCount > 0 || receiptCount > 0) {
      return error(
        res,
        400,
        "Cannot delete this supplier as it is being used by purchase orders or goods receipts"
      );
    }

    await supplier.update({ is_archived: true });

    return success(res, 200, "Supplier deleted successfully");
  } catch (err) {
    console.error("Error deleting supplier:", err);
    return error(res, 500, "Failed to delete supplier", err.message);
  }
};

module.exports = {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
};
```

- [ ] **Step 2: Routes**

`backend/src/routes/supplierRoutes.js`:
```js
"use strict";

const express = require("express");
const router = express.Router();
const controller = require("../controllers/supplierController");

router.post("/", controller.createSupplier);
router.get("/", controller.getAllSuppliers);
router.get("/:id", controller.getSupplierById);
router.put("/:id", controller.updateSupplier);
router.delete("/:id", controller.deleteSupplier);

module.exports = router;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/supplierController.js backend/src/routes/supplierRoutes.js
git commit -m "feat(inventory): supplier CRUD with pagination"
```

### Task 4.4: Inventory item CRUD

**Files:**
- Create: `backend/src/controllers/inventoryItemController.js`
- Create: `backend/src/routes/inventoryItemRoutes.js`

- [ ] **Step 1: Controller**

```js
"use strict";

const {
  InventoryItem,
  InventoryCategory,
  ItemAttribute,
  ItemAttributeValue,
  InventoryItemAttributeValue,
  StockBatch,
  PurchaseOrderItem,
  sequelize,
} = require("../models");
const { success, error } = require("../utils/response");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
const { Op } = require("sequelize");

const VALID_UNITS = ["KG", "PCS", "METRE", "ROLL", "LITRE"];

const ITEM_INCLUDES = [
  { model: InventoryCategory, as: "category", attributes: ["id", "name"] },
  {
    model: InventoryItemAttributeValue,
    as: "attributeValues",
    include: [
      { model: ItemAttribute, as: "attribute", attributes: ["id", "name"] },
      { model: ItemAttributeValue, as: "value", attributes: ["id", "value"] },
    ],
  },
];

/** Flatten the nested link rows into a friendly `attributes` array on the response. */
const withAttributes = (item) => {
  const plain = item.toJSON();
  plain.attributes = (plain.attributeValues || []).map((link) => ({
    attribute_id: link.attribute.id,
    attribute_name: link.attribute.name,
    value_id: link.value.id,
    value: link.value.value,
  }));
  delete plain.attributeValues;
  return plain;
};

/**
 * Validate a set of attribute_value_ids: every value must exist and be
 * non-archived, and no two values may belong to the same attribute — an item
 * holds at most ONE value per attribute. The DB unique constraint on the link
 * table is the backstop; this produces the friendly error. Because the link
 * row carries a denormalised attribute_id, the values are loaded here so the
 * link rows are written with the attribute the value ACTUALLY belongs to —
 * a client cannot claim "W Cut" is a GSM.
 *
 * @returns the loaded ItemAttributeValue rows (with their attribute)
 * @throws Error with a user-facing message on any violation
 */
const resolveAttributeValues = async (attributeValueIds) => {
  const ids = [...new Set(attributeValueIds)];

  const values = await ItemAttributeValue.findAll({
    where: { id: { [Op.in]: ids }, is_archived: false },
    include: [
      { model: ItemAttribute, as: "attribute", attributes: ["id", "name"], where: { is_archived: false } },
    ],
  });

  if (values.length !== ids.length) {
    throw new Error("One or more attribute values are invalid or archived");
  }

  const seenAttributes = new Set();
  for (const value of values) {
    if (seenAttributes.has(value.attribute_id)) {
      throw new Error(`Only one ${value.attribute.name} value can be chosen per item`);
    }
    seenAttributes.add(value.attribute_id);
  }

  return values;
};

const createInventoryItem = async (req, res) => {
  try {
    const { name, item_code, category_id, unit, reorder_level, reorder_target, notes, attribute_value_ids } = req.body;

    if (!name || !category_id || !unit) {
      return error(res, 400, "Name, category, and unit are required");
    }

    if (!VALID_UNITS.includes(unit)) {
      return error(res, 400, `Unit must be one of: ${VALID_UNITS.join(", ")}`);
    }

    const category = await InventoryCategory.findOne({
      where: { id: category_id, is_archived: false },
    });

    if (!category) {
      return error(res, 400, "Invalid inventory category");
    }

    let attributeValues = [];
    if (attribute_value_ids && attribute_value_ids.length > 0) {
      try {
        attributeValues = await resolveAttributeValues(attribute_value_ids);
      } catch (validationErr) {
        return error(res, 400, validationErr.message);
      }
    }

    const item = await sequelize.transaction(async (transaction) => {
      const created = await InventoryItem.create(
        {
          name,
          item_code: item_code || null,
          category_id,
          unit,
          reorder_level: reorder_level || 0,
          reorder_target: reorder_target || null,
          notes: notes || null,
        },
        { transaction }
      );

      for (const value of attributeValues) {
        await InventoryItemAttributeValue.create(
          {
            item_id: created.id,
            attribute_id: value.attribute_id, // from the value row, never from the client
            attribute_value_id: value.id,
          },
          { transaction }
        );
      }

      return created;
    });

    const created = await InventoryItem.findByPk(item.id, { include: ITEM_INCLUDES });

    return success(res, 201, "Inventory item created successfully", withAttributes(created));
  } catch (err) {
    console.error("Error creating inventory item:", err);
    return error(res, 500, "Failed to create inventory item", err.message);
  }
};

const getAllInventoryItems = async (req, res) => {
  try {
    const { search, category_id, attribute_value_id, all } = req.query;
    const whereClause = { is_archived: false };

    if (category_id) {
      whereClause.category_id = category_id;
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { item_code: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Filter to items carrying one specific attribute value (e.g. all W Cut).
    if (attribute_value_id) {
      const links = await InventoryItemAttributeValue.findAll({
        where: { attribute_value_id },
        attributes: ["item_id"],
      });
      whereClause.id = { [Op.in]: links.map((link) => link.item_id) };
    }

    // `all=true` skips pagination — used to populate item pickers.
    if (all === "true") {
      const items = await InventoryItem.findAll({
        where: whereClause,
        include: ITEM_INCLUDES,
        order: [["name", "ASC"]],
      });
      return success(res, 200, "Inventory items retrieved successfully", items.map(withAttributes));
    }

    const pagination = getPagination(req.query);

    const { rows, count } = await InventoryItem.findAndCountAll({
      where: whereClause,
      include: ITEM_INCLUDES,
      order: [["name", "ASC"]],
      limit: pagination.limit,
      offset: pagination.offset,
      distinct: true, // the attributeValues include would inflate `count` otherwise
    });

    return success(
      res,
      200,
      "Inventory items retrieved successfully",
      buildPaginatedResponse(rows.map(withAttributes), count, pagination)
    );
  } catch (err) {
    console.error("Error retrieving inventory items:", err);
    return error(res, 500, "Failed to retrieve inventory items", err.message);
  }
};

const getInventoryItemById = async (req, res) => {
  try {
    const item = await InventoryItem.findOne({
      where: { id: req.params.id, is_archived: false },
      include: ITEM_INCLUDES,
    });

    if (!item) {
      return error(res, 404, "Inventory item not found");
    }

    return success(res, 200, "Inventory item retrieved successfully", withAttributes(item));
  } catch (err) {
    console.error("Error retrieving inventory item:", err);
    return error(res, 500, "Failed to retrieve inventory item", err.message);
  }
};

const updateInventoryItem = async (req, res) => {
  try {
    const { name, item_code, category_id, unit, reorder_level, reorder_target, notes, attribute_value_ids } = req.body;

    const item = await InventoryItem.findOne({
      where: { id: req.params.id, is_archived: false },
    });

    if (!item) {
      return error(res, 404, "Inventory item not found");
    }

    if (unit && !VALID_UNITS.includes(unit)) {
      return error(res, 400, `Unit must be one of: ${VALID_UNITS.join(", ")}`);
    }

    if (category_id) {
      const category = await InventoryCategory.findOne({
        where: { id: category_id, is_archived: false },
      });
      if (!category) {
        return error(res, 400, "Invalid inventory category");
      }
    }

    // undefined = leave attributes alone; an array (even []) = replace them.
    let attributeValues = null;
    if (attribute_value_ids !== undefined) {
      try {
        attributeValues = attribute_value_ids.length > 0 ? await resolveAttributeValues(attribute_value_ids) : [];
      } catch (validationErr) {
        return error(res, 400, validationErr.message);
      }
    }

    await sequelize.transaction(async (transaction) => {
      await item.update(
        {
          name: name ?? item.name,
          item_code: item_code ?? item.item_code,
          category_id: category_id ?? item.category_id,
          unit: unit ?? item.unit,
          reorder_level: reorder_level ?? item.reorder_level,
          reorder_target: reorder_target ?? item.reorder_target,
          notes: notes ?? item.notes,
        },
        { transaction }
      );

      if (attributeValues !== null) {
        await InventoryItemAttributeValue.destroy({ where: { item_id: item.id }, transaction });

        for (const value of attributeValues) {
          await InventoryItemAttributeValue.create(
            {
              item_id: item.id,
              attribute_id: value.attribute_id,
              attribute_value_id: value.id,
            },
            { transaction }
          );
        }
      }
    });

    const updated = await InventoryItem.findByPk(item.id, { include: ITEM_INCLUDES });

    return success(res, 200, "Inventory item updated successfully", withAttributes(updated));
  } catch (err) {
    console.error("Error updating inventory item:", err);
    return error(res, 500, "Failed to update inventory item", err.message);
  }
};

const deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await InventoryItem.findOne({ where: { id, is_archived: false } });

    if (!item) {
      return error(res, 404, "Inventory item not found");
    }

    // Refuse to archive an item that still physically exists in stock — that
    // would silently make the stock value wrong.
    const batches = await StockBatch.findAll({
      where: { item_id: id, quantity_remaining: { [Op.gt]: 0 } },
    });

    if (batches.length > 0) {
      return error(res, 400, "Cannot delete this item as it still has stock on hand");
    }

    // Comparing two COLUMNS, not a column to a value. Op.lt with col() does not
    // do this reliably in Sequelize 6 — use an explicit literal.
    const openPoLines = await PurchaseOrderItem.count({
      where: {
        item_id: id,
        [Op.and]: [sequelize.literal("quantity_received < quantity_ordered")],
      },
    });

    if (openPoLines > 0) {
      return error(res, 400, "Cannot delete this item as it is on an open purchase order");
    }

    await item.update({ is_archived: true });

    return success(res, 200, "Inventory item deleted successfully");
  } catch (err) {
    console.error("Error deleting inventory item:", err);
    return error(res, 500, "Failed to delete inventory item", err.message);
  }
};

module.exports = {
  createInventoryItem,
  getAllInventoryItems,
  getInventoryItemById,
  updateInventoryItem,
  deleteInventoryItem,
};
```

- [ ] **Step 2: Routes**

`backend/src/routes/inventoryItemRoutes.js`:
```js
"use strict";

const express = require("express");
const router = express.Router();
const controller = require("../controllers/inventoryItemController");

router.post("/", controller.createInventoryItem);
router.get("/", controller.getAllInventoryItems);
router.get("/:id", controller.getInventoryItemById);
router.put("/:id", controller.updateInventoryItem);
router.delete("/:id", controller.deleteInventoryItem);

module.exports = router;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/inventoryItemController.js backend/src/routes/inventoryItemRoutes.js
git commit -m "feat(inventory): inventory item CRUD with stock-on-hand delete guard"
```

### Task 4.5: Item attribute CRUD

**Files:**
- Create: `backend/src/controllers/itemAttributeController.js`
- Create: `backend/src/routes/itemAttributeRoutes.js`

Modelled on Task 4.2's category controller, with the same in-use delete guards, applied at both levels: an attribute cannot be deleted while any non-archived item uses one of its values, and a single value cannot be deleted while any non-archived item uses it. The list endpoint is **not paginated** — this is a small master list, and the item forms need all of it at once anyway.

- [ ] **Step 1: Controller**

```js
"use strict";

const {
  ItemAttribute,
  ItemAttributeValue,
  InventoryItemAttributeValue,
  InventoryItem,
} = require("../models");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");

/** Count non-archived items still using any of these value ids. */
const countItemsUsingValues = async (valueIds) => {
  if (valueIds.length === 0) return 0;

  return InventoryItemAttributeValue.count({
    where: { attribute_value_id: { [Op.in]: valueIds } },
    include: [{ model: InventoryItem, as: "item", where: { is_archived: false }, required: true }],
  });
};

const createItemAttribute = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return error(res, 400, "Attribute name is required");
    }

    const existing = await ItemAttribute.findOne({
      where: { name: { [Op.iLike]: name.trim() }, is_archived: false },
    });

    if (existing) {
      return error(res, 400, "An attribute with this name already exists");
    }

    const attribute = await ItemAttribute.create({ name: name.trim() });

    return success(res, 201, "Item attribute created successfully", attribute);
  } catch (err) {
    console.error("Error creating item attribute:", err);
    return error(res, 500, "Failed to create item attribute", err.message);
  }
};

/** Every non-archived attribute with its non-archived values nested. Not paginated — small master list. */
const getAllItemAttributes = async (req, res) => {
  try {
    const attributes = await ItemAttribute.findAll({
      where: { is_archived: false },
      include: [
        {
          model: ItemAttributeValue,
          as: "values",
          where: { is_archived: false },
          required: false,
          separate: true,
          order: [["value", "ASC"]],
        },
      ],
      order: [["name", "ASC"]],
    });

    return success(res, 200, "Item attributes retrieved successfully", attributes);
  } catch (err) {
    console.error("Error retrieving item attributes:", err);
    return error(res, 500, "Failed to retrieve item attributes", err.message);
  }
};

const updateItemAttribute = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return error(res, 400, "Attribute name is required");
    }

    const attribute = await ItemAttribute.findOne({ where: { id, is_archived: false } });

    if (!attribute) {
      return error(res, 404, "Item attribute not found");
    }

    const duplicate = await ItemAttribute.findOne({
      where: { name: { [Op.iLike]: name.trim() }, id: { [Op.ne]: id }, is_archived: false },
    });

    if (duplicate) {
      return error(res, 400, "Another attribute with this name already exists");
    }

    await attribute.update({ name: name.trim() });

    return success(res, 200, "Item attribute updated successfully", attribute);
  } catch (err) {
    console.error("Error updating item attribute:", err);
    return error(res, 500, "Failed to update item attribute", err.message);
  }
};

const deleteItemAttribute = async (req, res) => {
  try {
    const { id } = req.params;

    const attribute = await ItemAttribute.findOne({ where: { id, is_archived: false } });

    if (!attribute) {
      return error(res, 404, "Item attribute not found");
    }

    // Refuse while any live item still carries one of this attribute's values —
    // deleting it would silently strip meaning from those items.
    const values = await ItemAttributeValue.findAll({
      where: { attribute_id: id },
      attributes: ["id"],
    });
    const inUse = await countItemsUsingValues(values.map((value) => value.id));

    if (inUse > 0) {
      return error(res, 400, "Cannot delete this attribute as it is being used by inventory items");
    }

    // Soft-delete the values along with their attribute, so nothing orphaned
    // ever surfaces in a dropdown.
    await ItemAttributeValue.update({ is_archived: true }, { where: { attribute_id: id } });
    await attribute.update({ is_archived: true });

    return success(res, 200, "Item attribute deleted successfully");
  } catch (err) {
    console.error("Error deleting item attribute:", err);
    return error(res, 500, "Failed to delete item attribute", err.message);
  }
};

const createItemAttributeValue = async (req, res) => {
  try {
    const { id } = req.params; // attribute id
    const { value } = req.body;

    if (!value || !String(value).trim()) {
      return error(res, 400, "Value is required");
    }

    const attribute = await ItemAttribute.findOne({ where: { id, is_archived: false } });

    if (!attribute) {
      return error(res, 404, "Item attribute not found");
    }

    const existing = await ItemAttributeValue.findOne({
      where: { attribute_id: id, value: { [Op.iLike]: String(value).trim() }, is_archived: false },
    });

    if (existing) {
      return error(res, 400, `"${String(value).trim()}" already exists under ${attribute.name}`);
    }

    const created = await ItemAttributeValue.create({
      attribute_id: id,
      value: String(value).trim(),
    });

    return success(res, 201, "Attribute value created successfully", created);
  } catch (err) {
    console.error("Error creating attribute value:", err);
    return error(res, 500, "Failed to create attribute value", err.message);
  }
};

const updateItemAttributeValue = async (req, res) => {
  try {
    const { valueId } = req.params;
    const { value } = req.body;

    if (!value || !String(value).trim()) {
      return error(res, 400, "Value is required");
    }

    const attributeValue = await ItemAttributeValue.findOne({
      where: { id: valueId, is_archived: false },
    });

    if (!attributeValue) {
      return error(res, 404, "Attribute value not found");
    }

    const duplicate = await ItemAttributeValue.findOne({
      where: {
        attribute_id: attributeValue.attribute_id,
        value: { [Op.iLike]: String(value).trim() },
        id: { [Op.ne]: valueId },
        is_archived: false,
      },
    });

    if (duplicate) {
      return error(res, 400, "Another value with this name already exists under this attribute");
    }

    await attributeValue.update({ value: String(value).trim() });

    return success(res, 200, "Attribute value updated successfully", attributeValue);
  } catch (err) {
    console.error("Error updating attribute value:", err);
    return error(res, 500, "Failed to update attribute value", err.message);
  }
};

const deleteItemAttributeValue = async (req, res) => {
  try {
    const { valueId } = req.params;

    const attributeValue = await ItemAttributeValue.findOne({
      where: { id: valueId, is_archived: false },
    });

    if (!attributeValue) {
      return error(res, 404, "Attribute value not found");
    }

    const inUse = await countItemsUsingValues([valueId]);

    if (inUse > 0) {
      return error(res, 400, "Cannot delete this value as it is being used by inventory items");
    }

    await attributeValue.update({ is_archived: true });

    return success(res, 200, "Attribute value deleted successfully");
  } catch (err) {
    console.error("Error deleting attribute value:", err);
    return error(res, 500, "Failed to delete attribute value", err.message);
  }
};

module.exports = {
  createItemAttribute,
  getAllItemAttributes,
  updateItemAttribute,
  deleteItemAttribute,
  createItemAttributeValue,
  updateItemAttributeValue,
  deleteItemAttributeValue,
};
```

Renaming an attribute or a value that **is** in use is allowed on purpose — the link rows point at ids, so every item picks up the new spelling instantly. Only deletion is guarded.

- [ ] **Step 2: Routes**

`backend/src/routes/itemAttributeRoutes.js`:
```js
"use strict";

const express = require("express");
const router = express.Router();
const controller = require("../controllers/itemAttributeController");

// Value routes first, for readability — they cannot actually collide with
// /:id (two path segments vs one), but keep the specific ones on top.
router.put("/values/:valueId", controller.updateItemAttributeValue);
router.delete("/values/:valueId", controller.deleteItemAttributeValue);
router.post("/:id/values", controller.createItemAttributeValue);

router.post("/", controller.createItemAttribute);
router.get("/", controller.getAllItemAttributes);
router.put("/:id", controller.updateItemAttribute);
router.delete("/:id", controller.deleteItemAttribute);

module.exports = router;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/itemAttributeController.js backend/src/routes/itemAttributeRoutes.js
git commit -m "feat(inventory): item attribute and value CRUD with in-use delete guards"
```

---

# Phase 5 — Procurement API

### Task 5.1: Purchase order controller

**Files:**
- Create: `backend/src/controllers/purchaseOrderController.js`
- Create: `backend/src/routes/purchaseOrderRoutes.js`

- [ ] **Step 1: Controller**

```js
"use strict";

const {
  PurchaseOrder,
  PurchaseOrderItem,
  InventoryItem,
  Supplier,
  GoodsReceipt,
  GoodsReceiptItem,
  sequelize,
} = require("../models");
const { success, error } = require("../utils/response");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
const { generateDocumentNumber } = require("../services/documentNumber");
const stockService = require("../services/stockService");
const { Op } = require("sequelize");

const PO_INCLUDES = [
  { model: Supplier, as: "supplier", attributes: ["id", "name", "phone"] },
  {
    model: PurchaseOrderItem,
    as: "items",
    include: [{ model: InventoryItem, as: "item", attributes: ["id", "name", "unit", "item_code"] }],
  },
];

const createPurchaseOrder = async (req, res) => {
  try {
    const { supplier_id, order_date, expected_date, notes, items } = req.body;

    if (!supplier_id || !order_date) {
      return error(res, 400, "Supplier and order date are required");
    }

    if (!items || items.length === 0) {
      return error(res, 400, "A purchase order must have at least one item");
    }

    const supplier = await Supplier.findOne({ where: { id: supplier_id, is_archived: false } });
    if (!supplier) {
      return error(res, 400, "Invalid supplier");
    }

    const purchaseOrder = await sequelize.transaction(async (transaction) => {
      const year = new Date(order_date).getFullYear();
      const poNumber = await generateDocumentNumber(
        PurchaseOrder,
        "po_number",
        "PO",
        year,
        transaction
      );

      const po = await PurchaseOrder.create(
        {
          po_number: poNumber,
          supplier_id,
          order_date,
          expected_date: expected_date || null,
          notes: notes || null,
        },
        { transaction }
      );

      for (const line of items) {
        if (!(parseFloat(line.quantity_ordered) > 0)) {
          throw new Error("Ordered quantity must be greater than zero");
        }

        await PurchaseOrderItem.create(
          {
            purchase_order_id: po.id,
            item_id: line.item_id,
            quantity_ordered: parseFloat(line.quantity_ordered),
            rate: parseFloat(line.rate),
          },
          { transaction }
        );
      }

      return po;
    });

    const created = await PurchaseOrder.findByPk(purchaseOrder.id, { include: PO_INCLUDES });

    return success(res, 201, "Purchase order created successfully", created);
  } catch (err) {
    console.error("Error creating purchase order:", err);
    return error(res, 500, "Failed to create purchase order", err.message);
  }
};

const getAllPurchaseOrders = async (req, res) => {
  try {
    const { search, supplier_id, status, from_date, to_date } = req.query;
    const whereClause = { is_archived: false };

    if (supplier_id) whereClause.supplier_id = supplier_id;
    if (status) whereClause.status = status;

    if (from_date && to_date) {
      whereClause.order_date = { [Op.between]: [from_date, to_date] };
    } else if (from_date) {
      whereClause.order_date = { [Op.gte]: from_date };
    } else if (to_date) {
      whereClause.order_date = { [Op.lte]: to_date };
    }

    if (search) {
      whereClause.po_number = { [Op.iLike]: `%${search}%` };
    }

    const pagination = getPagination(req.query);

    const { rows, count } = await PurchaseOrder.findAndCountAll({
      where: whereClause,
      include: PO_INCLUDES,
      order: [["order_date", "DESC"], ["created_at", "DESC"]],
      limit: pagination.limit,
      offset: pagination.offset,
      distinct: true, // without this, the include inflates `count`
    });

    // Attach a total value per PO for the list view.
    const data = rows.map((po) => {
      const plain = po.toJSON();
      plain.total_amount = plain.items.reduce(
        (sum, line) => sum + parseFloat(line.quantity_ordered) * parseFloat(line.rate),
        0
      );
      return plain;
    });

    return success(
      res,
      200,
      "Purchase orders retrieved successfully",
      buildPaginatedResponse(data, count, pagination)
    );
  } catch (err) {
    console.error("Error retrieving purchase orders:", err);
    return error(res, 500, "Failed to retrieve purchase orders", err.message);
  }
};

const getPurchaseOrderById = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({
      where: { id: req.params.id, is_archived: false },
      include: [
        ...PO_INCLUDES,
        {
          model: GoodsReceipt,
          as: "receipts",
          where: { is_archived: false },
          required: false,
          include: [{ model: GoodsReceiptItem, as: "items" }],
        },
      ],
    });

    if (!po) {
      return error(res, 404, "Purchase order not found");
    }

    const plain = po.toJSON();
    plain.total_amount = plain.items.reduce(
      (sum, line) => sum + parseFloat(line.quantity_ordered) * parseFloat(line.rate),
      0
    );
    // Per-line shortfall drives the "ordered vs received" view.
    plain.items = plain.items.map((line) => ({
      ...line,
      quantity_pending: Math.max(
        0,
        parseFloat(line.quantity_ordered) - parseFloat(line.quantity_received)
      ),
    }));

    return success(res, 200, "Purchase order retrieved successfully", plain);
  } catch (err) {
    console.error("Error retrieving purchase order:", err);
    return error(res, 500, "Failed to retrieve purchase order", err.message);
  }
};

const updatePurchaseOrder = async (req, res) => {
  try {
    const { supplier_id, order_date, expected_date, notes, status, items } = req.body;

    const po = await PurchaseOrder.findOne({
      where: { id: req.params.id, is_archived: false },
      include: [{ model: PurchaseOrderItem, as: "items" }],
    });

    if (!po) {
      return error(res, 404, "Purchase order not found");
    }

    // Once material has arrived, the lines are history — editing them would
    // desync quantity_received from the batches that were actually created.
    const hasReceipts = po.items.some((line) => parseFloat(line.quantity_received) > 0);

    if (items && hasReceipts) {
      return error(
        res,
        400,
        "Cannot change the items on a purchase order that has already received material"
      );
    }

    await sequelize.transaction(async (transaction) => {
      await po.update(
        {
          supplier_id: supplier_id ?? po.supplier_id,
          order_date: order_date ?? po.order_date,
          expected_date: expected_date ?? po.expected_date,
          notes: notes ?? po.notes,
          status: status ?? po.status,
        },
        { transaction }
      );

      if (items && !hasReceipts) {
        await PurchaseOrderItem.destroy({ where: { purchase_order_id: po.id }, transaction });

        for (const line of items) {
          await PurchaseOrderItem.create(
            {
              purchase_order_id: po.id,
              item_id: line.item_id,
              quantity_ordered: parseFloat(line.quantity_ordered),
              rate: parseFloat(line.rate),
            },
            { transaction }
          );
        }
      }
    });

    const updated = await PurchaseOrder.findByPk(po.id, { include: PO_INCLUDES });

    return success(res, 200, "Purchase order updated successfully", updated);
  } catch (err) {
    console.error("Error updating purchase order:", err);
    return error(res, 500, "Failed to update purchase order", err.message);
  }
};

const deletePurchaseOrder = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOne({
      where: { id: req.params.id, is_archived: false },
      include: [{ model: PurchaseOrderItem, as: "items" }],
    });

    if (!po) {
      return error(res, 404, "Purchase order not found");
    }

    const hasReceipts = po.items.some((line) => parseFloat(line.quantity_received) > 0);

    if (hasReceipts) {
      return error(
        res,
        400,
        "Cannot delete a purchase order that has received material. Cancel it instead."
      );
    }

    await po.update({ is_archived: true });

    return success(res, 200, "Purchase order deleted successfully");
  } catch (err) {
    console.error("Error deleting purchase order:", err);
    return error(res, 500, "Failed to delete purchase order", err.message);
  }
};

/**
 * Receive material against this PO. Delegates entirely to stockService, which
 * owns the transaction, the batch creation, and the PO status recompute.
 */
const receivePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { receipt_date, supplier_bill_ref, notes, items } = req.body;

    const po = await PurchaseOrder.findOne({ where: { id, is_archived: false } });

    if (!po) {
      return error(res, 404, "Purchase order not found");
    }

    if (po.status === "CANCELLED") {
      return error(res, 400, "Cannot receive material against a cancelled purchase order");
    }

    if (!receipt_date) {
      return error(res, 400, "Receipt date is required");
    }

    if (!items || items.length === 0) {
      return error(res, 400, "At least one item must be received");
    }

    const receipt = await stockService.receiveStock({
      purchase_order_id: po.id,
      supplier_id: po.supplier_id,
      receipt_date,
      supplier_bill_ref: supplier_bill_ref || null,
      notes: notes || null,
      items,
    });

    return success(res, 201, "Material received successfully", receipt);
  } catch (err) {
    console.error("Error receiving purchase order:", err);
    return error(res, 500, "Failed to receive material", err.message);
  }
};

module.exports = {
  createPurchaseOrder,
  getAllPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
  receivePurchaseOrder,
};
```

- [ ] **Step 2: Routes**

`backend/src/routes/purchaseOrderRoutes.js`:
```js
"use strict";

const express = require("express");
const router = express.Router();
const controller = require("../controllers/purchaseOrderController");

router.post("/", controller.createPurchaseOrder);
router.get("/", controller.getAllPurchaseOrders);
router.get("/:id", controller.getPurchaseOrderById);
router.put("/:id", controller.updatePurchaseOrder);
router.delete("/:id", controller.deletePurchaseOrder);
router.post("/:id/receive", controller.receivePurchaseOrder);

module.exports = router;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/purchaseOrderController.js backend/src/routes/purchaseOrderRoutes.js
git commit -m "feat(inventory): purchase order CRUD and receive endpoint"
```

### Task 5.2: Goods receipt controller

**Files:**
- Create: `backend/src/controllers/goodsReceiptController.js`
- Create: `backend/src/routes/goodsReceiptRoutes.js`

Handles receipts that arrive **without** a PO, and lists/shows receipts. Receipts against a PO come in via `POST /purchase-orders/:id/receive`.

- [ ] **Step 1: Controller**

```js
"use strict";

const {
  GoodsReceipt,
  GoodsReceiptItem,
  InventoryItem,
  Supplier,
  PurchaseOrder,
} = require("../models");
const { success, error } = require("../utils/response");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
const stockService = require("../services/stockService");
const { Op } = require("sequelize");

const RECEIPT_INCLUDES = [
  { model: Supplier, as: "supplier", attributes: ["id", "name"] },
  { model: PurchaseOrder, as: "purchaseOrder", attributes: ["id", "po_number"] },
  {
    model: GoodsReceiptItem,
    as: "items",
    include: [{ model: InventoryItem, as: "item", attributes: ["id", "name", "unit"] }],
  },
];

/** Direct receipt: material that turned up with no purchase order behind it. */
const createGoodsReceipt = async (req, res) => {
  try {
    const { supplier_id, receipt_date, supplier_bill_ref, notes, items } = req.body;

    if (!supplier_id || !receipt_date) {
      return error(res, 400, "Supplier and receipt date are required");
    }

    if (!items || items.length === 0) {
      return error(res, 400, "At least one item is required");
    }

    const supplier = await Supplier.findOne({ where: { id: supplier_id, is_archived: false } });
    if (!supplier) {
      return error(res, 400, "Invalid supplier");
    }

    const receipt = await stockService.receiveStock({
      purchase_order_id: null,
      supplier_id,
      receipt_date,
      supplier_bill_ref: supplier_bill_ref || null,
      notes: notes || null,
      items,
    });

    return success(res, 201, "Goods receipt created successfully", receipt);
  } catch (err) {
    console.error("Error creating goods receipt:", err);
    return error(res, 500, "Failed to create goods receipt", err.message);
  }
};

const getAllGoodsReceipts = async (req, res) => {
  try {
    const { search, supplier_id, from_date, to_date } = req.query;
    const whereClause = { is_archived: false };

    if (supplier_id) whereClause.supplier_id = supplier_id;

    if (from_date && to_date) {
      whereClause.receipt_date = { [Op.between]: [from_date, to_date] };
    } else if (from_date) {
      whereClause.receipt_date = { [Op.gte]: from_date };
    } else if (to_date) {
      whereClause.receipt_date = { [Op.lte]: to_date };
    }

    if (search) {
      whereClause[Op.or] = [
        { receipt_number: { [Op.iLike]: `%${search}%` } },
        { supplier_bill_ref: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const pagination = getPagination(req.query);

    const { rows, count } = await GoodsReceipt.findAndCountAll({
      where: whereClause,
      include: RECEIPT_INCLUDES,
      order: [["receipt_date", "DESC"], ["created_at", "DESC"]],
      limit: pagination.limit,
      offset: pagination.offset,
      distinct: true,
    });

    const data = rows.map((receipt) => {
      const plain = receipt.toJSON();
      plain.total_amount = plain.items.reduce(
        (sum, line) => sum + parseFloat(line.quantity_received) * parseFloat(line.rate),
        0
      );
      return plain;
    });

    return success(
      res,
      200,
      "Goods receipts retrieved successfully",
      buildPaginatedResponse(data, count, pagination)
    );
  } catch (err) {
    console.error("Error retrieving goods receipts:", err);
    return error(res, 500, "Failed to retrieve goods receipts", err.message);
  }
};

const getGoodsReceiptById = async (req, res) => {
  try {
    const receipt = await GoodsReceipt.findOne({
      where: { id: req.params.id, is_archived: false },
      include: RECEIPT_INCLUDES,
    });

    if (!receipt) {
      return error(res, 404, "Goods receipt not found");
    }

    const plain = receipt.toJSON();
    plain.total_amount = plain.items.reduce(
      (sum, line) => sum + parseFloat(line.quantity_received) * parseFloat(line.rate),
      0
    );

    return success(res, 200, "Goods receipt retrieved successfully", plain);
  } catch (err) {
    console.error("Error retrieving goods receipt:", err);
    return error(res, 500, "Failed to retrieve goods receipt", err.message);
  }
};

module.exports = {
  createGoodsReceipt,
  getAllGoodsReceipts,
  getGoodsReceiptById,
};
```

**There is deliberately no delete.** Reversing a receipt would mean un-creating batches that may already be partly consumed — an unwinding problem with no correct answer. The user corrects a mistaken receipt with an `ADJUSTMENT_OUT`, which leaves an honest trail.

- [ ] **Step 2: Routes**

`backend/src/routes/goodsReceiptRoutes.js`:
```js
"use strict";

const express = require("express");
const router = express.Router();
const controller = require("../controllers/goodsReceiptController");

router.post("/", controller.createGoodsReceipt);
router.get("/", controller.getAllGoodsReceipts);
router.get("/:id", controller.getGoodsReceiptById);

module.exports = router;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/goodsReceiptController.js backend/src/routes/goodsReceiptRoutes.js
git commit -m "feat(inventory): goods receipt list, detail, and PO-less receipt"
```

---

# Phase 6 — Issues and stock query API

### Task 6.1: Stock issue controller

**Files:**
- Create: `backend/src/controllers/stockIssueController.js`
- Create: `backend/src/routes/stockIssueRoutes.js`

- [ ] **Step 1: Controller**

```js
"use strict";

const { StockIssue, StockIssueItem, InventoryItem, Order, Customer } = require("../models");
const { success, error } = require("../utils/response");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
const stockService = require("../services/stockService");
const { Op } = require("sequelize");

const ISSUE_INCLUDES = [
  {
    model: StockIssueItem,
    as: "items",
    include: [{ model: InventoryItem, as: "item", attributes: ["id", "name", "unit"] }],
  },
  {
    model: Order,
    as: "order",
    attributes: ["id", "order_date"],
    include: [{ model: Customer, as: "customer", attributes: ["id", "name"] }],
    required: false,
  },
];

/**
 * Create an issue, wastage write-off, or adjustment.
 * Routes to the right stockService entry point based on issue_type — adjustments
 * go through adjustStock so the mandatory-reason rule cannot be bypassed.
 */
const createStockIssue = async (req, res) => {
  try {
    const { issue_date, issue_type = "ISSUE", order_id, reason, notes, items } = req.body;

    if (!issue_date) {
      return error(res, 400, "Issue date is required");
    }

    if (!items || items.length === 0) {
      return error(res, 400, "At least one item is required");
    }

    const isAdjustment = ["ADJUSTMENT_IN", "ADJUSTMENT_OUT"].includes(issue_type);

    if (isAdjustment && (!reason || !reason.trim())) {
      return error(res, 400, "A reason is required for a stock adjustment");
    }

    const issue = isAdjustment
      ? await stockService.adjustStock({ issue_date, issue_type, reason, notes, items })
      : await stockService.issueStock({
          issue_date,
          issue_type,
          order_id: order_id || null,
          notes,
          items,
        });

    const created = await StockIssue.findByPk(issue.id, { include: ISSUE_INCLUDES });

    return success(res, 201, "Stock issue recorded successfully", created);
  } catch (err) {
    // Insufficient stock is a user error, not a server error. Say so clearly —
    // this is the message the factory user will actually see on their phone.
    if (err instanceof stockService.InsufficientStockError) {
      return error(res, 400, err.message);
    }

    console.error("Error creating stock issue:", err);
    return error(res, 500, "Failed to record stock issue", err.message);
  }
};

const getAllStockIssues = async (req, res) => {
  try {
    const { search, issue_type, order_id, from_date, to_date } = req.query;
    const whereClause = { is_archived: false };

    if (issue_type) whereClause.issue_type = issue_type;
    if (order_id) whereClause.order_id = order_id;

    if (from_date && to_date) {
      whereClause.issue_date = { [Op.between]: [from_date, to_date] };
    } else if (from_date) {
      whereClause.issue_date = { [Op.gte]: from_date };
    } else if (to_date) {
      whereClause.issue_date = { [Op.lte]: to_date };
    }

    if (search) {
      whereClause.issue_number = { [Op.iLike]: `%${search}%` };
    }

    const pagination = getPagination(req.query);

    const { rows, count } = await StockIssue.findAndCountAll({
      where: whereClause,
      include: ISSUE_INCLUDES,
      order: [["issue_date", "DESC"], ["created_at", "DESC"]],
      limit: pagination.limit,
      offset: pagination.offset,
      distinct: true,
    });

    const data = rows.map((issue) => {
      const plain = issue.toJSON();
      plain.total_cost = plain.items.reduce((sum, line) => sum + parseFloat(line.total_cost), 0);
      plain.total_wastage_cost = plain.items.reduce(
        (sum, line) => sum + parseFloat(line.wastage_cost || 0),
        0
      );
      return plain;
    });

    return success(
      res,
      200,
      "Stock issues retrieved successfully",
      buildPaginatedResponse(data, count, pagination)
    );
  } catch (err) {
    console.error("Error retrieving stock issues:", err);
    return error(res, 500, "Failed to retrieve stock issues", err.message);
  }
};

const getStockIssueById = async (req, res) => {
  try {
    const issue = await StockIssue.findOne({
      where: { id: req.params.id, is_archived: false },
      include: ISSUE_INCLUDES,
    });

    if (!issue) {
      return error(res, 404, "Stock issue not found");
    }

    return success(res, 200, "Stock issue retrieved successfully", issue);
  } catch (err) {
    console.error("Error retrieving stock issue:", err);
    return error(res, 500, "Failed to retrieve stock issue", err.message);
  }
};

module.exports = {
  createStockIssue,
  getAllStockIssues,
  getStockIssueById,
};
```

- [ ] **Step 2: Routes**

`backend/src/routes/stockIssueRoutes.js`:
```js
"use strict";

const express = require("express");
const router = express.Router();
const controller = require("../controllers/stockIssueController");

router.post("/", controller.createStockIssue);
router.get("/", controller.getAllStockIssues);
router.get("/:id", controller.getStockIssueById);

module.exports = router;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/stockIssueController.js backend/src/routes/stockIssueRoutes.js
git commit -m "feat(inventory): stock issue, wastage, and adjustment endpoint"
```

### Task 6.2: Stock query controller

**Files:**
- Create: `backend/src/controllers/stockController.js`
- Create: `backend/src/routes/stockRoutes.js`

This powers the Stock page — the screen the user lives in. It must answer, per item: **in stock**, **on order**, **value**, and **low stock**.

Stock and value are computed with raw SQL aggregates rather than by loading every batch into Node. With a few thousand batches, loading them all to sum them would be slow and pointless — the database does this better.

- [ ] **Step 1: Controller**

```js
"use strict";

const {
  InventoryItem,
  InventoryCategory,
  ItemAttribute,
  ItemAttributeValue,
  InventoryItemAttributeValue,
  StockBatch,
  StockMovement,
  GoodsReceipt,
  Supplier,
  sequelize,
} = require("../models");
const { success, error } = require("../utils/response");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
const { Op, QueryTypes } = require("sequelize");

/**
 * Stock-on-hand list: one row per item, with quantity, value, on-order, and a
 * low-stock flag. Aggregates are done in SQL — pulling every batch into Node to
 * sum it would not scale and the database does it better.
 */
const getStock = async (req, res) => {
  try {
    const { search, category_id, attribute_value_id, low_stock_only, sort_by = "name" } = req.query;
    const pagination = getPagination(req.query);

    const conditions = ["i.is_archived = false"];
    const replacements = { limit: pagination.limit, offset: pagination.offset };

    if (category_id) {
      conditions.push("i.category_id = :category_id");
      replacements.category_id = category_id;
    }

    if (search) {
      conditions.push("(i.name ILIKE :search OR i.item_code ILIKE :search)");
      replacements.search = `%${search}%`;
    }

    // Filter to items carrying one specific attribute value (e.g. all W Cut).
    if (attribute_value_id) {
      conditions.push(`EXISTS (
        SELECT 1 FROM inventory_item_attribute_values iav
        WHERE iav.item_id = i.id AND iav.attribute_value_id = :attribute_value_id
      )`);
      replacements.attribute_value_id = attribute_value_id;
    }

    const whereSql = conditions.join(" AND ");

    // Low stock: at or below the reorder level. Items with a reorder_level of 0
    // are never "low" — the user has not asked to track a minimum for them.
    const havingSql =
      low_stock_only === "true"
        ? "HAVING COALESCE(SUM(b.quantity_remaining), 0) <= i.reorder_level AND i.reorder_level > 0"
        : "";

    const sortColumns = {
      name: "i.name ASC",
      stock: "in_stock DESC",
      value: "stock_value DESC",
    };
    const orderSql = sortColumns[sort_by] || sortColumns.name;

    const rowsSql = `
      SELECT
        i.id,
        i.name,
        i.item_code,
        i.unit,
        i.reorder_level,
        i.reorder_target,
        c.id   AS category_id,
        c.name AS category_name,
        COALESCE((
          SELECT json_agg(
                   json_build_object(
                     'attribute_id', a.id,
                     'attribute_name', a.name,
                     'value_id', v.id,
                     'value', v.value
                   ) ORDER BY a.name
                 )
          FROM inventory_item_attribute_values iav
          JOIN item_attributes a ON a.id = iav.attribute_id
          JOIN item_attribute_values v ON v.id = iav.attribute_value_id
          WHERE iav.item_id = i.id
        ), '[]'::json)                                    AS attributes,
        COALESCE(SUM(b.quantity_remaining), 0)            AS in_stock,
        COALESCE(SUM(b.quantity_remaining * b.rate), 0)   AS stock_value,
        COALESCE((
          SELECT SUM(poi.quantity_ordered - poi.quantity_received)
          FROM purchase_order_items poi
          JOIN purchase_orders po ON po.id = poi.purchase_order_id
          WHERE poi.item_id = i.id
            AND po.is_archived = false
            AND po.status IN ('PENDING', 'PARTIALLY_RECEIVED')
            AND poi.quantity_ordered > poi.quantity_received
        ), 0) AS on_order
      FROM inventory_items i
      JOIN inventory_categories c ON c.id = i.category_id
      LEFT JOIN stock_batches b ON b.item_id = i.id AND b.quantity_remaining > 0
      WHERE ${whereSql}
      GROUP BY i.id, c.id
      ${havingSql}
      ORDER BY ${orderSql}
      LIMIT :limit OFFSET :offset
    `;

    const countSql = `
      SELECT COUNT(*) FROM (
        SELECT i.id
        FROM inventory_items i
        LEFT JOIN stock_batches b ON b.item_id = i.id AND b.quantity_remaining > 0
        WHERE ${whereSql}
        GROUP BY i.id
        ${havingSql}
      ) AS counted
    `;

    const rows = await sequelize.query(rowsSql, { replacements, type: QueryTypes.SELECT });
    const countResult = await sequelize.query(countSql, { replacements, type: QueryTypes.SELECT });
    const total = parseInt(countResult[0].count, 10);

    const data = rows.map((row) => {
      const inStock = parseFloat(row.in_stock);
      const reorderLevel = parseFloat(row.reorder_level);
      const reorderTarget = row.reorder_target === null ? null : parseFloat(row.reorder_target);

      const isLowStock = reorderLevel > 0 && inStock <= reorderLevel;
      // Top back up to the target; if no target is set, back up to the reorder level.
      const topUpTo = reorderTarget !== null ? reorderTarget : reorderLevel;

      return {
        id: row.id,
        name: row.name,
        item_code: row.item_code,
        unit: row.unit,
        attributes: row.attributes, // [{ attribute_id, attribute_name, value_id, value }]
        category: { id: row.category_id, name: row.category_name },
        in_stock: inStock,
        stock_value: parseFloat(row.stock_value),
        on_order: parseFloat(row.on_order),
        reorder_level: reorderLevel,
        reorder_target: reorderTarget,
        is_low_stock: isLowStock,
        suggested_quantity: isLowStock ? Math.max(0, topUpTo - inStock) : 0,
      };
    });

    return success(res, 200, "Stock retrieved successfully", buildPaginatedResponse(data, total, pagination));
  } catch (err) {
    console.error("Error retrieving stock:", err);
    return error(res, 500, "Failed to retrieve stock", err.message);
  }
};

/** Headline numbers for the top of the Stock page. */
const getStockSummary = async (req, res) => {
  try {
    const [valueRow] = await sequelize.query(
      `SELECT COALESCE(SUM(quantity_remaining * rate), 0) AS total_value
       FROM stock_batches WHERE quantity_remaining > 0`,
      { type: QueryTypes.SELECT }
    );

    const [lowStockRow] = await sequelize.query(
      `SELECT COUNT(*) AS low_stock_count FROM (
         SELECT i.id
         FROM inventory_items i
         LEFT JOIN stock_batches b ON b.item_id = i.id AND b.quantity_remaining > 0
         WHERE i.is_archived = false AND i.reorder_level > 0
         GROUP BY i.id
         HAVING COALESCE(SUM(b.quantity_remaining), 0) <= i.reorder_level
       ) AS low`,
      { type: QueryTypes.SELECT }
    );

    // "This month" = calendar month to date.
    const [monthRow] = await sequelize.query(
      `SELECT
         COALESCE(SUM(CASE WHEN movement_type = 'RECEIPT' THEN total_cost ELSE 0 END), 0) AS received_value,
         COALESCE(SUM(CASE WHEN movement_type = 'ISSUE'   THEN total_cost ELSE 0 END), 0) AS consumed_value,
         COALESCE(SUM(CASE WHEN movement_type = 'WASTAGE' THEN total_cost ELSE 0 END), 0) AS wastage_value
       FROM stock_movements
       WHERE movement_date >= date_trunc('month', CURRENT_DATE)`,
      { type: QueryTypes.SELECT }
    );

    const [itemCountRow] = await sequelize.query(
      `SELECT COUNT(*) AS item_count FROM inventory_items WHERE is_archived = false`,
      { type: QueryTypes.SELECT }
    );

    return success(res, 200, "Stock summary retrieved successfully", {
      total_stock_value: parseFloat(valueRow.total_value),
      low_stock_count: parseInt(lowStockRow.low_stock_count, 10),
      item_count: parseInt(itemCountRow.item_count, 10),
      received_value_this_month: parseFloat(monthRow.received_value),
      consumed_value_this_month: parseFloat(monthRow.consumed_value),
      wastage_value_this_month: parseFloat(monthRow.wastage_value),
    });
  } catch (err) {
    console.error("Error retrieving stock summary:", err);
    return error(res, 500, "Failed to retrieve stock summary", err.message);
  }
};

/** One item: its details, its open FIFO batches, and its current stock/value. */
const getItemStock = async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await InventoryItem.findOne({
      where: { id: itemId, is_archived: false },
      include: [
        { model: InventoryCategory, as: "category", attributes: ["id", "name"] },
        {
          model: InventoryItemAttributeValue,
          as: "attributeValues",
          include: [
            { model: ItemAttribute, as: "attribute", attributes: ["id", "name"] },
            { model: ItemAttributeValue, as: "value", attributes: ["id", "value"] },
          ],
        },
      ],
    });

    if (!item) {
      return error(res, 404, "Inventory item not found");
    }

    // Flatten the attribute link rows into the same shape the item API uses.
    const plainItem = item.toJSON();
    plainItem.attributes = (plainItem.attributeValues || []).map((link) => ({
      attribute_id: link.attribute.id,
      attribute_name: link.attribute.name,
      value_id: link.value.id,
      value: link.value.value,
    }));
    delete plainItem.attributeValues;

    const batches = await StockBatch.findAll({
      where: { item_id: itemId, quantity_remaining: { [Op.gt]: 0 } },
      order: [["received_date", "ASC"], ["created_at", "ASC"]],
      include: [
        {
          association: "goodsReceiptItem",
          required: false,
          include: [
            {
              association: "goodsReceipt",
              required: false,
              include: [{ model: Supplier, as: "supplier", attributes: ["id", "name"] }],
            },
          ],
        },
      ],
    });

    const openBatches = batches.map((batch) => {
      const plain = batch.toJSON();
      const remaining = parseFloat(plain.quantity_remaining);
      const rate = parseFloat(plain.rate);

      return {
        id: plain.id,
        received_date: plain.received_date,
        quantity_received: parseFloat(plain.quantity_received),
        quantity_remaining: remaining,
        rate,
        value: remaining * rate,
        supplier: plain.goodsReceiptItem?.goodsReceipt?.supplier || null,
        receipt_number: plain.goodsReceiptItem?.goodsReceipt?.receipt_number || null,
      };
    });

    const inStock = openBatches.reduce((sum, b) => sum + b.quantity_remaining, 0);
    const stockValue = openBatches.reduce((sum, b) => sum + b.value, 0);

    return success(res, 200, "Item stock retrieved successfully", {
      item: plainItem,
      in_stock: inStock,
      stock_value: stockValue,
      batches: openBatches,
    });
  } catch (err) {
    console.error("Error retrieving item stock:", err);
    return error(res, 500, "Failed to retrieve item stock", err.message);
  }
};

/** Paginated movement history for one item. The ledger grows forever — always paginate. */
const getItemMovements = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { movement_type, from_date, to_date } = req.query;
    const pagination = getPagination(req.query);

    const whereClause = { item_id: itemId };

    if (movement_type) whereClause.movement_type = movement_type;

    if (from_date && to_date) {
      whereClause.movement_date = { [Op.between]: [from_date, to_date] };
    } else if (from_date) {
      whereClause.movement_date = { [Op.gte]: from_date };
    } else if (to_date) {
      whereClause.movement_date = { [Op.lte]: to_date };
    }

    const { rows, count } = await StockMovement.findAndCountAll({
      where: whereClause,
      order: [["movement_date", "DESC"], ["created_at", "DESC"]],
      limit: pagination.limit,
      offset: pagination.offset,
    });

    return success(
      res,
      200,
      "Stock movements retrieved successfully",
      buildPaginatedResponse(rows, count, pagination)
    );
  } catch (err) {
    console.error("Error retrieving stock movements:", err);
    return error(res, 500, "Failed to retrieve stock movements", err.message);
  }
};

module.exports = {
  getStock,
  getStockSummary,
  getItemStock,
  getItemMovements,
};
```

- [ ] **Step 2: Routes**

`backend/src/routes/stockRoutes.js`:
```js
"use strict";

const express = require("express");
const router = express.Router();
const controller = require("../controllers/stockController");

// Order matters: /summary must be declared before /:itemId, or Express
// will treat "summary" as an item id.
router.get("/summary", controller.getStockSummary);
router.get("/", controller.getStock);
router.get("/:itemId", controller.getItemStock);
router.get("/:itemId/movements", controller.getItemMovements);

module.exports = router;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/stockController.js backend/src/routes/stockRoutes.js
git commit -m "feat(inventory): stock on hand, summary, item detail, and movement history"
```

### Task 6.3: Mount the routes and smoke-test the API

**Files:**
- Modify: `backend/src/routes/index.js`

- [ ] **Step 1: Register the routers**

In `backend/src/routes/index.js`, add the requires alongside the existing ones:

```js
const inventoryCategoryRoutes = require("./inventoryCategoryRoutes");
const itemAttributeRoutes = require("./itemAttributeRoutes");
const supplierRoutes = require("./supplierRoutes");
const inventoryItemRoutes = require("./inventoryItemRoutes");
const purchaseOrderRoutes = require("./purchaseOrderRoutes");
const goodsReceiptRoutes = require("./goodsReceiptRoutes");
const stockIssueRoutes = require("./stockIssueRoutes");
const stockRoutes = require("./stockRoutes");
```

and the mounts, before the `/health` route:

```js
router.use("/inventory-categories", inventoryCategoryRoutes);
router.use("/item-attributes", itemAttributeRoutes);
router.use("/suppliers", supplierRoutes);
router.use("/inventory-items", inventoryItemRoutes);
router.use("/purchase-orders", purchaseOrderRoutes);
router.use("/goods-receipts", goodsReceiptRoutes);
router.use("/stock-issues", stockIssueRoutes);
router.use("/stock", stockRoutes);
```

- [ ] **Step 2: Smoke-test the whole flow against the test database**

This exercises the real HTTP API end to end — not just the service. Start the server against the **test** DB:

```bash
cd backend
npm run test:db:up && sleep 3
npm run test:migrate
NODE_ENV=test PORT=5001 node src/server.js &
sleep 2
```

Then drive a full lifecycle:

```bash
# 1. A category exists (seeded, or create one)
CAT=$(curl -s -X POST localhost:5001/api/inventory-categories \
  -H 'Content-Type: application/json' -d '{"name":"Fabric"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.id')

# 2. Supplier
SUP=$(curl -s -X POST localhost:5001/api/suppliers \
  -H 'Content-Type: application/json' -d '{"name":"Sharma Textiles","phone":"9999999999"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.id')

# 3. Attribute "GSM" with a value "90" (the seeder provides these in production;
#    the test DB only runs migrations, so create them through the API — which
#    also proves the attribute endpoints work)
ATTR=$(curl -s -X POST localhost:5001/api/item-attributes \
  -H 'Content-Type: application/json' -d '{"name":"GSM"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.id')
VAL=$(curl -s -X POST localhost:5001/api/item-attributes/$ATTR/values \
  -H 'Content-Type: application/json' -d '{"value":"90"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.id')

# 4. Item: 90 GSM white fabric, reorder at 200kg, top up to 800kg, tagged GSM: 90
ITEM=$(curl -s -X POST localhost:5001/api/inventory-items \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"90 GSM White\",\"category_id\":\"$CAT\",\"unit\":\"KG\",\"reorder_level\":200,\"reorder_target\":800,\"attribute_value_ids\":[\"$VAL\"]}" \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.id')

# 4a. The item must echo its attributes back
curl -s localhost:5001/api/inventory-items/$ITEM | node -pe 'JSON.stringify(JSON.parse(require("fs").readFileSync(0)).data.attributes)'

# 5. Purchase order: 500kg @ 80
PO=$(curl -s -X POST localhost:5001/api/purchase-orders \
  -H 'Content-Type: application/json' \
  -d "{\"supplier_id\":\"$SUP\",\"order_date\":\"2026-07-01\",\"items\":[{\"item_id\":\"$ITEM\",\"quantity_ordered\":500,\"rate\":80}]}" \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.id')

# 6. Receive 200kg of it (partial)
POI=$(curl -s localhost:5001/api/purchase-orders/$PO | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.items[0].id')
curl -s -X POST localhost:5001/api/purchase-orders/$PO/receive \
  -H 'Content-Type: application/json' \
  -d "{\"receipt_date\":\"2026-07-05\",\"items\":[{\"item_id\":\"$ITEM\",\"purchase_order_item_id\":\"$POI\",\"quantity_received\":200,\"rate\":80}]}" > /dev/null

# 7. PO should now be PARTIALLY_RECEIVED
curl -s localhost:5001/api/purchase-orders/$PO | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.status'

# 8. Stock should be 200kg worth 16000, and LOW (200 <= 200)
curl -s localhost:5001/api/stock | node -pe 'JSON.stringify(JSON.parse(require("fs").readFileSync(0)).data.data[0], null, 2)'

# 9. Issue 50kg with 5kg wastage
curl -s -X POST localhost:5001/api/stock-issues \
  -H 'Content-Type: application/json' \
  -d "{\"issue_date\":\"2026-07-11\",\"items\":[{\"item_id\":\"$ITEM\",\"quantity\":50,\"wastage_quantity\":5}]}" \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.issue_number'

# 10. Stock should now be 145kg
curl -s localhost:5001/api/stock/$ITEM | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.in_stock'

# 11. Over-issue must be REFUSED with a clear 400
curl -s -X POST localhost:5001/api/stock-issues \
  -H 'Content-Type: application/json' \
  -d "{\"issue_date\":\"2026-07-11\",\"items\":[{\"item_id\":\"$ITEM\",\"quantity\":9999}]}" \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).message'
```

**Expected results:**
- Step 4a: `[{"attribute_id":"…","attribute_name":"GSM","value_id":"…","value":"90"}]`
- Step 7: `PARTIALLY_RECEIVED`
- Step 8: `in_stock: 200`, `stock_value: 16000`, `on_order: 300`, `is_low_stock: true`, `suggested_quantity: 600`, and `attributes` carrying the GSM: 90 entry
- Step 9: an issue number like `ISS-2026-0001`
- Step 10: `145` (200 − 50 − 5)
- Step 11: `Insufficient stock for 90 GSM White: tried to issue 9999 KG, but only 145 KG available`

Kill the server when done: `kill %1`

If step 8 shows `on_order: 0`, the subquery in `getStock` is not seeing the PO — check that the PO status is in the `('PENDING', 'PARTIALLY_RECEIVED')` list.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/index.js
git commit -m "feat(inventory): mount inventory routers"
```

### Task 6.4: Audit logging for inventory documents

**Files:**
- Modify: `backend/src/services/stockService.js`
- Modify: `backend/src/controllers/purchaseOrderController.js`

Task 1.3 extended `audit_logs.entity_type` with the inventory types — but extending the enum does nothing on its own. **Something has to actually write the rows**, or the History page will never show a single inventory event. This task closes that loop.

Orders and Payments log via Sequelize model hooks. Inventory logs from the **service** instead, because a stock event is a whole document (an issue is one business event, not five row-writes), and the hook would fire per row.

- [ ] **Step 1: Log receipts and issues from `stockService`**

Add the import at the top of `backend/src/services/stockService.js`:
```js
const { createAuditLog } = require("./auditService");
```

At the end of `receiveStock`'s transaction — after the PO status recompute, before the `return` — add:

```js
    await createAuditLog(db.AuditLog, {
      entityType: "GOODS_RECEIPT",
      entityId: receipt.id,
      action: "CREATE",
      newValues: {
        receipt_number: receipt.receipt_number,
        receipt_date,
        supplier_id,
        purchase_order_id,
      },
      metadata: {
        item_count: items.length,
        total_value: items.reduce(
          (sum, line) => sum + parseFloat(line.quantity_received) * parseFloat(line.rate),
          0
        ),
      },
      transaction,
    });
```

At the end of `issueStockInternal`'s transaction, and again at the end of `adjustStock`'s `ADJUSTMENT_IN` transaction, add:

```js
    await createAuditLog(db.AuditLog, {
      entityType: "STOCK_ISSUE",
      entityId: issue.id,
      action: issue_type === "ADJUSTMENT_IN" || issue_type === "ADJUSTMENT_OUT" ? "UPDATE" : "CREATE",
      newValues: {
        issue_number: issue.issue_number,
        issue_date,
        issue_type,
        order_id: order_id || null,
      },
      metadata: {
        issue_type,
        reason: reason || null,
        item_count: items.length,
      },
      transaction,
    });
```

`createAuditLog` already swallows its own errors (see `auditService.js`) — audit logging must never break the operation it is recording. That behaviour is intentional; do not "fix" it.

- [ ] **Step 2: Log purchase order creation**

In `purchaseOrderController.createPurchaseOrder`, inside the transaction after the item lines are created, add:

```js
      const { createAuditLog } = require("../services/auditService");
      const { AuditLog } = require("../models");

      await createAuditLog(AuditLog, {
        entityType: "PURCHASE_ORDER",
        entityId: po.id,
        action: "CREATE",
        newValues: { po_number: poNumber, supplier_id, order_date, expected_date: expected_date || null },
        metadata: {
          supplier_name: supplier.name,
          item_count: items.length,
          total_value: items.reduce(
            (sum, line) => sum + parseFloat(line.quantity_ordered) * parseFloat(line.rate),
            0
          ),
        },
        transaction,
      });
```

- [ ] **Step 3: Verify the entries reach the History page**

With the test server running, record an issue (Task 6.3's smoke test does this), then:

```bash
curl -s localhost:5001/api/audit-logs | node -pe 'JSON.stringify(JSON.parse(require("fs").readFileSync(0)).data.slice(0,3), null, 2)'
```
Expected: entries with `entity_type` of `STOCK_ISSUE`, `GOODS_RECEIPT`, and `PURCHASE_ORDER`.

If this 500s with *"invalid input value for enum"*, the Task 1.3 enum migration did not run — re-run `npm run test:migrate`.

Then open `/history` in the frontend and confirm the inventory events render. `History.jsx` and `HistoryFilter.jsx` may hard-code the entity types `ORDER` and `PAYMENT` in their filter dropdown — if so, add the three new types there, and make sure an unrecognised entity type still renders a sensible row rather than crashing the page.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/stockService.js backend/src/controllers/purchaseOrderController.js frontend/src/components/history/
git commit -m "feat(inventory): audit logging for receipts, issues, and purchase orders"
```

---

# Phase 7 — Excel export

### Task 7.1: Inventory export

**Files:**
- Modify: `backend/src/controllers/exportController.js`
- Modify: `backend/src/routes/exportRoutes.js`

Every other module exports to Excel; inventory is the one people most want in a spreadsheet. Follows the existing `xlsx` pattern in `exportController.js`.

- [ ] **Step 1: Add the export handler**

Append to `backend/src/controllers/exportController.js`, before `module.exports`, and add `exportInventoryData` to the exports:

```js
/**
 * Export inventory as a 3-sheet workbook: Stock, Movements, Purchases.
 * Uses the same XLSX pattern as exportDashboardData above.
 */
const exportInventoryData = async (req, res) => {
  try {
    const { sequelize } = require("../models");
    const { QueryTypes } = require("sequelize");
    const { from_date, to_date } = req.query;

    // --- Sheet 1: current stock ---
    const stockRows = await sequelize.query(
      `SELECT
         i.name                                          AS "Item",
         i.item_code                                     AS "Code",
         c.name                                          AS "Category",
         i.unit                                          AS "Unit",
         COALESCE((
           SELECT string_agg(a.name || ': ' || v.value, '; ' ORDER BY a.name)
           FROM inventory_item_attribute_values iav
           JOIN item_attributes a ON a.id = iav.attribute_id
           JOIN item_attribute_values v ON v.id = iav.attribute_value_id
           WHERE iav.item_id = i.id
         ), '')                                          AS "Attributes",
         COALESCE(SUM(b.quantity_remaining), 0)          AS "In Stock",
         COALESCE(SUM(b.quantity_remaining * b.rate), 0) AS "Stock Value",
         i.reorder_level                                 AS "Reorder Level",
         CASE
           WHEN i.reorder_level > 0
            AND COALESCE(SUM(b.quantity_remaining), 0) <= i.reorder_level
           THEN 'LOW'
           ELSE 'OK'
         END                                             AS "Status"
       FROM inventory_items i
       JOIN inventory_categories c ON c.id = i.category_id
       LEFT JOIN stock_batches b ON b.item_id = i.id AND b.quantity_remaining > 0
       WHERE i.is_archived = false
       GROUP BY i.id, c.id
       ORDER BY i.name ASC`,
      { type: QueryTypes.SELECT }
    );

    // --- Sheet 2: movements (date-filtered) ---
    const movementConditions = [];
    const movementReplacements = {};

    if (from_date) {
      movementConditions.push("m.movement_date >= :from_date");
      movementReplacements.from_date = from_date;
    }
    if (to_date) {
      movementConditions.push("m.movement_date <= :to_date");
      movementReplacements.to_date = to_date;
    }

    const movementWhere = movementConditions.length
      ? `WHERE ${movementConditions.join(" AND ")}`
      : "";

    const movementRows = await sequelize.query(
      `SELECT
         m.movement_date  AS "Date",
         i.name           AS "Item",
         m.movement_type  AS "Type",
         m.quantity       AS "Quantity",
         i.unit           AS "Unit",
         m.unit_cost      AS "Rate",
         m.total_cost     AS "Cost",
         m.notes          AS "Notes"
       FROM stock_movements m
       JOIN inventory_items i ON i.id = m.item_id
       ${movementWhere}
       ORDER BY m.movement_date DESC, m.created_at DESC`,
      { replacements: movementReplacements, type: QueryTypes.SELECT }
    );

    // --- Sheet 3: purchases ---
    const purchaseRows = await sequelize.query(
      `SELECT
         po.po_number                                             AS "PO Number",
         po.order_date                                            AS "Order Date",
         s.name                                                   AS "Supplier",
         i.name                                                   AS "Item",
         poi.quantity_ordered                                     AS "Ordered",
         poi.quantity_received                                    AS "Received",
         GREATEST(poi.quantity_ordered - poi.quantity_received, 0) AS "Pending",
         i.unit                                                   AS "Unit",
         poi.rate                                                 AS "Rate",
         (poi.quantity_ordered * poi.rate)                        AS "Order Value",
         po.status                                                AS "Status"
       FROM purchase_order_items poi
       JOIN purchase_orders po ON po.id = poi.purchase_order_id
       JOIN suppliers s ON s.id = po.supplier_id
       JOIN inventory_items i ON i.id = poi.item_id
       WHERE po.is_archived = false
       ORDER BY po.order_date DESC`,
      { type: QueryTypes.SELECT }
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(stockRows), "Stock");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(movementRows), "Movements");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(purchaseRows), "Purchases");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="inventory.xlsx"');

    return res.send(buffer);
  } catch (err) {
    console.error("Error exporting inventory data:", err);
    return error(res, 500, "Failed to export inventory data", err.message);
  }
};
```

- [ ] **Step 2: Add the route**

In `backend/src/routes/exportRoutes.js`, add below the existing routes:
```js
router.get("/inventory", exportController.exportInventoryData);
```

- [ ] **Step 3: Verify**

With the test server running (as in Task 6.3):
```bash
curl -s -o /tmp/inv.xlsx -w "%{http_code} %{content_type}\n" localhost:5001/api/export/inventory
```
Expected: `200 application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, and `/tmp/inv.xlsx` opens in Excel with three sheets. The Stock sheet carries a single flattened **Attributes** column reading like `Cut: W Cut; GSM: 60` — one column that survives whatever attributes the user invents, instead of a hardcoded column per variation.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/exportController.js backend/src/routes/exportRoutes.js
git commit -m "feat(inventory): excel export for stock, movements, and purchases"
```

---

# Phase 8 — Frontend foundations

**Read this before writing any frontend code.**

The existing API endpoints return `{ success, message, data }`, and pages read `response.data.data`.

**The new paginated endpoints nest one level deeper:** `data` is `{ data: [...], pagination: {...} }`. So a paginated list is at **`response.data.data.data`** and its metadata at **`response.data.data.pagination`**. That is ugly and easy to get wrong, so `inventoryAPI.js` below unwraps it — always use the helpers, never reach into the raw axios response.

Endpoints that are **not** paginated (and so return a plain array at `response.data.data`): `inventory-categories`, `item-attributes`, and any list called with `all=true`.

### Task 8.1: API client

**Files:**
- Create: `frontend/src/services/inventoryAPI.js`

- [ ] **Step 1: Write the client**

```js
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

/**
 * Unwrap a paginated response.
 * The backend envelope is { success, message, data: { data: [...], pagination: {...} } },
 * so the rows live two levels down. Always go through this rather than digging
 * into the axios response by hand.
 */
const unwrapPaginated = (response) => ({
  rows: response.data.data.data,
  pagination: response.data.data.pagination,
});

/** Unwrap a plain (non-paginated) response. */
const unwrap = (response) => response.data.data;

// --- Categories (never paginated) ---
export const inventoryCategoryAPI = {
  getAll: async (params) => unwrap(await api.get("/inventory-categories", { params })),
  getById: async (id) => unwrap(await api.get(`/inventory-categories/${id}`)),
  create: (data) => api.post("/inventory-categories", data),
  update: (id, data) => api.put(`/inventory-categories/${id}`, data),
  delete: (id) => api.delete(`/inventory-categories/${id}`),
};

// --- Item attributes (never paginated — small master list, values nested) ---
export const itemAttributesAPI = {
  getAll: async () => unwrap(await api.get("/item-attributes")),
  create: (data) => api.post("/item-attributes", data),
  update: (id, data) => api.put(`/item-attributes/${id}`, data),
  delete: (id) => api.delete(`/item-attributes/${id}`),
  createValue: (attributeId, data) => api.post(`/item-attributes/${attributeId}/values`, data),
  updateValue: (valueId, data) => api.put(`/item-attributes/values/${valueId}`, data),
  deleteValue: (valueId) => api.delete(`/item-attributes/values/${valueId}`),
};

// --- Suppliers ---
export const supplierAPI = {
  getAll: async (params) => unwrapPaginated(await api.get("/suppliers", { params })),
  /** Unpaginated — for dropdowns. */
  getAllForPicker: async () => unwrap(await api.get("/suppliers", { params: { all: "true" } })),
  getById: async (id) => unwrap(await api.get(`/suppliers/${id}`)),
  create: (data) => api.post("/suppliers", data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
};

// --- Items ---
export const inventoryItemAPI = {
  getAll: async (params) => unwrapPaginated(await api.get("/inventory-items", { params })),
  /** Unpaginated — for item pickers. */
  getAllForPicker: async () => unwrap(await api.get("/inventory-items", { params: { all: "true" } })),
  getById: async (id) => unwrap(await api.get(`/inventory-items/${id}`)),
  create: (data) => api.post("/inventory-items", data),
  update: (id, data) => api.put(`/inventory-items/${id}`, data),
  delete: (id) => api.delete(`/inventory-items/${id}`),
};

// --- Purchase orders ---
export const purchaseOrderAPI = {
  getAll: async (params) => unwrapPaginated(await api.get("/purchase-orders", { params })),
  getById: async (id) => unwrap(await api.get(`/purchase-orders/${id}`)),
  create: (data) => api.post("/purchase-orders", data),
  update: (id, data) => api.put(`/purchase-orders/${id}`, data),
  delete: (id) => api.delete(`/purchase-orders/${id}`),
  receive: (id, data) => api.post(`/purchase-orders/${id}/receive`, data),
};

// --- Goods receipts ---
export const goodsReceiptAPI = {
  getAll: async (params) => unwrapPaginated(await api.get("/goods-receipts", { params })),
  getById: async (id) => unwrap(await api.get(`/goods-receipts/${id}`)),
  create: (data) => api.post("/goods-receipts", data),
};

// --- Stock issues / wastage / adjustments ---
export const stockIssueAPI = {
  getAll: async (params) => unwrapPaginated(await api.get("/stock-issues", { params })),
  getById: async (id) => unwrap(await api.get(`/stock-issues/${id}`)),
  create: (data) => api.post("/stock-issues", data),
};

// --- Stock ---
export const stockAPI = {
  getStock: async (params) => unwrapPaginated(await api.get("/stock", { params })),
  getSummary: async () => unwrap(await api.get("/stock/summary")),
  getItemStock: async (itemId) => unwrap(await api.get(`/stock/${itemId}`)),
  getItemMovements: async (itemId, params) =>
    unwrapPaginated(await api.get(`/stock/${itemId}/movements`, { params })),
};

// --- Export ---
export const inventoryExportAPI = {
  download: (params) => api.get("/export/inventory", { params, responseType: "blob" }),
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/inventoryAPI.js
git commit -m "feat(inventory): frontend API client"
```

### Task 8.2: Reusable pagination control

**Files:**
- Create: `frontend/src/components/common/Pagination.jsx`

Mobile-first: on a phone this is a compact "‹ Page 2 of 7 ›" with big tap targets, not a row of twenty numbered buttons.

- [ ] **Step 1: Write the component**

```jsx
import PropTypes from "prop-types";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

/**
 * Server-side pagination control.
 * Deliberately minimal: prev / page indicator / next. Numbered page buttons do
 * not fit on a phone, and this app is used on a phone.
 */
const Pagination = ({ pagination, onPageChange, className = "" }) => {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, totalPages, total, limit } = pagination;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const buttonClasses =
    "flex items-center justify-center min-w-[44px] min-h-[44px] px-4 rounded-xl border border-gray-200 dark:border-emerald-900/40 " +
    "bg-white dark:bg-[#161d1a] text-gray-700 dark:text-emerald-100 " +
    "disabled:opacity-40 disabled:cursor-not-allowed " +
    "hover:bg-gray-50 dark:hover:bg-emerald-500/10 transition-colors";

  return (
    <div className={`flex items-center justify-between gap-3 mt-4 ${className}`}>
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={buttonClasses}
        aria-label="Previous page"
      >
        <FaChevronLeft className="w-4 h-4" />
      </button>

      <div className="text-center">
        <p className="text-sm font-medium text-gray-900 dark:text-emerald-50">
          Page {page} of {totalPages}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {from}–{to} of {total}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className={buttonClasses}
        aria-label="Next page"
      >
        <FaChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

Pagination.propTypes = {
  pagination: PropTypes.shape({
    page: PropTypes.number.isRequired,
    limit: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
    totalPages: PropTypes.number.isRequired,
  }),
  onPageChange: PropTypes.func.isRequired,
  className: PropTypes.string,
};

export default Pagination;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/common/Pagination.jsx
git commit -m "feat(ui): reusable server-side pagination control"
```

### Task 8.3: Routes and navigation

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/layout/Sidebar.jsx`

Do this **now**, before the pages exist, so each page can be clicked through as it lands. Create every page file as a stub first, then fill them in over Phase 9.

- [ ] **Step 1: Create stub pages so the routes resolve**

For each of these 17 files in `frontend/src/pages/`, create a stub:

`Stock.jsx`, `StockItemDetail.jsx`, `InventoryItems.jsx`, `CreateInventoryItem.jsx`, `EditInventoryItem.jsx`, `PurchaseOrders.jsx`, `CreatePurchaseOrder.jsx`, `PurchaseOrderDetail.jsx`, `ReceivePurchaseOrder.jsx`, `StockIssues.jsx`, `CreateStockIssue.jsx`, `Suppliers.jsx`, `CreateSupplier.jsx`, `EditSupplier.jsx`, `SupplierDetail.jsx`, `InventoryCategories.jsx`, `ItemAttributes.jsx`

Stub content (substitute the component name):
```jsx
const Stock = () => <div className="p-4">Stock</div>;
export default Stock;
```

- [ ] **Step 2: Add the routes**

In `frontend/src/App.jsx`, add the imports next to the existing page imports:

```jsx
import Stock from "./pages/Stock";
import StockItemDetail from "./pages/StockItemDetail";
import InventoryItems from "./pages/InventoryItems";
import CreateInventoryItem from "./pages/CreateInventoryItem";
import EditInventoryItem from "./pages/EditInventoryItem";
import PurchaseOrders from "./pages/PurchaseOrders";
import CreatePurchaseOrder from "./pages/CreatePurchaseOrder";
import PurchaseOrderDetail from "./pages/PurchaseOrderDetail";
import ReceivePurchaseOrder from "./pages/ReceivePurchaseOrder";
import StockIssues from "./pages/StockIssues";
import CreateStockIssue from "./pages/CreateStockIssue";
import Suppliers from "./pages/Suppliers";
import CreateSupplier from "./pages/CreateSupplier";
import EditSupplier from "./pages/EditSupplier";
import SupplierDetail from "./pages/SupplierDetail";
import InventoryCategories from "./pages/InventoryCategories";
import ItemAttributes from "./pages/ItemAttributes";
```

and the routes, inside `<Route path="/" element={<MainLayout />}>`, after the existing `history` route:

```jsx
                <Route path="stock">
                  <Route index element={<Stock />} />
                  <Route path=":itemId" element={<StockItemDetail />} />
                </Route>

                <Route path="inventory-items">
                  <Route index element={<InventoryItems />} />
                  <Route path="new" element={<CreateInventoryItem />} />
                  <Route path="edit/:id" element={<EditInventoryItem />} />
                </Route>

                <Route path="purchase-orders">
                  <Route index element={<PurchaseOrders />} />
                  <Route path="new" element={<CreatePurchaseOrder />} />
                  <Route path=":id" element={<PurchaseOrderDetail />} />
                  <Route path=":id/receive" element={<ReceivePurchaseOrder />} />
                </Route>

                <Route path="stock-issues">
                  <Route index element={<StockIssues />} />
                  <Route path="new" element={<CreateStockIssue />} />
                </Route>

                <Route path="suppliers">
                  <Route index element={<Suppliers />} />
                  <Route path="new" element={<CreateSupplier />} />
                  <Route path="edit/:id" element={<EditSupplier />} />
                  <Route path=":id" element={<SupplierDetail />} />
                </Route>

                <Route path="inventory-categories" element={<InventoryCategories />} />
                <Route path="item-attributes" element={<ItemAttributes />} />
```

⚠️ The `<Route path="*" element={<NotFound />} />` must remain **last** inside the layout route, or it will swallow everything after it.

- [ ] **Step 3: Add navigation**

In `frontend/src/components/layout/Sidebar.jsx`, extend the icon import:
```jsx
import { FaHome, FaBoxes, FaUsers, FaMoneyBillWave, FaLayerGroup, FaRuler, FaFileInvoiceDollar, FaTimes, FaHistory, FaWarehouse, FaTruck, FaClipboardList, FaDolly, FaTags } from "react-icons/fa";
```

and the nav items — Inventory sits after Expenses, before Invoices:
```jsx
  const navItems = [
    { to: "/", icon: FaHome, label: "Dashboard" },
    { to: "/orders", icon: FaBoxes, label: "Orders" },
    { to: "/customers", icon: FaUsers, label: "Customers" },
    { to: "/plate-types", icon: FaLayerGroup, label: "Plate Types" },
    { to: "/product-sizes", icon: FaRuler, label: "Product Sizes" },
    { to: "/expenses", icon: FaMoneyBillWave, label: "Expenses" },
    { to: "/stock", icon: FaWarehouse, label: "Stock" },
    { to: "/stock-issues", icon: FaDolly, label: "Stock Issues" },
    { to: "/purchase-orders", icon: FaClipboardList, label: "Purchase Orders" },
    { to: "/inventory-items", icon: FaTags, label: "Inventory Items" },
    { to: "/suppliers", icon: FaTruck, label: "Suppliers" },
    { to: "/invoices", icon: FaFileInvoiceDollar, label: "Invoices" },
    { to: "/history", icon: FaHistory, label: "History" },
  ];
```

Categories and Item Attributes are reachable from the Inventory Items page (as Expense Categories are from Expenses), not from the sidebar — the sidebar is already long, and both are set-and-forget masters, not daily screens.

- [ ] **Step 4: Verify the app still builds and every route resolves**

```bash
cd frontend && npm run build
```
Expected: build succeeds. Then `npm run dev` and click each new sidebar link — every one should render its stub, not a 404.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/layout/Sidebar.jsx frontend/src/pages/
git commit -m "feat(inventory): routes, navigation, and page stubs"
```

---

# Phase 9 — Frontend pages

**Mobile-first is not decoration here — it is the requirement.** The factory user enters issues daily on a phone on the shop floor. Rules for every page in this phase:

1. **Cards on mobile, table from `md:` up.** Never a horizontally-scrolling table on a phone.
2. **Tap targets ≥ 44px.** Use `min-h-[44px]` on buttons and inputs.
3. **Primary action reachable with a thumb** — bottom-fixed on mobile for the entry forms.
4. **Dark mode**: every page must work in both themes. Copy the class patterns from `Dashboard.jsx` (`dark:bg-[#161d1a]`, `dark:border-emerald-900/30`, `dark:text-emerald-50`).
5. **Loading and empty states** on every list — never a blank screen.

### Task 9.1: Stock page (the landing page)

**Files:**
- Modify: `frontend/src/pages/Stock.jsx`

- [ ] **Step 1: Write the page**

```jsx
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { FaSearch, FaDownload, FaExclamationTriangle, FaBoxOpen, FaRupeeSign, FaArrowDown, FaArrowUp } from "react-icons/fa";
import { stockAPI, inventoryCategoryAPI, itemAttributesAPI, inventoryExportAPI } from "../services/inventoryAPI";
import { formatCurrency } from "../utils/formatters";
import Pagination from "../components/common/Pagination";

const StatTile = ({ icon: Icon, label, value, tone = "default" }) => {
  const tones = {
    default: "bg-white dark:bg-[#161d1a] border-gray-200/60 dark:border-emerald-900/30",
    warning: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gray-500 dark:text-emerald-400" />
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-emerald-50 break-all">{value}</p>
    </div>
  );
};

/** The item's chosen attribute values, as compact chips: "W Cut", "60". */
const AttributeChips = ({ attributes }) => {
  if (!attributes || attributes.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {attributes.map((attribute) => (
        <span
          key={attribute.value_id}
          title={`${attribute.attribute_name}: ${attribute.value}`}
          className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-emerald-500/10 text-gray-600 dark:text-emerald-300"
        >
          {attribute.value}
        </span>
      ))}
    </div>
  );
};

const Stock = () => {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [attributeValueId, setAttributeValueId] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  const fetchStock = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search.trim()) params.search = search.trim();
      if (categoryId) params.category_id = categoryId;
      if (attributeValueId) params.attribute_value_id = attributeValueId;
      if (lowStockOnly) params.low_stock_only = "true";

      const { rows: data, pagination: meta } = await stockAPI.getStock(params);
      setRows(data);
      setPagination(meta);
      setError("");
    } catch (err) {
      console.error("Error fetching stock:", err);
      setError("Failed to load stock. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryId, attributeValueId, lowStockOnly]);

  useEffect(() => {
    // Debounce so typing in the search box does not fire a request per keystroke.
    const timer = setTimeout(fetchStock, 300);
    return () => clearTimeout(timer);
  }, [fetchStock]);

  useEffect(() => {
    const load = async () => {
      try {
        const [summaryData, categoryData, attributeData] = await Promise.all([
          stockAPI.getSummary(),
          inventoryCategoryAPI.getAll(),
          itemAttributesAPI.getAll(),
        ]);
        setSummary(summaryData);
        setCategories(categoryData);
        setAttributes(attributeData);
      } catch (err) {
        console.error("Error loading stock summary:", err);
      }
    };
    load();
  }, []);

  // Any filter change resets to page 1 — otherwise you can land on an empty page 5.
  useEffect(() => {
    setPage(1);
  }, [search, categoryId, attributeValueId, lowStockOnly]);

  const handleExport = async () => {
    try {
      const response = await inventoryExportAPI.download();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "inventory.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting inventory:", err);
      setError("Failed to export inventory.");
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-emerald-50">Stock</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Raw material on hand</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-sm font-medium text-gray-700 dark:text-emerald-100"
        >
          <FaDownload className="w-4 h-4" />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile icon={FaRupeeSign} label="Stock value" value={formatCurrency(summary.total_stock_value)} />
          <StatTile
            icon={FaExclamationTriangle}
            label="Low stock items"
            value={summary.low_stock_count}
            tone={summary.low_stock_count > 0 ? "warning" : "default"}
          />
          <StatTile icon={FaArrowDown} label="Received this month" value={formatCurrency(summary.received_value_this_month)} />
          <StatTile icon={FaArrowUp} label="Consumed this month" value={formatCurrency(summary.consumed_value_this_month)} />
        </div>
      )}

      <div className="space-y-3">
        <div className="relative">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item or code…"
            className="w-full min-h-[44px] pl-11 pr-4 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-gray-900 dark:text-emerald-50 placeholder:text-gray-400"
          />
        </div>

        <div className="flex gap-3">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex-1 min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-gray-900 dark:text-emerald-50"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>

          <select
            value={attributeValueId}
            onChange={(e) => setAttributeValueId(e.target.value)}
            className="flex-1 min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-gray-900 dark:text-emerald-50"
          >
            <option value="">All attributes</option>
            {attributes
              .filter((attribute) => attribute.values.length > 0)
              .map((attribute) => (
                <optgroup key={attribute.id} label={attribute.name}>
                  {attribute.values.map((value) => (
                    <option key={value.id} value={value.id}>{value.value}</option>
                  ))}
                </optgroup>
              ))}
          </select>

          <button
            type="button"
            onClick={() => setLowStockOnly((value) => !value)}
            className={`min-h-[44px] px-4 rounded-xl border text-sm font-medium transition-colors ${
              lowStockOnly
                ? "bg-amber-500 border-amber-500 text-white"
                : "bg-white dark:bg-[#161d1a] border-gray-200 dark:border-emerald-900/40 text-gray-700 dark:text-emerald-100"
            }`}
          >
            Low stock
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400">Loading stock…</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center">
          <FaBoxOpen className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">No items found</p>
          <Link to="/inventory-items/new" className="inline-block mt-3 text-primary dark:text-emerald-400 font-medium">
            Add an inventory item
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <Link
                key={row.id}
                to={`/stock/${row.id}`}
                className="block rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-emerald-50 truncate">{row.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{row.category.name}</p>
                    <AttributeChips attributes={row.attributes} />
                  </div>
                  {row.is_low_stock && (
                    <span className="shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      LOW
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">In stock</p>
                    <p className="font-semibold text-gray-900 dark:text-emerald-50">
                      {row.in_stock} {row.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">On order</p>
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      {row.on_order} {row.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Value</p>
                    <p className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(row.stock_value)}</p>
                  </div>
                </div>

                {row.is_low_stock && row.suggested_quantity > 0 && (
                  <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                    Suggested purchase: {row.suggested_quantity} {row.unit}
                  </p>
                )}
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200/60 dark:border-emerald-900/30">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#0f1a16]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">In stock</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">On order</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-emerald-900/20 bg-white dark:bg-[#161d1a]">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-emerald-500/5">
                    <td className="px-4 py-3">
                      <Link to={`/stock/${row.id}`} className="font-medium text-gray-900 dark:text-emerald-50 hover:text-primary">
                        {row.name}
                      </Link>
                      {row.item_code && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{row.item_code}</p>
                      )}
                      <AttributeChips attributes={row.attributes} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{row.category.name}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-emerald-50">
                      {row.in_stock} {row.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                      {row.on_order} {row.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                      {formatCurrency(row.stock_value)}
                    </td>
                    <td className="px-4 py-3">
                      {row.is_low_stock ? (
                        <div>
                          <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                            LOW
                          </span>
                          {row.suggested_quantity > 0 && (
                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                              Buy {row.suggested_quantity} {row.unit}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default Stock;
```

- [ ] **Step 2: Verify in the browser**

Run the backend against the test DB (Task 6.3), then `cd frontend && npm run dev`. Open `/stock`.

Check, **with the browser at 390px wide (iPhone width)**:
- The four stat tiles fit two-per-row without overflow.
- Items render as cards, not a squashed table.
- The page does **not** scroll horizontally.
- The low-stock filter toggles and the list updates.
- An item with attributes shows them as small chips under its name (hover a chip on desktop to see the attribute name).
- Picking a value in the attribute filter (grouped by attribute) narrows the list to items carrying it; "All attributes" clears it.
- Typing in search does not fire a request per keystroke (watch the network tab — one request 300ms after you stop).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Stock.jsx
git commit -m "feat(inventory): mobile-first stock page with search, filters, pagination"
```

### Task 9.2: Daily stock issue entry — the most important screen

**Files:**
- Modify: `frontend/src/pages/CreateStockIssue.jsx`

This is the screen the factory user touches every single day, standing up, on a phone. **If it is slow or fiddly, he stops using it and every number in this module rots.** Design targets: date pre-filled to today, recently-used items first, add-a-line in one tap, save reachable with a thumb.

- [ ] **Step 1: Write the page**

```jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaTrash, FaArrowLeft } from "react-icons/fa";
import { inventoryItemAPI, stockIssueAPI, stockAPI } from "../services/inventoryAPI";
import { orderAPI } from "../services/api";

const RECENT_ITEMS_KEY = "yars_recent_inventory_items";

/** Item ids the user issued most recently, newest first. Kept on the device. */
const getRecentItemIds = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_ITEMS_KEY) || "[]");
  } catch {
    return [];
  }
};

const rememberRecentItems = (itemIds) => {
  const existing = getRecentItemIds();
  const merged = [...itemIds, ...existing.filter((id) => !itemIds.includes(id))];
  localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(merged.slice(0, 8)));
};

const todayISO = () => new Date().toISOString().split("T")[0];

const CreateStockIssue = () => {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stockByItem, setStockByItem] = useState({});

  const [issueDate, setIssueDate] = useState(todayISO());
  const [issueType, setIssueType] = useState("ISSUE");
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([{ item_id: "", quantity: "", wastage_quantity: "" }]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isAdjustment = issueType === "ADJUSTMENT_IN" || issueType === "ADJUSTMENT_OUT";

  useEffect(() => {
    const load = async () => {
      try {
        const [itemData, orderResponse] = await Promise.all([
          inventoryItemAPI.getAllForPicker(),
          orderAPI.getAll(),
        ]);

        // Recently-issued items float to the top of the picker: on a phone,
        // scrolling a 40-item dropdown every day is the difference between
        // this getting used and not.
        const recent = getRecentItemIds();
        const sorted = [...itemData].sort((a, b) => {
          const aRank = recent.indexOf(a.id);
          const bRank = recent.indexOf(b.id);
          if (aRank === -1 && bRank === -1) return a.name.localeCompare(b.name);
          if (aRank === -1) return 1;
          if (bRank === -1) return -1;
          return aRank - bRank;
        });

        setItems(sorted);
        setOrders(orderResponse.data.data || []);
      } catch (err) {
        console.error("Error loading issue form:", err);
        setError("Failed to load items. Please try again.");
      }
    };
    load();
  }, []);

  /** Show available stock next to the quantity box, so an over-issue is obvious BEFORE saving. */
  const loadStockFor = async (itemId) => {
    if (!itemId || stockByItem[itemId] !== undefined) return;
    try {
      const data = await stockAPI.getItemStock(itemId);
      setStockByItem((current) => ({ ...current, [itemId]: data.in_stock }));
    } catch (err) {
      console.error("Error loading item stock:", err);
    }
  };

  const updateLine = (index, field, value) => {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    );
    if (field === "item_id") loadStockFor(value);
  };

  const addLine = () => setLines((current) => [...current, { item_id: "", quantity: "", wastage_quantity: "" }]);

  const removeLine = (index) => setLines((current) => current.filter((_, i) => i !== index));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const validLines = lines.filter((line) => line.item_id && parseFloat(line.quantity) > 0);

    if (validLines.length === 0) {
      setError("Add at least one item with a quantity.");
      return;
    }

    if (isAdjustment && !reason.trim()) {
      setError("A reason is required for a stock adjustment.");
      return;
    }

    try {
      setSaving(true);

      await stockIssueAPI.create({
        issue_date: issueDate,
        issue_type: issueType,
        order_id: !isAdjustment && orderId ? orderId : null,
        reason: isAdjustment ? reason : null,
        notes: notes || null,
        items: validLines.map((line) => ({
          item_id: line.item_id,
          quantity: parseFloat(line.quantity),
          wastage_quantity: line.wastage_quantity ? parseFloat(line.wastage_quantity) : 0,
        })),
      });

      rememberRecentItems(validLines.map((line) => line.item_id));

      navigate("/stock-issues", { state: { message: "Stock issue recorded successfully" } });
    } catch (err) {
      console.error("Error recording stock issue:", err);
      // The backend's insufficient-stock message names the item and the shortfall.
      // Surface it verbatim — it is the most useful error in the app.
      setError(err.response?.data?.message || "Failed to record stock issue.");
    } finally {
      setSaving(false);
    }
  };

  const inputClasses =
    "w-full min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-gray-900 dark:text-emerald-50";

  return (
    <div className="p-4 sm:p-6 pb-28">
      <button
        type="button"
        onClick={() => navigate("/stock-issues")}
        className="flex items-center gap-2 mb-4 text-sm text-gray-600 dark:text-gray-400 min-h-[44px]"
      >
        <FaArrowLeft className="w-3 h-3" /> Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-emerald-50 mb-1">Record Stock Issue</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Material used in production today</p>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className={inputClasses}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <select value={issueType} onChange={(e) => setIssueType(e.target.value)} className={inputClasses}>
              <option value="ISSUE">Production issue</option>
              <option value="WASTAGE">Wastage write-off</option>
              <option value="ADJUSTMENT_OUT">Adjustment — remove stock</option>
              <option value="ADJUSTMENT_IN">Adjustment — add stock</option>
            </select>
          </div>
        </div>

        {isAdjustment && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Stock take shortfall, water damage"
              className={inputClasses}
              required
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Required. In six months this is the only thing that will explain the correction.
            </p>
          </div>
        )}

        {!isAdjustment && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Customer order <span className="text-gray-400">(optional)</span>
            </label>
            <select value={orderId} onChange={(e) => setOrderId(e.target.value)} className={inputClasses}>
              <option value="">Not linked to an order</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.customer?.name} — {new Date(order.order_date).toLocaleDateString("en-IN")}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-emerald-50">Items</h2>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-primary text-white text-sm font-medium"
            >
              <FaPlus className="w-3 h-3" /> Add item
            </button>
          </div>

          {lines.map((line, index) => {
            const selectedItem = items.find((item) => item.id === line.item_id);
            const available = stockByItem[line.item_id];
            const requested =
              (parseFloat(line.quantity) || 0) + (parseFloat(line.wastage_quantity) || 0);
            const exceedsStock = available !== undefined && requested > available;

            return (
              <div
                key={index}
                className="rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-4 space-y-3"
              >
                <div className="flex items-start gap-2">
                  <select
                    value={line.item_id}
                    onChange={(e) => updateLine(index, "item_id", e.target.value)}
                    className={inputClasses}
                  >
                    <option value="">Select item…</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.unit})
                      </option>
                    ))}
                  </select>

                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="shrink-0 flex items-center justify-center w-11 h-11 rounded-xl border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400"
                      aria-label="Remove item"
                    >
                      <FaTrash className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {available !== undefined && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Available: <span className="font-semibold">{available} {selectedItem?.unit}</span>
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Quantity used
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, "quantity", e.target.value)}
                      placeholder="0"
                      className={inputClasses}
                    />
                  </div>

                  {!isAdjustment && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Wastage <span className="text-gray-400">(optional)</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={line.wastage_quantity}
                        onChange={(e) => updateLine(index, "wastage_quantity", e.target.value)}
                        placeholder="0"
                        className={inputClasses}
                      />
                    </div>
                  )}
                </div>

                {exceedsStock && (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">
                    Only {available} {selectedItem?.unit} in stock — this needs {requested}.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={`${inputClasses} py-2`}
          />
        </div>

        {/* Thumb-reachable primary action, pinned on mobile. */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-[#0f1a16]/95 backdrop-blur border-t border-gray-200 dark:border-emerald-900/30 sm:static sm:p-0 sm:bg-transparent sm:dark:bg-transparent sm:border-0 sm:backdrop-blur-none">
          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[52px] rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Record issue"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateStockIssue;
```

- [ ] **Step 2: Verify on a phone-sized viewport**

At 390px wide:
- Date is already today — no tapping needed.
- Selecting an item shows its available stock immediately.
- Entering a quantity above available shows the red warning **before** saving.
- The "Record issue" button is pinned to the bottom and reachable with a thumb.
- Saving 500 with 20 wastage against an item with 1000 in stock leaves 480.
- Attempting an over-issue shows the backend's message naming the item and the available quantity.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/CreateStockIssue.jsx
git commit -m "feat(inventory): mobile-first daily stock issue entry with wastage"
```

### Task 9.3: Remaining pages

**Files:**
- Modify: `frontend/src/pages/StockItemDetail.jsx`, `StockIssues.jsx`, `PurchaseOrders.jsx`, `CreatePurchaseOrder.jsx`, `PurchaseOrderDetail.jsx`, `ReceivePurchaseOrder.jsx`, `InventoryItems.jsx`, `CreateInventoryItem.jsx`, `EditInventoryItem.jsx`, `Suppliers.jsx`, `CreateSupplier.jsx`, `EditSupplier.jsx`, `SupplierDetail.jsx`, `InventoryCategories.jsx`, `ItemAttributes.jsx`

These follow the patterns already established in Tasks 9.1 and 9.2 (data fetch → loading/empty/error → cards on mobile, table on `md:` → `<Pagination>`), and mirror existing pages in the codebase. Each is one task; commit after each.

- [ ] **Step 1: `StockItemDetail.jsx`** — clone the layout language of `Stock.jsx`.
  - Fetch: `stockAPI.getItemStock(itemId)` and `stockAPI.getItemMovements(itemId, { page })`.
  - Show: item name, category, unit, and the item's attribute values as chips (`item.attributes`, same `AttributeChips` treatment as `Stock.jsx`); stat tiles for in-stock and stock value; reorder level and whether it is low.
  - **Open batches table** (this is the FIFO story): received date, supplier, rate, quantity remaining, value. Sorted oldest first — the top row is what the next issue will consume.
  - **Movement history**, paginated, with a movement-type filter. Colour inbound movements (`RECEIPT`, `ADJUSTMENT_IN`) green and outbound (`ISSUE`, `WASTAGE`, `ADJUSTMENT_OUT`) red, and show the sign on the quantity.
  - Commit: `feat(inventory): item detail with FIFO batches and movement history`

- [ ] **Step 2: `StockIssues.jsx`** — list page, clone the shape of `Stock.jsx`.
  - Fetch: `stockIssueAPI.getAll({ page, search, issue_type, from_date, to_date })`.
  - Row: issue number, date, type badge, item count, total cost, wastage cost, linked order (if any).
  - Prominent "Record issue" button linking to `/stock-issues/new` — this is the daily action, it must be the first thing on the page.
  - Filters: date range, type. `<Pagination>` at the bottom.
  - Commit: `feat(inventory): stock issues list`

- [ ] **Step 3: `PurchaseOrders.jsx`** — list page.
  - Fetch: `purchaseOrderAPI.getAll({ page, search, supplier_id, status, from_date, to_date })`.
  - Row: PO number, supplier, order date, expected date, status badge (`PENDING` grey, `PARTIALLY_RECEIVED` amber, `RECEIVED` green, `CANCELLED` red), total value.
  - Commit: `feat(inventory): purchase order list`

- [ ] **Step 4: `CreatePurchaseOrder.jsx`** — form.
  - Suppliers from `supplierAPI.getAllForPicker()`, items from `inventoryItemAPI.getAllForPicker()`.
  - Fields: supplier, order date, expected date, notes, and repeating item lines (item, quantity, rate) with a live line total and grand total.
  - Same add-line / remove-line pattern as `CreateStockIssue.jsx`, same pinned submit button on mobile.
  - POST via `purchaseOrderAPI.create`, then navigate to the new PO's detail page.
  - Commit: `feat(inventory): create purchase order`

- [ ] **Step 5: `PurchaseOrderDetail.jsx`** — the ordered-vs-received view.
  - Fetch: `purchaseOrderAPI.getById(id)`. The backend already returns `quantity_pending` per line.
  - Per line show **Ordered / Received / Pending** side by side. This is the answer to "how much did we order, how much came".
  - A **Receive** button (hidden when status is `RECEIVED` or `CANCELLED`) linking to `/purchase-orders/:id/receive`.
  - List the goods receipts already made against this PO, each with its date and quantities.
  - Commit: `feat(inventory): purchase order detail with ordered vs received`

- [ ] **Step 6: `ReceivePurchaseOrder.jsx`** — the receive form.
  - Fetch the PO, **pre-fill each line's quantity with its `quantity_pending`** and its rate with the PO rate — the common case is "everything arrived as ordered", and that should be one tap.
  - Both quantity and rate stay **editable**: partial deliveries and price changes are normal.
  - Setting a line's quantity to 0 excludes it from the receipt (filter those out before POSTing).
  - Warn (do not block) when a quantity exceeds the pending amount: *"This is more than the outstanding quantity. Over-receipt will be recorded."*
  - Fields: receipt date (default today), supplier bill reference, notes.
  - POST via `purchaseOrderAPI.receive(id, payload)`, then navigate back to the PO detail.
  - Commit: `feat(inventory): receive material against a purchase order`

- [ ] **Step 7: `InventoryItems.jsx`, `CreateInventoryItem.jsx`, `EditInventoryItem.jsx`** — item CRUD.
  - List: `inventoryItemAPI.getAll({ page, search, category_id, attribute_value_id })`; row shows name, code, category, unit, attribute chips (same `AttributeChips` treatment as `Stock.jsx`), reorder level; edit and delete actions; the same grouped attribute-value filter as `Stock.jsx` in the filter row; links to **Categories** and **Item Attributes** in the header (mirroring how `Expenses.jsx` links to Expense Categories).
  - Form fields: name, item code, category (from `inventoryCategoryAPI.getAll()`), unit (fixed select: KG / PCS / METRE / ROLL / LITRE), one dropdown per attribute (see below), reorder level, reorder target, notes.
  - **Attribute dropdowns:** fetch `itemAttributesAPI.getAll()` and render **one `<select>` per non-archived attribute**, labelled with the attribute's name, listing its non-archived values, with a "—" empty first option. Every one is optional. Selections are held as `{ [attribute_id]: value_id }` and POSTed as `attribute_value_ids: Object.values(selections).filter(Boolean)`. One value per attribute needs no client-side juggling — a single-select per attribute cannot produce two.
  - `EditInventoryItem.jsx` pre-selects from the item's `attributes` array (`value_id` keyed by `attribute_id`), and always sends `attribute_value_ids` on save so cleared dropdowns actually clear.
  - There are **no GSM or colour inputs** — those are just the seeded "GSM" and "Color" attributes, rendered by the same loop as everything else.
  - Delete surfaces the backend's refusal message when the item still has stock.
  - Commit: `feat(inventory): inventory item CRUD pages with attribute dropdowns`

- [ ] **Step 8: `Suppliers.jsx`, `CreateSupplier.jsx`, `EditSupplier.jsx`, `SupplierDetail.jsx`** — supplier CRUD.
  - Clone `Customers.jsx` / `CreateCustomer.jsx` / `EditCustomer.jsx` / `CustomerDetails.jsx`, swapping `customerAPI` for `supplierAPI` and the fields for name / phone / email / GST / address.
  - The list is paginated (unlike Customers) — use `<Pagination>`.
  - Detail page shows the supplier's purchase orders.
  - Commit: `feat(inventory): supplier CRUD pages`

- [ ] **Step 9: `InventoryCategories.jsx`** — category CRUD.
  - Clone `ExpenseCategories.jsx` wholesale, swapping `expenseCategoryAPI` for `inventoryCategoryAPI`. Same inline add/edit/delete, same search, same success/error banners.
  - Not paginated — `inventoryCategoryAPI.getAll()` returns a plain array.
  - The delete failure message from the backend ("Cannot delete this category as it is being used by inventory items") must be shown to the user, not swallowed.
  - Commit: `feat(inventory): inventory category CRUD page`

- [ ] **Step 10: `ItemAttributes.jsx`** — attribute and value management.
  - Fetch: `itemAttributesAPI.getAll()` — every attribute with its values nested; not paginated. Refetch after every mutation, since one response carries the whole tree.
  - **Accordion list**, one card per attribute: the collapsed row shows the attribute name, a value count (e.g. "4 values"), and rename/delete actions; tapping the row expands its values. One attribute expanded at a time — this is a phone screen.
  - Inside an expanded card: each value as a row with inline rename/delete (same inline-edit pattern as `InventoryCategories.jsx`), plus an "Add value" input + button at the bottom (`itemAttributesAPI.createValue(attributeId, { value })`).
  - "Add attribute" at the top of the page (`itemAttributesAPI.create({ name })`) — a freshly created attribute starts with zero values, exactly like the seeded Color.
  - Both delete guards surface the backend's refusal messages verbatim ("Cannot delete this attribute/value as it is being used by inventory items") — never swallowed. Deletes go through `ConfirmationModal`, like every other destructive action in the app.
  - Same success/error banner pattern, dark-mode classes, and ≥44px tap targets as `InventoryCategories.jsx`.
  - Reached from the Inventory Items page header, beside the Categories link (Step 7).
  - Commit: `feat(inventory): item attribute management page`

---

# Phase 10 — End-to-end verification and rollout

### Task 10.1: Full-suite verification

- [ ] **Step 1: Backend tests**

```bash
cd backend && npm run test:db:up && sleep 3 && npm run test:migrate && npm test
```
Expected: **37 passing, 0 failing** (documentNumber 3, pagination 6, stock 3, receive 7, issue 10, adjust 5, invariant 3). Report the real number — if it differs, say so rather than rounding it off.

- [ ] **Step 2: Frontend build and lint**

```bash
cd frontend && npm run lint && npm run build
```
Expected: both clean. Lint errors in new files must be fixed, not ignored.

- [ ] **Step 3: Drive the real flow in the browser**

Backend on the test DB, `npm run dev` on the frontend, **browser at 390px wide**. Walk the whole lifecycle:

1. Create a category "Fabric" → appears in the list.
2. Create a supplier "Sharma Textiles".
3. On `/item-attributes` (linked from Inventory Items): add attribute "GSM" with values 60 and 90, and "Cut" with value "W Cut" (the test DB runs no seeders, so this also exercises the attribute page). Try deleting "GSM" now → allowed, nothing uses it yet; re-add it.
4. Create an item: 90 GSM White, KG, reorder level 200, reorder target 800, picking **GSM: 90** and **Cut: W Cut** from the attribute dropdowns.
5. `/stock` shows it at 0, flagged **LOW**, suggesting a purchase of 800, with "90" and "W Cut" chips under its name. The attribute filter set to GSM → 60 hides it; GSM → 90 shows it.
6. Back on `/item-attributes`: deleting the value "90" is now **refused** ("being used by inventory items"). Renaming "GSM" to "Grammage" works and the item's chip tooltip follows.
7. Raise a PO: 500 kg @ ₹80. Status `PENDING`. `/stock` now shows **on order: 500**.
8. Receive 200 kg of it. PO → `PARTIALLY_RECEIVED`, line shows Ordered 500 / Received 200 / Pending 300.
9. `/stock`: in stock **200**, value **₹16,000**, on order **300**, still LOW (200 ≤ 200).
10. Receive the remaining 300 kg **at ₹90** (price went up). PO → `RECEIVED`.
11. Item detail shows **two batches**: 200 @ ₹80 and 300 @ ₹90. Stock 500, value ₹43,000.
12. Record an issue: 250 kg used, 10 kg wastage.
13. Item detail: the ₹80 batch is **gone** (200 consumed), the ₹90 batch has 240 left. Stock **240**.
    Movement history shows the consumption **split across both batches at their own rates** — this is FIFO working.
14. Try to issue 9,999 kg → refused with *"Insufficient stock for 90 GSM White: tried to issue 9999 KG, but only 240 KG available"*. Stock unchanged.
15. Export to Excel → three sheets, numbers match the screen, and the Stock sheet's **Attributes** column reads `Cut: W Cut; Grammage: 90`.

Confirm at every step that the page **does not scroll horizontally** on the phone-width viewport.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A backend/ frontend/
git commit -m "fix(inventory): issues found in end-to-end verification"
```

### Task 10.2: Production rollout

⚠️ **The production database is Supabase and it holds the real business's live data. There are no backups configured that this plan knows about.** Do not run migrations against it casually.

- [ ] **Step 1: Back up production first**

```bash
pg_dump "postgresql://postgres:<password>@db.tnrwottbdozuvdcmugve.supabase.co:5432/postgres" \
  --schema-only -f ~/yars-schema-backup-$(date +%F).sql
pg_dump "postgresql://postgres:<password>@db.tnrwottbdozuvdcmugve.supabase.co:5432/postgres" \
  -f ~/yars-full-backup-$(date +%F).sql
```
Do not proceed until the dump file exists and is non-empty. Every migration in this module is additive (new tables, plus new values on one enum), so the risk is low — but "low" is not "zero", and this is the business's only copy of its data.

- [ ] **Step 2: Migrate production**

```bash
cd backend && NODE_ENV=production npm run migrate
```
Watch for the `audit_logs` enum migration specifically — it is the one that behaves differently in Postgres. If it fails with *"ALTER TYPE ... cannot run inside a transaction block"*, that migration is being wrapped in a transaction; fix it and re-run.

- [ ] **Step 3: Seed the default categories and attributes**

```bash
cd backend && NODE_ENV=production npx sequelize db:seed --seed 20260711000001-inventory-categories.js
cd backend && NODE_ENV=production npx sequelize db:seed --seed 20260711000002-item-attributes.js
```
Seed **only these two files**. Running `db:seed:all` would re-run the existing seeders and duplicate the expense categories, plate types, and product sizes already in production.

- [ ] **Step 4: Deploy the backend to Cloud Run**

The backend runs on Cloud Run in `asia-south1` (`yars-backend-848592267490.asia-south1.run.app`), built from `backend/Dockerfile`. Deploy with whatever command was used previously — check shell history or the GCP console for the existing service's build trigger. Then confirm:

```bash
curl -s https://yars-backend-848592267490.asia-south1.run.app/api/health
curl -s https://yars-backend-848592267490.asia-south1.run.app/api/stock/summary
```
Expected: health returns `{"status":"OK",...}`, and the stock summary returns zeroes (no inventory data yet). If the summary 500s, the migrations did not reach production.

- [ ] **Step 5: Deploy the frontend to Firebase**

```bash
cd frontend && npm run build && npx firebase deploy --only hosting
```
Target project is `yars-dashboard` (`frontend/.firebaserc`). Then open `https://yars-dashboard.web.app/stock` **on an actual phone** and confirm the Stock page and the issue form work on real hardware — a 390px browser window is not the same as a thumb on a real screen.

- [ ] **Step 6: Seed the real data with the user**

The module is worthless until the real items exist. Sit with the user and enter:
- The business's actual colours as values under the seeded **Color** attribute (it ships empty on purpose), plus any missing Cut or GSM values.
- The fabric grades actually stocked, picking GSM / Cut / Color from the attribute dropdowns, with honest reorder levels.
- The consumables (handles, thread, ink, packing).
- The real suppliers.
- An opening stock figure per item — enter these as **`ADJUSTMENT_IN`** with the reason *"Opening stock"*, so day one has a real starting position and an honest audit trail.

- [ ] **Step 7: Commit and merge**

```bash
git add -A
git commit -m "feat(inventory): raw material inventory module"
```
Then use the finishing-a-development-branch skill to decide how this lands on `main`.

---

## Out of scope (explicitly not built)

Do not build these, even if they seem obviously useful:
- **Authentication / per-user attribution.** The app has one shared hardcoded credential and the backend authenticates nothing. Adding a second daily user (the factory) makes this worse, and it must be addressed — but as its own piece of work, not smuggled into this one.
- Linking fabric to customer orders, or auto-deducting stock when an order completes.
- Finished-goods stock.
- Purchase-unit → stock-unit conversion (buy by the roll, stock in kg).
- Migrating historical material rows out of Expenses.
- Multi-location / warehouse stock.
