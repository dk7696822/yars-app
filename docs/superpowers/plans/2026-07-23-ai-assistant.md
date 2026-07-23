# AI Assistant Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In-app chat assistant (Gemini 2.5 Flash) that answers data questions via a triple-guarded read-only SQL tool, explains the app from a markdown knowledge base, deep-links into screens, streams answers over SSE, and persists conversations.

**Architecture:** New `assistant` backend module: SSE endpoint runs an agent loop (`assistantService`) that streams Gemini output and executes a single `run_query` tool against a dedicated read-only Postgres role. System prompt = instructions + `backend/knowledge/*.md`. Frontend: an Assistant page (conversation list + chat) plus a floating button, streaming via `fetch` + `ReadableStream`.

**Tech Stack:** Express 5, Sequelize 6 (conversations/messages), raw `pg` Pool for the read-only tool, `@google/genai` SDK, React 19 + `react-markdown`.

**Spec:** `docs/superpowers/specs/2026-07-23-ai-assistant-design.md` — **Depends on the auth plan (`2026-07-23-auth.md`) being implemented first.**

**Conventions:** `"use strict"`; UUID PKs; `underscored: true`; `success()`/`error()` helpers; pagination via `src/utils/pagination.js`; stage git files by explicit path, never `git add .` in backend/.

---

### Task 1: Conversation + message tables and models

**Files:**
- Create: `backend/src/migrations/20260723000002-create-assistant-conversations.js`
- Create: `backend/src/migrations/20260723000003-create-assistant-messages.js`
- Create: `backend/src/models/assistantConversation.js`
- Create: `backend/src/models/assistantMessage.js`

- [x] **Step 1: Conversations migration**

```js
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("assistant_conversations", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      title: { type: Sequelize.TEXT, allowNull: false, defaultValue: "New conversation" },
      is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("assistant_conversations");
  },
};
```

- [x] **Step 2: Messages migration**

```js
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("assistant_messages", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "assistant_conversations", key: "id" },
        onDelete: "CASCADE",
      },
      role: { type: Sequelize.TEXT, allowNull: false }, // 'user' | 'assistant'
      content: { type: Sequelize.TEXT, allowNull: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
    await queryInterface.addIndex("assistant_messages", ["conversation_id", "created_at"]);
  },
  async down(queryInterface) {
    await queryInterface.dropTable("assistant_messages");
  },
};
```

- [x] **Step 3: Models** (`assistantConversation.js`)

```js
"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class AssistantConversation extends Model {
    static associate(models) {
      AssistantConversation.hasMany(models.AssistantMessage, {
        foreignKey: "conversation_id",
        as: "messages",
      });
    }
  }

  AssistantConversation.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      title: { type: DataTypes.TEXT, allowNull: false, defaultValue: "New conversation" },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, modelName: "AssistantConversation", tableName: "assistant_conversations", timestamps: true, underscored: true }
  );

  return AssistantConversation;
};
```

`assistantMessage.js`:

```js
"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class AssistantMessage extends Model {
    static associate(models) {
      AssistantMessage.belongsTo(models.AssistantConversation, {
        foreignKey: "conversation_id",
        as: "conversation",
      });
    }
  }

  AssistantMessage.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      conversation_id: { type: DataTypes.UUID, allowNull: false },
      role: { type: DataTypes.TEXT, allowNull: false, validate: { isIn: [["user", "assistant"]] } },
      content: { type: DataTypes.TEXT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, modelName: "AssistantMessage", tableName: "assistant_messages", timestamps: true, underscored: true }
  );

  return AssistantMessage;
};
```

- [x] **Step 4: Migrate test DB + add tables to the TRUNCATE list**

Run: `cd backend && npm run test:migrate` → both migrations apply.
In `backend/tests/setup.js` `TABLES`, prepend `"assistant_messages", "assistant_conversations",` at the TOP of the array (children before parents, matching the existing style).

- [x] **Step 5: Commit**

```bash
git add backend/src/migrations/20260723000002-create-assistant-conversations.js backend/src/migrations/20260723000003-create-assistant-messages.js backend/src/models/assistantConversation.js backend/src/models/assistantMessage.js backend/tests/setup.js
git commit -m "feat(assistant): conversation and message tables"
```

---

### Task 2: SQL guard (TDD — security boundary)

**Files:**
- Create: `backend/src/services/assistant/sqlGuard.js`
- Test: `backend/tests/sqlGuard.test.js`

- [x] **Step 1: Write the failing tests**

```js
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
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- sqlGuard`
Expected: FAIL — module not found.

- [x] **Step 3: Implement**

```js
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
```

(Note: `FOR UPDATE` already trips the `update` keyword ban; the explicit lock regex additionally catches `FOR SHARE`, which contains no banned word.)

- [x] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- sqlGuard`
Expected: all pass.

- [x] **Step 5: Commit**

```bash
git add backend/src/services/assistant/sqlGuard.js backend/tests/sqlGuard.test.js
git commit -m "feat(assistant): strict SQL validator for the read-only tool"
```

---

### Task 3: Read-only DB executor

**Files:**
- Create: `backend/src/services/assistant/assistantDb.js`
- Modify: `backend/.env.test` — add `ASSISTANT_DB_URL=postgres://<test user>:<test pass>@localhost:5433/<test db>` (copy exact user/pass/db from the existing `.env.test` / `docker-compose.test.yml` values)
- Test: `backend/tests/assistantDb.test.js`

- [x] **Step 1: Write the failing test** (locally the role isn't SELECT-only — that layer exists only on Supabase; these tests cover the code path: guard applied, rows returned, output truncated)

```js
"use strict";

const { runQuery, closePool } = require("../src/services/assistant/assistantDb");
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
    await expect(runQuery("DELETE FROM suppliers")).rejects.toThrow(/not allowed/i);
  });

  test("truncates oversized results", async () => {
    const out = await runQuery("SELECT repeat('x', 500) AS blob FROM generate_series(1, 100)");
    expect(out.length).toBeLessThanOrEqual(8100);
    expect(out).toMatch(/truncated/i);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- assistantDb`
Expected: FAIL — module not found.

- [x] **Step 3: Implement**

```js
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
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
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
```

(Match the SSL option to how `src/config/database.js` connects to Supabase in production — read that file and copy its ssl settings.)

- [x] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- assistantDb`
Expected: 3 passed.

- [x] **Step 5: Commit**

```bash
git add backend/src/services/assistant/assistantDb.js backend/tests/assistantDb.test.js
git commit -m "feat(assistant): read-only query executor with truncation"
```

---

### Task 4: Knowledge base content

**Files:**
- Create: `backend/knowledge/00-instructions.md`, `backend/knowledge/schema.md`, `backend/knowledge/routes.md`, and one file per module: `dashboard.md`, `customers.md`, `orders.md`, `invoices.md`, `payments.md`, `expenses.md`, `inventory.md`, `history.md`

This task is authored, not coded: each module file is written **by reading the actual frontend JSX** so button labels, field names, and step orders are real. Budget the bulk of this task for reading `frontend/src/pages/*.jsx`.

- [x] **Step 1: Write `00-instructions.md`** (behavioral rules — use this content verbatim)

```markdown
# Assistant instructions

You are the built-in assistant for the YARS app — a back-office system for a
non-woven bags factory, used by two people on phones. Hindi-English mixed
questions are normal; answer in the language the user used.

Rules:
- For any question about live data (customers, orders, dues, stock, expenses),
  ALWAYS use the run_query tool. Never answer data questions from memory.
- All money is INR. Format amounts as ₹12,345.67.
- DECIMAL columns come back as strings — treat them as numbers when summarising.
- Unless the user asks about archived/deleted records, always filter
  `is_archived = false`.
- When you explain how to do something in the app, give numbered steps using the
  exact button and field labels from the knowledge base, and include a markdown
  link to the screen (e.g. [Open Stock Issues](/stock-issues)). Links MUST be
  app-relative paths from routes.md — never external URLs.
- If a query fails, fix it and retry. If you cannot answer, say so plainly —
  never invent numbers.
- Keep answers short — they are read on a phone. Tables only when listing >3 rows.
```

- [x] **Step 2: Write `routes.md`** — enumerate every route from `frontend/src/App.jsx` as `| path | screen | what it's for |` table rows. Read App.jsx and list them all (`/`, `/orders`, `/orders/new`, `/orders/:id`, `/customers`, … through `/item-attributes`), plus `/assistant` itself.

- [x] **Step 3: Write `schema.md`** — for each table: name, columns (name + type + meaning), key relationships, and quirks. Source it by reading `backend/src/models/*.js` (all 26 files). Include the global notes: UUID PKs; `is_archived` soft deletes; DECIMAL returned as string; `stock_batches.quantity_remaining` sums are authoritative stock; `stock_movements` is append-only with signed quantities; document numbers like `PO-2026-0001`.

- [x] **Step 4: Write the eight module files.** For each: read the module's pages in `frontend/src/pages/` and write (a) what the module is for, (b) domain-term definitions, (c) a walkthrough per user action with exact labels and ordered steps, (d) route links. Level of detail to hit — worked example for one section of `inventory.md`:

```markdown
## Recording a stock issue (with wastage)

A stock issue records raw material taken out of stock for production. Wastage
on the same line means: of the material consumed, that much was wasted — it is
consumed from stock along with the issued quantity (issue 500 + 20 wastage
consumes 520, FIFO order).

Steps:
1. Open [Stock Issues](/stock-issues) and tap **New Issue** (top right).
2. Pick the item in the **Item** dropdown — current stock is shown next to it.
3. Enter **Quantity** (what production takes) and, if some material was spoiled,
   the **Wastage** quantity on the same line.
4. Add more lines with **Add Item** if several materials go out together.
5. Optionally fill **Notes** (e.g. which order it's for).
6. Tap **Create Issue**. Stock reduces immediately (FIFO batches).

Corrections: issues cannot be edited or deleted. To fix a mistake, record an
Adjustment (In) from the [Stock](/stock) screen with a reason.
```

Files ↔ source pages: `dashboard.md` ← Dashboard.jsx; `customers.md` ← Customers/CreateCustomer/EditCustomer/CustomerDetails; `orders.md` ← Orders/CreateOrder/EditOrder/OrderDetails (+ plate types & product sizes pages); `invoices.md` ← Invoices/GenerateInvoice/InvoiceDetails; `payments.md` ← Payments pages; `expenses.md` ← Expenses/CreateExpense/EditExpense/ExpenseCategories; `inventory.md` ← Stock/StockItemDetail/InventoryItems/PurchaseOrders/ReceivePurchaseOrder/StockIssues/Suppliers/InventoryCategories/ItemAttributes pages; `history.md` ← History.jsx.

- [x] **Step 5: Commit**

```bash
git add backend/knowledge/
git commit -m "feat(assistant): knowledge base (instructions, schema, routes, module walkthroughs)"
```

---

### Task 5: Knowledge loader

**Files:**
- Create: `backend/src/services/assistant/knowledgeLoader.js`
- Test: `backend/tests/knowledgeLoader.test.js`

- [x] **Step 1: Write the failing test**

```js
"use strict";

const { loadKnowledge } = require("../src/services/assistant/knowledgeLoader");

describe("knowledgeLoader", () => {
  test("concatenates all knowledge files with filename headers", () => {
    const text = loadKnowledge();
    expect(text).toContain("Assistant instructions"); // from 00-instructions.md
    expect(text).toContain("<!-- knowledge: routes.md -->");
    expect(text.length).toBeGreaterThan(1000);
  });

  test("caches: second call returns the same string instance", () => {
    expect(loadKnowledge()).toBe(loadKnowledge());
  });
});
```

- [x] **Step 2: Run to verify it fails** — `cd backend && npm test -- knowledgeLoader` → module not found.

- [x] **Step 3: Implement**

```js
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
```

- [x] **Step 4: Run to verify pass**, then **Step 5: Commit**

```bash
git add backend/src/services/assistant/knowledgeLoader.js backend/tests/knowledgeLoader.test.js
git commit -m "feat(assistant): knowledge loader with mtime cache"
```

---

### Task 6: Agent loop service (TDD with a fake Gemini)

**Files:**
- Create: `backend/src/services/assistant/assistantService.js`
- Test: `backend/tests/assistantService.test.js`
- Modify: `backend/package.json` — `cd backend && npm install @google/genai` (also add `GEMINI_API_KEY=fake-test-key` to `backend/.env.test`)

The service is dependency-injected so tests never touch the network: `runAgent(history, callbacks, deps)` where `deps = { generateStream, runQuery }` defaults to the real Gemini client and `assistantDb.runQuery`.

- [x] **Step 1: Write the failing tests**

```js
"use strict";

const { runAgent, MAX_ROUNDS } = require("../src/services/assistant/assistantService");

// Helper: a fake generateStream that yields the given chunks per round.
// Each chunk mimics @google/genai stream chunks: { text, functionCalls }.
const fakeGemini = (rounds) => {
  let call = 0;
  return async function* generateStream() {
    const chunks = rounds[Math.min(call, rounds.length - 1)];
    call += 1;
    for (const c of chunks) yield c;
  };
};

const collect = () => {
  const events = { deltas: [], statuses: [] };
  return {
    events,
    callbacks: {
      onDelta: (t) => events.deltas.push(t),
      onStatus: (t) => events.statuses.push(t),
    },
  };
};

describe("assistantService.runAgent", () => {
  test("plain answer: streams deltas, returns final text, no tools", async () => {
    const { events, callbacks } = collect();
    const final = await runAgent(
      [{ role: "user", content: "hi" }],
      callbacks,
      { generateStream: fakeGemini([[{ text: "Hello " }, { text: "there" }]]), runQuery: jest.fn() }
    );
    expect(final).toBe("Hello there");
    expect(events.deltas).toEqual(["Hello ", "there"]);
  });

  test("tool round-trip: executes run_query, emits status, continues", async () => {
    const runQuery = jest.fn().mockResolvedValue('{"rowCount":1,"rows":[{"n":42}]}');
    const { events, callbacks } = collect();
    const final = await runAgent(
      [{ role: "user", content: "how many customers?" }],
      callbacks,
      {
        generateStream: fakeGemini([
          [{ functionCalls: [{ name: "run_query", args: { query: "SELECT count(*) AS n FROM customers" } }] }],
          [{ text: "You have 42 customers." }],
        ]),
        runQuery,
      }
    );
    expect(runQuery).toHaveBeenCalledWith("SELECT count(*) AS n FROM customers");
    expect(events.statuses.length).toBeGreaterThan(0);
    expect(final).toBe("You have 42 customers.");
  });

  test("failed query is fed back to the model, which recovers", async () => {
    const runQuery = jest.fn().mockRejectedValue(new Error("column does not exist"));
    const { callbacks } = collect();
    const final = await runAgent(
      [{ role: "user", content: "q" }],
      callbacks,
      {
        generateStream: fakeGemini([
          [{ functionCalls: [{ name: "run_query", args: { query: "SELECT bad FROM customers" } }] }],
          [{ text: "Sorry, I could not find that." }],
        ]),
        runQuery,
      }
    );
    expect(final).toBe("Sorry, I could not find that.");
  });

  test("round cap: stops calling tools after MAX_ROUNDS", async () => {
    const runQuery = jest.fn().mockResolvedValue('{"rowCount":0,"rows":[]}');
    const toolRound = [{ functionCalls: [{ name: "run_query", args: { query: "SELECT 1" } }] }];
    const rounds = Array.from({ length: MAX_ROUNDS }, () => toolRound);
    rounds.push([{ text: "Best effort answer." }]);
    const { callbacks } = collect();
    const final = await runAgent([{ role: "user", content: "q" }], callbacks, {
      generateStream: fakeGemini(rounds),
      runQuery,
    });
    expect(runQuery).toHaveBeenCalledTimes(MAX_ROUNDS);
    expect(final).toBe("Best effort answer.");
  });
});
```

- [x] **Step 2: Run to verify fail** — `cd backend && npm test -- assistantService` → module not found.

- [x] **Step 3: Implement**

```js
"use strict";

const { GoogleGenAI, Type } = require("@google/genai");
const { loadKnowledge } = require("./knowledgeLoader");
const { runQuery: dbRunQuery } = require("./assistantDb");

const MODEL = "gemini-2.5-flash";
const MAX_ROUNDS = 6;

const FUNCTION_DECLARATIONS = [
  {
    name: "run_query",
    description:
      "Run a single read-only SQL SELECT against the YARS Postgres database. " +
      "Use the schema in your instructions. Results come back as JSON " +
      "{rowCount, rows}, capped at 200 rows.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "One SELECT (or WITH…SELECT) statement, no comments." },
      },
      required: ["query"],
    },
  },
];

let ai = null;
const getAi = () => {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
};

// Real Gemini stream, matching the injectable interface used in tests.
async function* realGenerateStream({ contents, allowTools }) {
  const stream = await getAi().models.generateContentStream({
    model: MODEL,
    contents,
    config: {
      systemInstruction: loadKnowledge(),
      tools: allowTools ? [{ functionDeclarations: FUNCTION_DECLARATIONS }] : undefined,
    },
  });
  for await (const chunk of stream) {
    yield { text: chunk.text, functionCalls: chunk.functionCalls };
  }
}

/**
 * @param {Array<{role: 'user'|'assistant', content: string}>} history - persisted messages, oldest first (last one is the new user message)
 * @param {{onDelta: Function, onStatus: Function}} callbacks
 * @param {{generateStream?: Function, runQuery?: Function}} deps - injected in tests
 * @returns {Promise<string>} the final assistant text
 */
const runAgent = async (history, { onDelta, onStatus }, deps = {}) => {
  const generateStream = deps.generateStream || realGenerateStream;
  const runQuery = deps.runQuery || dbRunQuery;

  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let finalText = "";

  for (let round = 0; round <= MAX_ROUNDS; round += 1) {
    const allowTools = round < MAX_ROUNDS;
    let roundText = "";
    const calls = [];

    for await (const chunk of generateStream({ contents, allowTools })) {
      if (chunk.text) {
        roundText += chunk.text;
        onDelta(chunk.text);
      }
      if (chunk.functionCalls) calls.push(...chunk.functionCalls);
    }

    if (calls.length === 0) {
      finalText += roundText;
      return finalText;
    }

    // Text emitted before a tool call is preamble — keep it in the final answer.
    finalText += roundText;

    contents.push({
      role: "model",
      parts: [
        ...(roundText ? [{ text: roundText }] : []),
        ...calls.map((fc) => ({ functionCall: { name: fc.name, args: fc.args } })),
      ],
    });

    onStatus("Looking at the database…");

    const responseParts = [];
    for (const fc of calls) {
      let result;
      try {
        result = await runQuery(fc.args.query);
      } catch (err) {
        result = JSON.stringify({ error: err.message });
      }
      responseParts.push({
        functionResponse: { name: fc.name, response: { result } },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return finalText || "I could not finish answering that — please try rephrasing.";
};

module.exports = { runAgent, MAX_ROUNDS, FUNCTION_DECLARATIONS };
```

- [x] **Step 4: Run to verify pass** — `cd backend && npm test -- assistantService` → 4 passed.

- [x] **Step 5: One real smoke test against Gemini (manual, not committed as a test)** _(done with the new key; model switched to `gemini-flash-latest` — versioned IDs are gated for new projects; thought-signature echo fix required and added)_

Run: `cd backend && GEMINI_API_KEY=<real key> node -e "
const { runAgent } = require('./src/services/assistant/assistantService');
runAgent([{role:'user',content:'Say hello in 3 words'}], {onDelta:process.stdout.write.bind(process.stdout), onStatus:console.log}).then(()=>console.log('\nOK'));
"`
Expected: streamed greeting then `OK`. If the SDK's chunk shape differs (`chunk.text` as getter vs property), fix `realGenerateStream` here — the tests pin the internal interface, so only this adapter changes.

- [x] **Step 6: Commit**

```bash
git add backend/src/services/assistant/assistantService.js backend/tests/assistantService.test.js backend/package.json backend/package-lock.json
git commit -m "feat(assistant): Gemini agent loop with injected tool execution"
```

---

### Task 7: Controller + routes (conversations CRUD + SSE endpoint)

**Files:**
- Create: `backend/src/controllers/assistantController.js`
- Create: `backend/src/routes/assistantRoutes.js`
- Modify: `backend/src/routes/index.js` (mount after authMiddleware, with the other modules)
- Test: `backend/tests/assistantController.test.js` (CRUD only; the SSE handler is exercised by the Task 6 tests + manual verification)

- [x] **Step 1: Write the failing CRUD tests**

```js
"use strict";

const db = require("../src/models");
const {
  listConversations,
  createConversation,
  getConversation,
  deleteConversation,
} = require("../src/controllers/assistantController");

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("assistant conversations CRUD", () => {
  test("create → list → get → delete lifecycle", async () => {
    // create
    let res = mockRes();
    await createConversation({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const conv = res.json.mock.calls[0][0].data;

    // add a message directly, then get
    await db.AssistantMessage.create({ conversation_id: conv.id, role: "user", content: "hello" });
    res = mockRes();
    await getConversation({ params: { id: conv.id } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.messages).toHaveLength(1);

    // list excludes nothing yet
    res = mockRes();
    await listConversations({ query: {} }, res);
    expect(res.json.mock.calls[0][0].data.data).toHaveLength(1);

    // delete = archive
    res = mockRes();
    await deleteConversation({ params: { id: conv.id } }, res);
    expect(res.status).toHaveBeenCalledWith(200);

    // list now empty
    res = mockRes();
    await listConversations({ query: {} }, res);
    expect(res.json.mock.calls[0][0].data.data).toHaveLength(0);
  });

  test("get unknown id → 404", async () => {
    const res = mockRes();
    await getConversation({ params: { id: "11111111-1111-4111-8111-111111111111" } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
```

- [x] **Step 2: Run to verify fail**, then **Step 3: Implement the controller**

```js
"use strict";

const { AssistantConversation, AssistantMessage } = require("../models");
const { success, error } = require("../utils/response");
const { getPagination, buildPaginatedResponse } = require("../utils/pagination");
const { runAgent } = require("../services/assistant/assistantService");

const listConversations = async (req, res) => {
  try {
    const pagination = getPagination(req.query);
    const { rows, count } = await AssistantConversation.findAndCountAll({
      where: { is_archived: false },
      order: [["updated_at", "DESC"]],
      limit: pagination.limit,
      offset: pagination.offset,
    });
    return success(res, 200, "Conversations", buildPaginatedResponse(rows, count, pagination));
  } catch (err) {
    console.error(err);
    return error(res, 500, "Failed to list conversations");
  }
};

const createConversation = async (req, res) => {
  try {
    const conv = await AssistantConversation.create({});
    return success(res, 201, "Conversation created", conv);
  } catch (err) {
    console.error(err);
    return error(res, 500, "Failed to create conversation");
  }
};

const getConversation = async (req, res) => {
  try {
    const conv = await AssistantConversation.findOne({
      where: { id: req.params.id, is_archived: false },
      include: [{ model: AssistantMessage, as: "messages" }],
      order: [[{ model: AssistantMessage, as: "messages" }, "created_at", "ASC"]],
    });
    if (!conv) return error(res, 404, "Conversation not found");
    return success(res, 200, "Conversation", conv);
  } catch (err) {
    console.error(err);
    return error(res, 500, "Failed to load conversation");
  }
};

const deleteConversation = async (req, res) => {
  try {
    const conv = await AssistantConversation.findByPk(req.params.id);
    if (!conv || conv.is_archived) return error(res, 404, "Conversation not found");
    await conv.update({ is_archived: true });
    return success(res, 200, "Conversation deleted");
  } catch (err) {
    console.error(err);
    return error(res, 500, "Failed to delete conversation");
  }
};

// ---- SSE ----

const sendEvent = (res, event, data) => {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

const sendMessage = async (req, res) => {
  const { id } = req.params;
  const text = (req.body?.text || "").trim();

  try {
    if (!text) return error(res, 400, "Message text is required");
    const conv = await AssistantConversation.findOne({ where: { id, is_archived: false } });
    if (!conv) return error(res, 404, "Conversation not found");

    // Persist the user message before doing anything fallible.
    await AssistantMessage.create({ conversation_id: id, role: "user", content: text });
    const isFirst = (await AssistantMessage.count({ where: { conversation_id: id } })) === 1;

    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    const history = (
      await AssistantMessage.findAll({ where: { conversation_id: id }, order: [["created_at", "ASC"]] })
    ).map((m) => ({ role: m.role, content: m.content }));

    let finalText;
    try {
      finalText = await runAgent(history, {
        onDelta: (t) => sendEvent(res, "delta", { text: t }),
        onStatus: (t) => sendEvent(res, "status", { text: t }),
      });
    } catch (err) {
      console.error("agent failed:", err);
      sendEvent(res, "error", { message: "The assistant is busy right now — try again in a minute." });
      return res.end();
    }

    const saved = await AssistantMessage.create({ conversation_id: id, role: "assistant", content: finalText });

    let title;
    if (isFirst) {
      title = text.length > 60 ? `${text.slice(0, 57)}…` : text;
      await conv.update({ title });
    } else {
      await conv.update({ updated_at: new Date() }); // bump ordering
    }

    sendEvent(res, "done", { messageId: saved.id, conversationId: id, ...(title ? { title } : {}) });
    return res.end();
  } catch (err) {
    console.error("sendMessage failed:", err);
    if (!res.headersSent) return error(res, 500, "Failed to send message");
    sendEvent(res, "error", { message: "Something went wrong." });
    return res.end();
  }
};

module.exports = { listConversations, createConversation, getConversation, deleteConversation, sendMessage };
```

- [x] **Step 4: Routes file** (`assistantRoutes.js`)

```js
"use strict";

const express = require("express");
const router = express.Router();
const c = require("../controllers/assistantController");

router.get("/conversations", c.listConversations);
router.post("/conversations", c.createConversation);
router.get("/conversations/:id", c.getConversation);
router.delete("/conversations/:id", c.deleteConversation);
router.post("/conversations/:id/messages", c.sendMessage);

module.exports = router;
```

In `routes/index.js`, with the other requires add `const assistantRoutes = require("./assistantRoutes");` and after the existing module mounts (below `authMiddleware`) add `router.use("/assistant", assistantRoutes);`.

- [x] **Step 5: Run CRUD tests** — `cd backend && npm test -- assistantController` → pass. Then run the FULL suite: `npm test` → all green.

- [x] **Step 6: Manual SSE verification** (test DB + real Gemini key) _(verified: full auth+SSE chain works; Gemini 403 surfaces as the graceful `error` event; happy-path re-check pending fresh key)_

Run the server (`NODE_ENV=test GEMINI_API_KEY=<real key> node src/server.js`), mint a token via the login endpoint, then:

```bash
CONV=$(curl -s -X POST localhost:5000/api/assistant/conversations -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])")
curl -N -X POST "localhost:5000/api/assistant/conversations/$CONV/messages" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"text": "How many suppliers do we have?"}'
```

Expected: `event: status` then `event: delta` lines then `event: done`.

- [x] **Step 7: Commit**

```bash
git add backend/src/controllers/assistantController.js backend/src/routes/assistantRoutes.js backend/src/routes/index.js backend/tests/assistantController.test.js
git commit -m "feat(assistant): conversation CRUD and SSE message endpoint"
```

---

### Task 8: Read-only Postgres role script

**Files:**
- Create: `backend/scripts/create-assistant-role.sql`

- [x] **Step 1: Write the script** (run manually against Supabase at rollout; grants only, no data change)

```sql
-- One-time setup for the assistant's read-only database access (layer 1 of 3).
-- Run as the owner role. Replace the password before running; it becomes part
-- of ASSISTANT_DB_URL on the Cloud Run service.
--   psql "$SUPABASE_OWNER_URL" -f create-assistant-role.sql

CREATE ROLE yars_assistant_ro LOGIN PASSWORD 'REPLACE_ME_STRONG_PASSWORD';

GRANT CONNECT ON DATABASE postgres TO yars_assistant_ro;
GRANT USAGE ON SCHEMA public TO yars_assistant_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO yars_assistant_ro;

-- Future tables created by migrations are readable automatically:
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO yars_assistant_ro;

-- Belt and braces: this role can never write, even if a grant slips through.
ALTER ROLE yars_assistant_ro SET default_transaction_read_only = on;
ALTER ROLE yars_assistant_ro SET statement_timeout = '5s';
```

- [x] **Step 2: Commit**

```bash
git add backend/scripts/create-assistant-role.sql
git commit -m "feat(assistant): SQL script for the SELECT-only role"
```

---

### Task 9: Frontend service (`assistantAPI.js`)

**Files:**
- Create: `frontend/src/services/assistantAPI.js`
- Modify: `frontend/package.json` — `cd frontend && npm install react-markdown`

- [x] **Step 1: Write the service**

```js
import axios from "axios";
import { attachAuthInterceptors, TOKEN_KEY } from "./api";

const API_URL = import.meta.env.VITE_API_URL;

const client = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});
attachAuthInterceptors(client);

export const assistantAPI = {
  listConversations: (params) => client.get("/assistant/conversations", { params }),
  createConversation: () => client.post("/assistant/conversations"),
  getConversation: (id) => client.get(`/assistant/conversations/${id}`),
  deleteConversation: (id) => client.delete(`/assistant/conversations/${id}`),
};

/**
 * Stream a message via SSE-over-fetch (EventSource cannot POST or send the
 * Authorization header). Calls the handlers as events arrive; resolves when
 * the stream ends.
 */
export const streamMessage = async (conversationId, text, { onDelta, onStatus, onDone, onError }) => {
  const token = localStorage.getItem(TOKEN_KEY);
  let response;
  try {
    response = await fetch(`${API_URL}/assistant/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
    });
  } catch {
    onError?.("Could not reach the server. Check your connection.");
    return;
  }

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.assign("/login");
    return;
  }
  if (!response.ok || !response.body) {
    onError?.("The assistant is unavailable right now.");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleBlock = (block) => {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      else if (line.startsWith("data: ")) data += line.slice(6);
    }
    if (!data) return;
    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }
    if (event === "delta") onDelta?.(payload.text);
    else if (event === "status") onStatus?.(payload.text);
    else if (event === "done") onDone?.(payload);
    else if (event === "error") onError?.(payload.message);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      handleBlock(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
  }
};
```

- [x] **Step 2: Commit**

```bash
git add frontend/src/services/assistantAPI.js frontend/package.json frontend/package-lock.json
git commit -m "feat(assistant): frontend API service with SSE-over-fetch streaming"
```

---

### Task 10: Assistant page

**Files:**
- Create: `frontend/src/pages/Assistant.jsx`
- Modify: `frontend/src/App.jsx` (import + route)

Before coding, read one existing list page (e.g. `Suppliers.jsx`) and one form page to copy the app's visual conventions (page title pattern, card/list classes, custom Dropdown if needed, dark-theme classes).

- [x] **Step 1: Write the page.** Functional requirements (implement with the app's styling conventions):

```jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { assistantAPI, streamMessage } from "../services/assistantAPI";

// Renders markdown; links to app-relative paths become in-app nav buttons.
const AssistantMarkdown = ({ text }) => {
  const navigate = useNavigate();
  return (
    <ReactMarkdown
      components={{
        a: ({ href, children }) =>
          href?.startsWith("/") ? (
            <button
              type="button"
              className="assistant-deeplink"
              onClick={() => navigate(href)}
            >
              {children} →
            </button>
          ) : (
            <a href={href} target="_blank" rel="noreferrer">{children}</a>
          ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
};

export default function Assistant() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [statusLine, setStatusLine] = useState(null);
  const bottomRef = useRef(null);

  const loadConversations = useCallback(async () => {
    const res = await assistantAPI.listConversations({ limit: 50 });
    setConversations(res.data.data.data);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, statusLine]);

  const openConversation = async (id) => {
    const res = await assistantAPI.getConversation(id);
    setActiveId(id);
    setMessages(res.data.data.messages.map((m) => ({ role: m.role, content: m.content })));
  };

  const startNew = async () => {
    const res = await assistantAPI.createConversation();
    setActiveId(res.data.data.id);
    setMessages([]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    let id = activeId;
    if (!id) {
      const res = await assistantAPI.createConversation();
      id = res.data.data.id;
      setActiveId(id);
    }
    setInput("");
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);

    await streamMessage(id, text, {
      onDelta: (t) =>
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], content: next[next.length - 1].content + t };
          return next;
        }),
      onStatus: (t) => setStatusLine(t),
      onDone: () => { setStatusLine(null); loadConversations(); },
      onError: (msg) =>
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: `⚠️ ${msg}` };
          return next;
        }),
    });
    setStatusLine(null);
    setStreaming(false);
  };

  // --- render: two views ---
  // View 1 (activeId === null): page title "Assistant", "New conversation"
  //   button, list of conversations (title + relative time), tap → openConversation,
  //   swipe/long-press not needed — a small delete icon calls
  //   assistantAPI.deleteConversation then loadConversations().
  // View 2 (activeId set): back arrow → setActiveId(null) + loadConversations();
  //   scrollable message list (user bubbles right, assistant bubbles left with
  //   <AssistantMarkdown text={m.content} />); statusLine rendered as italic
  //   muted text under the last bubble; typing indicator while streaming and the
  //   last assistant bubble is empty; fixed bottom input bar (textarea grows to
  //   3 lines max, Send button disabled while streaming), safe-area padding.
  // Follow the styling of existing pages (read Suppliers.jsx for list classes,
  // page-title pattern, dark-theme classes) — mobile-first at 390px.
}
```

The render section marked with comments is where the app-convention styling gets written — logic above is complete and must be used as-is.

- [x] **Step 2: Add the route in `App.jsx`**

```jsx
import Assistant from "./pages/Assistant";
// inside the <Route path="/" element={<MainLayout />}> block:
<Route path="assistant" element={<Assistant />} />
```

- [x] **Step 3: Verify in the browser** (backend running as in Task 7 Step 6): log in, open `/assistant`, ask "how do I record wastage?" → streamed markdown answer with a tappable deep-link that navigates to Stock Issues. Ask "how many suppliers do we have?" → status line then an answer with the real count.

- [x] **Step 4: Commit**

```bash
git add frontend/src/pages/Assistant.jsx frontend/src/App.jsx
git commit -m "feat(assistant): assistant page with streaming chat and deep links"
```

---

### Task 11: Floating assistant button

**Files:**
- Modify: `frontend/src/components/layout/MainLayout.jsx`

- [x] **Step 1: Add the button.** Read `MainLayout.jsx` first. Inside the layout (rendered on every protected page), add:

```jsx
import { useNavigate, useLocation } from "react-router-dom";
// inside the component:
const navigate = useNavigate();
const location = useLocation();
// in the JSX, after the main content/outlet:
{!location.pathname.startsWith("/assistant") && (
  <button
    type="button"
    aria-label="Ask the assistant"
    onClick={() => navigate("/assistant")}
    className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-lg …" // match app styling; keep clear of existing FABs/bottom nav
  >
    ✦
  </button>
)}
```

(If MainLayout already uses `useLocation`/`useNavigate`, reuse them. Position it above the mobile bottom nav if one exists — check the layout's structure and adjust `bottom-20` accordingly.)

- [x] **Step 2: Verify** — button appears on Dashboard/Orders/etc., not on `/assistant`; tapping it opens the assistant.

- [x] **Step 3: Commit**

```bash
git add frontend/src/components/layout/MainLayout.jsx
git commit -m "feat(assistant): floating assistant button on all screens"
```

---

### Task 12: Final verification + docs

- [x] **Step 1: Full backend suite** — `cd backend && npm test` → all green.

- [x] **Step 2: Frontend build** — `cd frontend && npm run build` → succeeds.

- [ ] **Step 3: Manual phone-width walkthrough (390px devtools):** _(pending fresh Gemini key)_ login → floating button visible → assistant page → new conversation → data question (streams, correct number) → app-help question (numbered steps + working deep link) → leave mid-stream and return (answer persisted) → delete conversation → old conversation resumable from list.

- [x] **Step 4: Update HANDOFF.md** — add an "AI Assistant" module paragraph: what it is, the three guard layers, `GEMINI_API_KEY` + `ASSISTANT_DB_URL` env vars, and the maintenance rule: **any UI change to a screen updates that module's `backend/knowledge/*.md` file in the same commit.**

- [x] **Step 5: Commit**

```bash
git add HANDOFF.md
git commit -m "docs: record AI assistant module and knowledge-base maintenance rule"
```

**Rollout (with the user — confirm before every production step):**
1. **Rotate the Gemini key** in AI Studio (the setup key passed through chat/shell) — use the new key below.
2. Run `create-assistant-role.sql` against Supabase (edit password first); build `ASSISTANT_DB_URL` from it.
3. `pg_dump` backup, then `NODE_ENV=production npm run migrate` (two assistant tables).
4. Deploy backend with `GEMINI_API_KEY` + `ASSISTANT_DB_URL` added to the Cloud Run service env.
5. Deploy frontend. End-to-end verify on the phone.
