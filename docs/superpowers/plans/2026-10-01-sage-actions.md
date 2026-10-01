# Sage (phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the read-only assistant as **Sage**, which answers questions from the same code the screens use and proposes payments, customers, orders and status changes as cards a person confirms. Every save is defined once as a command used by both the screens and Sage.

**Architecture:**
- **Commands** (`backend/src/commands/`): each save is one Zod-checked definition, run in a transaction and recording who made it. Express routes and Sage actions are thin adapters over commands.
- **Assistant** (`backend/src/assistant/`):
  - A small core prompt plus guides loaded on demand.
  - Typed read tools built on the dashboard and customer code.
  - An action kit: propose = trial run in a rolled-back transaction, then save a card in `assistant_actions`; Confirm runs the same command for real.
  - A provider chain over free Groq and Cloudflare models.
- **Frontend:** renders cards inside the chat and can open the real form pre-filled.

**Tech Stack:**
- Backend: Node 20, Express 5, Sequelize 6, Postgres, Zod 4, Jest (Docker test DB).
- Frontend: React 19, TanStack Query 5, Vitest.
- Models: Groq (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `openai/gpt-oss-20b`) and Cloudflare Workers AI (`@cf/openai/gpt-oss-120b`), all OpenAI-compatible.

**Spec:** `docs/superpowers/specs/2026-10-01-sage-actions-design.md`

## Global Constraints

**Do not touch:**
- Never touch `~/Desktop/epidermohydra`.
- Production data changes only through the owner-run migration. Never run `db:seed:all` on production.

**Models, language and limits:**
- Free providers only: Groq + Cloudflare Workers AI. No Gemini, no Mistral. English only.
- Sage never deletes. A delete request gets a link to the record's screen.
- **Prompt budgets:**
  - Core instructions + all tool declarations ≤ 2000 tokens.
  - Each guide ≤ 800 tokens.
  - Tokens are estimated as `Math.ceil(chars / 4)`.

**Naming and money:**
- The display name "Sage" is written only in `backend/src/assistant/config.js` (`ASSISTANT_NAME`) and `frontend/src/app/assistant.js` (`ASSISTANT_NAME`). Code identifiers say `assistant`.
- Money figures come only from `orderMath` / `orderFacts` / dashboard `metrics` / `customerDirectory`. No new money arithmetic.
- **App error messages that must not change:**
  - "Missing required fields. Either invoice_id or order_id is required, and amount is required."
  - "Missing required fields"
  - "A refund can't be more than received (₹…)"
  - "Order not found", "Invoice not found"
  - "Customer name is required", the GSTIN message
  - every `LineError` message.

**Tooling:**
- Zod 4 (`zod@^4`): custom messages use `{ error: "…" }`; `z.toJSONSchema` makes tool declarations.
- **Tests:**
  - Backend: `cd backend && npm test`. It needs Docker `yars-test-db`: run `npm run test:db:up` once, and `npm run test:migrate` after adding a migration.
  - Frontend: `cd frontend && npm test && npm run lint`.
- **Git:**
  - Branch `feature/sage-actions`.
  - Stage files by explicit path; never commit `.env`.
  - Each commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Two phones confirm the same card at the same moment:** exactly one record is saved and both see "Confirmed". Pinned in Task 7, `concurrent confirms save once`.
2. **The model sends money as text** ("5,000", "₹5000", "5000.00"): it is read as 5000, not rejected or misread. Pinned in Task 5, `money accepts text with ₹ and commas`.
3. **A card for a payment is confirmed after another payment was recorded on that order** (the due changed): Confirm refuses with "changed" rather than saving against figures nobody saw. Pinned in Task 8, `record_payment refuses after another payment`.
4. **A conversation is reopened after 15 minutes:** its cards show "Expired" and can't be confirmed. Pinned in Task 9, `reopened conversation shows expired cards`.
5. **Old Jarvis conversations (no actions, old text) still open and continue.** Pinned in Task 9, `old conversations open without actions`.

## File map

**Backend — commands (new):**
- `src/commands/{errors,defineCommand,runCommand,httpRoute}.js`
- `src/commands/payments/createPayment.js`
- `src/commands/customers/createCustomer.js`
- `src/commands/orders/{schema,lines,createOrder,updateOrder}.js`
- `src/commands/index.js`: list of commands, for the coverage guard.

**Backend — assistant (new):**
- `src/assistant/config.js`: name, budgets, model chain.
- `src/assistant/tokens.js`, `format.js`, `history.js`, `agentLoop.js`, `guides.js`, `index.js` (`runAssistant`).
- `src/assistant/providers/openaiCompat.js`, `chain.js`, `llm.js`
- `src/assistant/prompt/{core.md,buildSystemPrompt.js}`
- `src/assistant/db/{sqlGuard,assistantDb}.js`: moved from `src/services/assistant/`.
- `src/assistant/tools/{defineTool,executeTool,find,dues,customerSummary,periodSummary,runQuery,readGuide,index}.js`
- `src/assistant/actionKit/{defineAction,actionService,actionTool,registry}.js`
- `src/assistant/actions/{record_payment,create_customer,create_order,set_order_status}.js`
- `src/assistant/screenOnly.js`: write routes Sage does not cover, each with a reason.

**Backend — other changes:**
- `src/controllers/assistantActionController.js` (new).
- `src/models/assistantAction.js` and `src/migrations/20261001000001-create-assistant-actions.js` (new).
- `src/services/{refunds,paymentType,phone}.js` (new).
- **Modified:**
  - `src/services/auditService.js`, `src/models/{order,payment}.js` (actor in audit).
  - `src/services/dashboard/ledger.js` (`loadOrders` transaction option).
  - `src/services/{pieceFields,customerFields}.js` (errors extend `ValidationError`).
  - `src/controllers/{paymentController,customerController,orderController,assistantController}.js`, `src/routes/assistantRoutes.js`.
- **Deleted:** `src/services/assistant/` (whole folder), `knowledge/00-instructions.md`, `knowledge/schema.md`, `knowledge/routes.md`. Their content moves into area guides.
- **Scripts:** `scripts/assistant-eval.js`, `scripts/eval/fixture.js`, `scripts/assistant-report.js`.

**Frontend:**
- **New:**
  - `src/app/assistant.js`
  - `src/features/assistant/{actionCard.js,actionCard.test.js,ActionCard.jsx,formPrefill.js,formPrefill.test.js}`
- **Modified:**
  - `src/services/assistantAPI.js`, `src/features/assistant/AssistantPage.jsx`
  - `src/app/{routeMeta,navItems}.js`, `src/components/layout/MainLayout.jsx`, `src/assets/styles/index.css`
  - `src/features/orders/form/OrderFormPage.jsx`, `src/features/customers/CustomerFormPage.jsx`, `src/features/orders/OrderPage.jsx`
  - `src/features/payments/{PaymentSheet.jsx,paymentForm.js}`
  - `src/features/history/{describeAudit.js,HistoryPage.jsx}`

---

### Task 1: Commands foundation, actor in the history log, `loadOrders` in a transaction

**Files:**
- Create: `backend/src/commands/errors.js`, `backend/src/commands/defineCommand.js`, `backend/src/commands/runCommand.js`, `backend/src/commands/httpRoute.js`
- Modify: `backend/src/services/auditService.js` (`createAuditLog`), `backend/src/models/order.js` (hooks), `backend/src/models/payment.js` (hooks), `backend/src/services/dashboard/ledger.js:7-29`, `backend/package.json` (zod)
- Test: `backend/tests/commands.test.js`, `backend/tests/auditActor.test.js`

**Interfaces:**
- Produces:
  - `CommandError(message, status)`, `ValidationError(message)` (status 400), `NotFoundError(message)` (404), all from `src/commands/errors.js`.
  - `defineCommand({ name, route?, input, run }) → { name, route, input, parse(raw), run(input, { transaction, actor }) }`
  - `runCommand(command, raw, { actor = { source: "app" }, transaction? }) → Promise<result>`: joins `transaction` if given, else opens and commits its own.
  - `httpRoute(command, { toInput?, respond, failMessage }) → (req, res) => Promise`: `respond(result, req) → { status, message, data }`.
  - `actor`: `{ source: "app" | "assistant", userId?, actionId?, trial? }`. Pass it to Sequelize as `{ transaction, actor }` and the audit hooks copy `source` and `assistant_action_id` into `audit_logs.metadata`.
  - `loadOrders(models, where = { is_archived: false }, { transaction } = {})`

- [ ] **Step 1: Install Zod**

Run: `cd backend && npm install zod@^4`
Expected: `package.json` dependencies include `"zod": "^4.…"`.

- [ ] **Step 2: Write the failing tests**

`backend/tests/commands.test.js`:

```js
"use strict";

const { z } = require("zod");
const db = require("../src/models");
const { defineCommand } = require("../src/commands/defineCommand");
const { runCommand } = require("../src/commands/runCommand");
const { httpRoute } = require("../src/commands/httpRoute");
const { NotFoundError } = require("../src/commands/errors");
const { mockRes } = require("./helpers/http");

const addCustomer = defineCommand({
  name: "test.addCustomer",
  input: z.object({ name: z.string({ error: "Name is required" }).min(1, { error: "Name is required" }) }),
  run: async ({ name }, { transaction }) => {
    if (name === "nobody") throw new NotFoundError("Nobody found");
    const customer = await db.Customer.create({ name }, { transaction });
    if (name === "explode") throw new Error("boom");
    return { id: customer.id };
  },
});

const call = async (handler, req) => {
  const res = mockRes();
  await handler({ body: {}, params: {}, query: {}, ...req }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

afterEach(() => jest.restoreAllMocks());

describe("commands", () => {
  test("input that fails the schema is a 400 with the schema's own message", async () => {
    await expect(runCommand(addCustomer, {})).rejects.toMatchObject({ name: "ValidationError", status: 400, message: "Name is required" });
  });

  test("a successful run commits", async () => {
    const { id } = await runCommand(addCustomer, { name: "Kept" });
    expect((await db.Customer.findByPk(id)).name).toBe("Kept");
  });

  test("any error rolls the whole run back", async () => {
    await expect(runCommand(addCustomer, { name: "explode" })).rejects.toThrow("boom");
    expect(await db.Customer.count()).toBe(0);
  });

  test("a caller's transaction is joined, so the caller decides", async () => {
    const t = await db.sequelize.transaction();
    await runCommand(addCustomer, { name: "Trial" }, { transaction: t });
    expect(await db.Customer.count({ transaction: t })).toBe(1);
    await t.rollback();
    expect(await db.Customer.count()).toBe(0);
  });

  describe("httpRoute", () => {
    const route = httpRoute(addCustomer, {
      respond: async ({ id }) => ({ status: 201, message: "Added", data: { id } }),
      failMessage: "Failed to add",
    });

    test("success sends what respond() returns", async () => {
      const { status, body } = await call(route, { body: { name: "Via HTTP" } });
      expect(status).toBe(201);
      expect(body).toMatchObject({ success: true, message: "Added" });
    });

    test("a command error keeps its status and message", async () => {
      expect(await call(route, { body: {} })).toMatchObject({ status: 400, body: { success: false, message: "Name is required" } });
      expect(await call(route, { body: { name: "nobody" } })).toMatchObject({ status: 404, body: { message: "Nobody found" } });
    });

    test("anything else is a 500 with the route's message", async () => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      expect(await call(route, { body: { name: "explode" } })).toMatchObject({ status: 500, body: { message: "Failed to add", errors: "boom" } });
    });
  });
});
```

`backend/tests/auditActor.test.js`:

```js
"use strict";

const db = require("../src/models");
const { loadOrders } = require("../src/services/dashboard/ledger");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

describe("who made a change", () => {
  let customer;
  let order;

  beforeEach(async () => {
    customer = await createCustomer("Actor Test");
    const plate = await createPlateType("0.00");
    const size = await createSize({ rate_per_kg: "100.00" });
    order = await createOrderWithLines({
      customer, plateType: plate,
      lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "100.00" }],
    });
  });

  const payment = () => ({ order_id: order.id, customer_id: customer.id, amount: "100.00", payment_type: "PARTIAL", payment_date: "2026-09-02" });
  const log = (entity_type, action) => db.AuditLog.findOne({ where: { entity_type, action } });

  test("a change from a screen is marked source app", async () => {
    await db.Payment.create(payment());
    expect((await log("PAYMENT", "CREATE")).metadata).toMatchObject({ source: "app" });
  });

  test("a change Sage made carries its action id", async () => {
    await db.Payment.create(payment(), { actor: { source: "assistant", actionId: "act-1" } });
    expect((await log("PAYMENT", "CREATE")).metadata).toMatchObject({ source: "assistant", assistant_action_id: "act-1" });
  });

  test("order status changes carry the actor too", async () => {
    await order.update({ status: "DELIVERED" }, { actor: { source: "assistant", actionId: "act-2" } });
    expect((await log("ORDER", "UPDATE")).metadata).toMatchObject({ source: "assistant", assistant_action_id: "act-2", new_status: "DELIVERED" });
  });
});

describe("loadOrders inside a transaction", () => {
  test("sees rows written in that transaction, and only there", async () => {
    const customer = await createCustomer("Tx");
    const plate = await createPlateType("0.00");
    const t = await db.sequelize.transaction();
    try {
      await db.Order.create({ customer_id: customer.id, plate_type_id: plate.id, order_date: "2026-09-01" }, { transaction: t });
      expect(await loadOrders(db, { is_archived: false }, { transaction: t })).toHaveLength(1);
      expect(await loadOrders(db, { is_archived: false })).toHaveLength(0);
    } finally {
      await t.rollback();
    }
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `cd backend && npm test -- tests/commands.test.js tests/auditActor.test.js`
Expected: FAIL — `Cannot find module '../src/commands/defineCommand'`; and in auditActor, `metadata` lacks `source`.

- [ ] **Step 4: Write the command files**

`backend/src/commands/errors.js`:

```js
"use strict";

/** A refusal the person can act on. `status` is the HTTP status the screens get. */
class CommandError extends Error {
  constructor(message, status) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}

class ValidationError extends CommandError {
  constructor(message) {
    super(message, 400);
  }
}

class NotFoundError extends CommandError {
  constructor(message) {
    super(message, 404);
  }
}

module.exports = { CommandError, ValidationError, NotFoundError };
```

`backend/src/commands/defineCommand.js`:

```js
"use strict";

const { ValidationError } = require("./errors");

/**
 * One save, defined once and used by the screens' routes and by Sage.
 * `input` is a Zod schema carrying the messages the app shows; `run(input,
 * { transaction, actor })` does the work inside the transaction it is given
 * and returns `{ id }` of the record it saved. `route` ("POST /payments")
 * names the endpoint that serves it, for the coverage guard.
 */
const defineCommand = ({ name, route = null, input, run }) => {
  if (!name || !input || typeof run !== "function") throw new Error(`defineCommand: ${name || "?"} needs name, input and run`);
  const parse = (raw) => {
    const result = input.safeParse(raw ?? {});
    if (!result.success) throw new ValidationError(result.error.issues[0].message);
    return result.data;
  };
  return Object.freeze({ name, route, input, parse, run });
};

module.exports = { defineCommand };
```

`backend/src/commands/runCommand.js`:

```js
"use strict";

const { sequelize } = require("../models");

const APP = Object.freeze({ source: "app" });

/**
 * Check the input, then run. Inside the caller's `transaction` when one is
 * given (the caller commits or rolls back); otherwise in a new transaction
 * that commits on success and rolls back on any error.
 */
const runCommand = async (command, raw, { actor = APP, transaction } = {}) => {
  const input = command.parse(raw);
  if (transaction) return command.run(input, { transaction, actor });
  return sequelize.transaction((t) => command.run(input, { transaction: t, actor }));
};

module.exports = { runCommand };
```

`backend/src/commands/httpRoute.js`:

```js
"use strict";

const { success, error } = require("../utils/response");
const { CommandError } = require("./errors");
const { runCommand } = require("./runCommand");

/**
 * An Express handler for a command. `toInput(req)` builds the command input
 * (default: the body); `respond(result, req)` returns { status, message, data },
 * the same body the route sent before commands existed.
 */
const httpRoute = (command, { toInput = (req) => req.body, respond, failMessage }) => async (req, res) => {
  try {
    const actor = { source: "app", userId: req.user?.sub || null };
    const result = await runCommand(command, toInput(req), { actor });
    const { status, message, data } = await respond(result, req);
    return success(res, status, message, data);
  } catch (err) {
    if (err instanceof CommandError) return error(res, err.status, err.message);
    console.error(`${command.name} failed:`, err);
    return error(res, 500, failMessage, err.message);
  }
};

module.exports = { httpRoute };
```

- [ ] **Step 5: Record the actor in the history log**

In `backend/src/services/auditService.js`, add above `createAuditLog`:

```js
/** Who made a change: a screen ("app") unless the save says otherwise. */
const withSource = (metadata, actor) => ({
  ...(metadata || {}),
  source: actor?.source || "app",
  ...(actor?.actionId ? { assistant_action_id: actor.actionId } : {}),
});
```

Change the `createAuditLog` signature to also take `actor`:

```js
const createAuditLog = async (AuditLog, { entityType, entityId, action, oldValues, newValues, metadata, transaction, actor }) => {
```

and inside its `AuditLog.create({...})` replace the line `metadata,` with:

```js
        metadata: withSource(metadata, actor),
```

In `backend/src/models/order.js` (`afterCreate`, `afterUpdate`) and `backend/src/models/payment.js` (`afterCreate`, `afterUpdate`, `beforeDestroy`), every `createAuditLog(AuditLog, { … })` call has the line `transaction: options.transaction,`. Directly after it in each call, add:

```js
            actor: options.actor,
```

Run: `cd backend && /usr/bin/grep -c "actor: options.actor" src/models/order.js src/models/payment.js`
Expected: `src/models/order.js:2` and `src/models/payment.js:3`.

- [ ] **Step 6: Let `loadOrders` read inside a transaction**

In `backend/src/services/dashboard/ledger.js` change the signature and the `findAll` call:

```js
const loadOrders = async (models, where = { is_archived: false }, { transaction } = {}) => {
  const { Order, Customer, PlateType, OrderProductSize, ProductSize, Payment } = models;
  const rows = await Order.findAll({
    where,
    transaction,
```

(the rest of the `findAll` options stay as they are).

- [ ] **Step 7: Run the tests**

Run: `cd backend && npm test -- tests/commands.test.js tests/auditActor.test.js`
Expected: PASS (9 tests).

- [ ] **Step 8: Run the whole backend suite**

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: all suites pass (288 existing + 9 new).

- [ ] **Step 9: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/commands/errors.js backend/src/commands/defineCommand.js backend/src/commands/runCommand.js backend/src/commands/httpRoute.js backend/src/services/auditService.js backend/src/models/order.js backend/src/models/payment.js backend/src/services/dashboard/ledger.js backend/tests/commands.test.js backend/tests/auditActor.test.js
git commit -m "feat(commands): one definition per save — Zod input, transaction, actor in the history log

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Payments and customers saved through commands

**Files:**
- Create: `backend/src/services/refunds.js`, `backend/src/commands/payments/constants.js`, `backend/src/commands/payments/createPayment.js`, `backend/src/commands/customers/createCustomer.js`
- Modify: `backend/src/controllers/paymentController.js` (remove `refundTooLarge`, replace `createPayment`), `backend/src/controllers/customerController.js` (replace `createCustomer`), `backend/src/services/pieceFields.js:4`, `backend/src/services/customerFields.js:3`
- Test: `backend/tests/paymentCustomerCommands.test.js`; existing `tests/paymentRefund.test.js`, `tests/paymentAudit.test.js`, `tests/customerDirectory.test.js` must stay green unchanged.

**Interfaces:**
- Consumes: `defineCommand`, `httpRoute`, `ValidationError`, `NotFoundError` (Task 1).
- Produces:
  - `require("src/commands/payments/createPayment")`: a command named `payments.create`, route `POST /payments`. Input `{ invoice_id?, order_id?, amount, payment_date?, payment_method?, payment_type?, reference_number?, notes? }`; returns `{ id }`.
  - `PAYMENT_METHODS`, `PAYMENT_TYPES` from `src/commands/payments/constants.js`.
  - `require("src/commands/customers/createCustomer")`: command `customers.create`, route `POST /customers`. Input `{ name, phone?, city?, email?, address?, gstin? }`; returns `{ id }`.
  - `refundTooLarge(orderId, amount, excludePaymentId, transaction) → Promise<string|null>` from `src/services/refunds.js`.
  - `LineError` and `CustomerFieldError` now extend `ValidationError` (status 400).

- [ ] **Step 1: Write the failing tests**

`backend/tests/paymentCustomerCommands.test.js`:

```js
"use strict";

const db = require("../src/models");
const { createPayment } = require("../src/controllers/paymentController");
const { createCustomer } = require("../src/controllers/customerController");
const { mockRes } = require("./helpers/http");
const { createCustomer: makeCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const call = async (fn, req) => {
  const res = mockRes();
  await fn({ query: {}, params: {}, body: {}, ...req }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe("payments.create through the route", () => {
  let order;
  beforeEach(async () => {
    const customer = await makeCustomer("Payer");
    const plate = await createPlateType("0.00");
    const size = await createSize({ rate_per_kg: "100.00" });
    order = await createOrderWithLines({ customer, plateType: plate, lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "100.00" }] });
  });

  test("no order or invoice keeps the app's message", async () => {
    const res = await call(createPayment, { body: { amount: 100 } });
    expect(res).toMatchObject({ status: 400, body: { message: "Missing required fields. Either invoice_id or order_id is required, and amount is required." } });
  });

  test("an unknown method is a 400, not a database error", async () => {
    const res = await call(createPayment, { body: { order_id: order.id, amount: 100, payment_method: "BITCOIN" } });
    expect(res).toMatchObject({ status: 400, body: { message: "Payment method must be one of CASH, BANK_TRANSFER, UPI, CHECK, OTHER" } });
  });

  test("an amount that isn't a number above 0 is refused", async () => {
    const res = await call(createPayment, { body: { order_id: order.id, amount: "abc" } });
    expect(res).toMatchObject({ status: 400, body: { message: "Amount must be a number above 0" } });
  });

  test("an unknown order is a 404", async () => {
    const res = await call(createPayment, { body: { order_id: "00000000-0000-4000-8000-000000000000", amount: 100 } });
    expect(res).toMatchObject({ status: 404, body: { message: "Order not found" } });
  });

  test("saves, responds as before, and logs source app", async () => {
    const res = await call(createPayment, { body: { order_id: order.id, amount: "250", payment_method: "UPI" }, user: { sub: "u1" } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ message: "Payment recorded successfully", data: { order_id: order.id, payment_method: "UPI", payment_type: "PARTIAL" } });
    expect(res.body.data.order.id).toBe(order.id);
    const log = await db.AuditLog.findOne({ where: { entity_type: "PAYMENT", action: "CREATE" } });
    expect(log.metadata.source).toBe("app");
  });
});

describe("customers.create through the route", () => {
  test("name is required, with the app's message", async () => {
    expect(await call(createCustomer, { body: { phone: "9876543210" } })).toMatchObject({ status: 400, body: { message: "Customer name is required" } });
  });

  test("a bad GSTIN keeps the app's message", async () => {
    expect(await call(createCustomer, { body: { name: "Shop", gstin: "123" } })).toMatchObject({ status: 400, body: { message: "GSTIN should be 15 characters, like 29ABCDE1234F1Z5" } });
  });

  test("contact fields are saved in metadata", async () => {
    const res = await call(createCustomer, { body: { name: " Laxmi ", phone: "9876543210", city: "Bidar" } });
    expect(res).toMatchObject({ status: 201, body: { message: "Customer created successfully", data: { name: "Laxmi", metadata: { phone: "9876543210", city: "Bidar" } } } });
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `cd backend && npm test -- tests/paymentCustomerCommands.test.js`
Expected: FAIL. The unknown method test gets a 500 (DB enum error), the amount test gets a 500, and `log.metadata.source` passes already. The method and amount tests prove the gap.

- [ ] **Step 3: Move `refundTooLarge` into a service**

`backend/src/services/refunds.js`:

```js
"use strict";

const { Order, PlateType, OrderProductSize, ProductSize, Payment } = require("../models");
const { orderTotal, paymentPosition } = require("./orderMath");

/**
 * "A refund can't be more than received": the order's received money, leaving
 * out `excludePaymentId` (the payment being edited). Returns the message to
 * send, or null when the refund is allowed.
 */
const refundTooLarge = async (orderId, amount, excludePaymentId, transaction) => {
  const full = await Order.findByPk(orderId, {
    include: [
      { model: PlateType, as: "plateType", required: false },
      { model: OrderProductSize, as: "orderProductSizes", required: false, include: [{ model: ProductSize, as: "productSize", required: false }] },
      { model: Payment, as: "payments", required: false },
    ],
    transaction,
  });
  const data = full.toJSON();
  data.payments = (data.payments || []).filter((p) => p.id !== excludePaymentId);
  const received = Math.round(paymentPosition(data, orderTotal(data)).totalReceived * 100);
  if (Math.round(parseFloat(amount) * 100) <= received) return null;
  return `A refund can't be more than received (₹${new Intl.NumberFormat("en-IN").format(received / 100)})`;
};

module.exports = { refundTooLarge };
```

- [ ] **Step 4: Make field errors 400s everywhere**

In `backend/src/services/pieceFields.js` replace `class LineError extends Error {}` with:

```js
const { ValidationError } = require("../commands/errors");

class LineError extends ValidationError {}
```

In `backend/src/services/customerFields.js` replace `class CustomerFieldError extends Error {}` with:

```js
const { ValidationError } = require("../commands/errors");

class CustomerFieldError extends ValidationError {}
```

- [ ] **Step 5: Write the payment command**

`backend/src/commands/payments/constants.js`:

```js
"use strict";

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "UPI", "CHECK", "OTHER"];
const PAYMENT_TYPES = ["ADVANCE", "PARTIAL", "FINAL", "REFUND"];

module.exports = { PAYMENT_METHODS, PAYMENT_TYPES };
```

`backend/src/commands/payments/createPayment.js`:

```js
"use strict";

const { z } = require("zod");
const { Payment, Invoice, Customer, Order } = require("../../models");
const { defineCommand } = require("../defineCommand");
const { ValidationError, NotFoundError } = require("../errors");
const { todayIST } = require("../../services/dashboard/dateRanges");
const { refundTooLarge } = require("../../services/refunds");
const { PAYMENT_METHODS, PAYMENT_TYPES } = require("./constants");

const MISSING = "Missing required fields. Either invoice_id or order_id is required, and amount is required.";
const numberText = z.union([z.number(), z.string()]);

const input = z
  .object({
    invoice_id: z.string().nullish(),
    order_id: z.string().nullish(),
    amount: numberText.nullish(),
    payment_date: z.string().nullish(),
    payment_method: z.enum(PAYMENT_METHODS, { error: `Payment method must be one of ${PAYMENT_METHODS.join(", ")}` }).nullish(),
    payment_type: z.enum(PAYMENT_TYPES, { error: `Payment type must be one of ${PAYMENT_TYPES.join(", ")}` }).nullish(),
    reference_number: z.string().nullish(),
    notes: z.string().nullish(),
  })
  .superRefine((v, ctx) => {
    if ((!v.invoice_id && !v.order_id) || !v.amount) ctx.addIssue({ code: "custom", message: MISSING });
    else if (!(Number(v.amount) > 0)) ctx.addIssue({ code: "custom", message: "Amount must be a number above 0" });
  });

module.exports = defineCommand({
  name: "payments.create",
  route: "POST /payments",
  input,
  run: async (v, { transaction, actor }) => {
    const paymentType = v.payment_type || "PARTIAL";
    const data = {
      amount: v.amount,
      payment_date: v.payment_date || todayIST(),
      payment_method: v.payment_method || "CASH",
      payment_type: paymentType,
      reference_number: v.reference_number,
      notes: v.notes,
    };
    let customerId;

    if (v.invoice_id) {
      const invoice = await Invoice.findOne({ where: { id: v.invoice_id, is_archived: false }, include: [{ model: Customer, as: "customer" }], transaction });
      if (!invoice) throw new NotFoundError("Invoice not found");
      customerId = invoice.customer.id;
      // No order_id = money for the invoice as a whole (e.g. its GST). It is
      // NOT pinned to an order: that would show the order as overpaid.
      data.invoice_id = v.invoice_id;
    }

    if (v.order_id) {
      const order = await Order.findOne({ where: { id: v.order_id, is_archived: false }, include: [{ model: Customer, as: "customer" }], transaction });
      if (!order) throw new NotFoundError("Order not found");
      if (paymentType === "REFUND") {
        const tooLarge = await refundTooLarge(v.order_id, v.amount, null, transaction);
        if (tooLarge) throw new ValidationError(tooLarge);
      }
      customerId = order.customer.id;
      data.order_id = v.order_id;
      if (paymentType === "ADVANCE" && !v.invoice_id) data.invoice_id = null;
    }

    data.customer_id = customerId;
    const payment = await Payment.create(data, { transaction, actor });
    return { id: payment.id };
  },
});
```

- [ ] **Step 6: Write the customer command**

`backend/src/commands/customers/createCustomer.js`:

```js
"use strict";

const { z } = require("zod");
const { Customer } = require("../../models");
const { defineCommand } = require("../defineCommand");
const { readCustomerBody } = require("../../services/customerFields");

const text = z.string().nullish();

module.exports = defineCommand({
  name: "customers.create",
  route: "POST /customers",
  // readCustomerBody does the field checks, with the messages the form shows.
  input: z.object({ name: text, phone: text, city: text, email: text, address: text, gstin: text }),
  run: async (v, { transaction }) => {
    const { name, patch } = readCustomerBody(v);
    const customer = await Customer.create({ name, metadata: patch }, { transaction });
    return { id: customer.id };
  },
});
```

- [ ] **Step 7: Point the controllers at the commands**

In `backend/src/controllers/paymentController.js`:
- Delete the local `refundTooLarge` function.
- Replace the whole `createPayment` function with the code below.
- Change the imports at the top to these:

```js
const { Payment, Invoice, Customer, Order, sequelize } = require("../models");
const { refundTooLarge } = require("../services/refunds");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");
const { httpRoute } = require("../commands/httpRoute");
const createPaymentCommand = require("../commands/payments/createPayment");
```

```js
/** Record a payment (POST /payments) — the save is the payments.create command. */
const createPayment = httpRoute(createPaymentCommand, {
  respond: async ({ id }) => ({
    status: 201,
    message: "Payment recorded successfully",
    data: await Payment.findByPk(id, {
      include: [
        { model: Invoice, as: "invoice" },
        { model: Order, as: "order" },
        { model: Customer, as: "customer" },
      ],
    }),
  }),
  failMessage: "Failed to record payment",
});
```

In `backend/src/controllers/customerController.js` add the imports and replace `createCustomer`:

```js
const { httpRoute } = require("../commands/httpRoute");
const createCustomerCommand = require("../commands/customers/createCustomer");
```

```js
/** Add a customer (POST /customers) — the save is the customers.create command. */
const createCustomer = httpRoute(createCustomerCommand, {
  respond: async ({ id }) => ({ status: 201, message: "Customer created successfully", data: await Customer.findByPk(id) }),
  failMessage: "Failed to create customer",
});
```

- [ ] **Step 8: Run the new and existing payment/customer tests**

Run: `cd backend && npm test -- tests/paymentCustomerCommands.test.js tests/paymentRefund.test.js tests/paymentAudit.test.js tests/customerDirectory.test.js`
Expected: PASS, all of them.

- [ ] **Step 9: Whole suite**

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: every suite passes.

- [ ] **Step 10: Commit**

```bash
git add backend/src/services/refunds.js backend/src/commands/payments/constants.js backend/src/commands/payments/createPayment.js backend/src/commands/customers/createCustomer.js backend/src/controllers/paymentController.js backend/src/controllers/customerController.js backend/src/services/pieceFields.js backend/src/services/customerFields.js backend/tests/paymentCustomerCommands.test.js
git commit -m "refactor(payments, customers): saved through commands; bad method or amount is a 400 instead of a 500

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Orders created and updated through commands

**Files:**
- Create: `backend/src/commands/orders/schema.js`, `backend/src/commands/orders/lines.js`, `backend/src/commands/orders/createOrder.js`, `backend/src/commands/orders/updateOrder.js`, `backend/src/commands/index.js`
- Modify: `backend/src/controllers/orderController.js` (remove `createLines`, replace `createOrder` and `updateOrder`)
- Test: `backend/tests/orderCommands.test.js`; existing `tests/orderController.test.js` stays green unchanged.

**Interfaces:**
- Consumes: Task 1 (`defineCommand`, `httpRoute`, `NotFoundError`); `LineError` is a `ValidationError` (Task 2).
- Produces:
  - `orders.create` (`POST /orders`): input `{ customer_id, plate_type_id, product_sizes: Line[], order_date?, advance_received?, status?, custom_plate_charge?, round_off_amount? }`.
    - `Line = { product_size_id, unit?, quantity_kg?, rate_per_kg?, quantity_pieces?, price_amount?, price_pieces_count?, weight_kg?, weight_pieces_count?, weight_source? }`.
    - Returns `{ id }`.
  - `orders.update` (`PUT /orders/:id`): input `{ id, …any of the create fields }`; returns `{ id }`.
  - `ORDER_STATUSES` from `src/commands/orders/schema.js`.
  - `COMMANDS` from `src/commands/index.js`: an array of every command.

- [ ] **Step 1: Write the failing tests**

`backend/tests/orderCommands.test.js`:

```js
"use strict";

const db = require("../src/models");
const { createOrder, updateOrder } = require("../src/controllers/orderController");
const { COMMANDS } = require("../src/commands");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize } = require("./helpers/orderFactories");

const call = async (fn, req) => {
  const res = mockRes();
  await fn({ query: {}, params: {}, body: {}, ...req }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe("orders through commands", () => {
  let base;
  let size;
  beforeEach(async () => {
    const customer = await createCustomer("Orderer");
    const plate = await createPlateType("500.00");
    size = await createSize({ rate_per_kg: "150.00" });
    base = { customer_id: customer.id, plate_type_id: plate.id, order_date: "2026-09-10", product_sizes: [{ product_size_id: size.id, quantity_kg: 10 }] };
  });

  test("missing fields keep the app's message", async () => {
    expect(await call(createOrder, { body: { customer_id: base.customer_id } })).toMatchObject({ status: 400, body: { message: "Missing required fields" } });
  });

  test("an unknown status is a 400", async () => {
    const res = await call(createOrder, { body: { ...base, status: "LOST" } });
    expect(res).toMatchObject({ status: 400, body: { message: "Status must be one of PENDING, IN_PROGRESS, COMPLETED, DELIVERED, CANCELLED" } });
  });

  test("a bad line saves nothing at all", async () => {
    const res = await call(createOrder, { body: { ...base, product_sizes: [{ product_size_id: size.id, unit: "PIECES", quantity_pieces: 0 }] } });
    expect(res).toMatchObject({ status: 400, body: { message: "Quantity (pcs) must be a whole number, 1 or more" } });
    expect(await db.Order.count()).toBe(0);
  });

  test("an advance becomes an ADVANCE payment, as before", async () => {
    const res = await call(createOrder, { body: { ...base, advance_received: 300 } });
    expect(res.status).toBe(201);
    const pay = await db.Payment.findOne({ where: { order_id: res.body.data.id } });
    expect([pay.payment_type, Number(pay.amount)]).toEqual(["ADVANCE", 300]);
  });

  test("a status change from the screen is logged with source app", async () => {
    const created = await call(createOrder, { body: base });
    const res = await call(updateOrder, { params: { id: created.body.data.id }, body: { status: "DELIVERED" } });
    expect(res).toMatchObject({ status: 200, body: { message: "Order updated successfully", data: { status: "DELIVERED" } } });
    const log = await db.AuditLog.findOne({ where: { entity_type: "ORDER", action: "UPDATE" } });
    expect(log.metadata).toMatchObject({ source: "app", new_status: "DELIVERED" });
  });

  test("updating an order that doesn't exist is a 404", async () => {
    const res = await call(updateOrder, { params: { id: "00000000-0000-4000-8000-000000000000" }, body: { status: "DELIVERED" } });
    expect(res).toMatchObject({ status: 404, body: { message: "Order not found" } });
  });

  test("every command is listed once, with a route", () => {
    const names = COMMANDS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    expect(COMMANDS.every((c) => /^(POST|PUT|PATCH|DELETE) \//.test(c.route))).toBe(true);
    expect(names.sort()).toEqual(["customers.create", "orders.create", "orders.update", "payments.create"]);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `cd backend && npm test -- tests/orderCommands.test.js`
Expected: FAIL — `Cannot find module '../src/commands'`.

- [ ] **Step 3: Write the order schema and line helper**

`backend/src/commands/orders/schema.js`:

```js
"use strict";

const { z } = require("zod");

const ORDER_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "DELIVERED", "CANCELLED"];
const numberText = z.union([z.number(), z.string()]);

/** One order line as the order form sends it; buildLineRow does the detailed checks. */
const orderLine = z.object({
  product_size_id: z.string().nullish(),
  unit: z.string().nullish(),
  quantity_kg: numberText.nullish(),
  rate_per_kg: numberText.nullish(),
  quantity_pieces: numberText.nullish(),
  price_amount: numberText.nullish(),
  price_pieces_count: numberText.nullish(),
  weight_kg: numberText.nullish(),
  weight_pieces_count: numberText.nullish(),
  weight_source: z.string().nullish(),
});

const orderFields = {
  customer_id: z.string().nullish(),
  order_date: z.string().nullish(),
  plate_type_id: z.string().nullish(),
  product_sizes: z.array(orderLine).nullish(),
  status: z.enum(ORDER_STATUSES, { error: `Status must be one of ${ORDER_STATUSES.join(", ")}` }).nullish(),
  custom_plate_charge: numberText.nullish(),
  round_off_amount: numberText.nullish(),
};

module.exports = { ORDER_STATUSES, numberText, orderLine, orderFields };
```

`backend/src/commands/orders/lines.js`:

```js
"use strict";

const { ProductSize, OrderProductSize } = require("../../models");
const { buildLineRow } = require("../../services/orderLines");
const { LineError } = require("../../services/pieceFields");

/** Validate + create every line of an order inside `transaction`. Throws LineError (a 400). */
const createLines = async (orderId, productSizes, transaction) => {
  for (const ps of productSizes) {
    if (!ps.product_size_id) throw new LineError("Product size ID and quantity are required");
    const productSize = await ProductSize.findByPk(ps.product_size_id, { transaction });
    if (!productSize) throw new LineError("Invalid product size ID");
    const row = buildLineRow(ps, productSize);
    await OrderProductSize.create({ order_id: orderId, product_size_id: ps.product_size_id, ...row }, { transaction });
  }
};

module.exports = { createLines };
```

- [ ] **Step 4: Write the two order commands and the command list**

`backend/src/commands/orders/createOrder.js`:

```js
"use strict";

const { z } = require("zod");
const { Order, Payment } = require("../../models");
const { defineCommand } = require("../defineCommand");
const { todayIST } = require("../../services/dashboard/dateRanges");
const { numberText, orderFields } = require("./schema");
const { createLines } = require("./lines");

const input = z
  .object({ ...orderFields, advance_received: numberText.nullish() })
  .superRefine((v, ctx) => {
    if (!v.customer_id || !v.plate_type_id || !v.product_sizes || !v.product_sizes.length) {
      ctx.addIssue({ code: "custom", message: "Missing required fields" });
    }
  });

module.exports = defineCommand({
  name: "orders.create",
  route: "POST /orders",
  input,
  run: async (v, { transaction, actor }) => {
    const order = await Order.create(
      {
        customer_id: v.customer_id,
        order_date: v.order_date || todayIST(),
        advance_received: v.advance_received || 0,
        plate_type_id: v.plate_type_id,
        status: v.status || "PENDING",
        custom_plate_charge: v.custom_plate_charge ? parseFloat(v.custom_plate_charge) : null,
        round_off_amount: v.round_off_amount ? parseFloat(v.round_off_amount) : 0,
      },
      { transaction, actor }
    );

    // An advance given at order time is recorded as an ADVANCE payment.
    if (v.advance_received && parseFloat(v.advance_received) > 0) {
      await Payment.create(
        {
          order_id: order.id,
          customer_id: v.customer_id,
          amount: parseFloat(v.advance_received),
          payment_date: v.order_date || todayIST(),
          payment_method: "CASH", // Default to cash, can be updated later
          payment_type: "ADVANCE",
          notes: "Advance payment at order creation",
        },
        { transaction, actor }
      );
    }

    await createLines(order.id, v.product_sizes, transaction);
    return { id: order.id };
  },
});
```

`backend/src/commands/orders/updateOrder.js`:

```js
"use strict";

const { z } = require("zod");
const { Order, OrderProductSize } = require("../../models");
const { defineCommand } = require("../defineCommand");
const { NotFoundError } = require("../errors");
const { orderFields } = require("./schema");
const { createLines } = require("./lines");

module.exports = defineCommand({
  name: "orders.update",
  route: "PUT /orders/:id",
  input: z.object({ id: z.string(), ...orderFields }),
  run: async (v, { transaction, actor }) => {
    const order = await Order.findOne({ where: { id: v.id, is_archived: false }, transaction });
    if (!order) throw new NotFoundError("Order not found");

    // The advance is set only when an order is created; later advances or
    // corrections are recorded as payments — editing never rewrites them.
    await order.update(
      {
        customer_id: v.customer_id || order.customer_id,
        order_date: v.order_date || order.order_date,
        plate_type_id: v.plate_type_id || order.plate_type_id,
        status: v.status || order.status,
        custom_plate_charge:
          v.custom_plate_charge !== undefined ? (v.custom_plate_charge ? parseFloat(v.custom_plate_charge) : null) : order.custom_plate_charge,
        round_off_amount: v.round_off_amount !== undefined ? parseFloat(v.round_off_amount || 0) : order.round_off_amount,
      },
      { transaction, actor }
    );

    if (v.product_sizes && v.product_sizes.length > 0) {
      await OrderProductSize.destroy({ where: { order_id: v.id }, transaction });
      await createLines(v.id, v.product_sizes, transaction);
    }
    return { id: v.id };
  },
});
```

`backend/src/commands/index.js`:

```js
"use strict";

/** Every command. Each new save is added here; the coverage guard reads this list. */
const COMMANDS = [
  require("./payments/createPayment"),
  require("./customers/createCustomer"),
  require("./orders/createOrder"),
  require("./orders/updateOrder"),
];

module.exports = { COMMANDS };
```

- [ ] **Step 5: Point the order controller at the commands**

In `backend/src/controllers/orderController.js`:
- Delete `createLines` and the old `createOrder` and `updateOrder` functions.
- Remove the now-unused imports `buildLineRow`, `LineError` and `ProductSize`, but keep `ProductSize` in the models import because `orderIncludes` uses it.
- Add:

```js
const { httpRoute } = require("../commands/httpRoute");
const createOrderCommand = require("../commands/orders/createOrder");
const updateOrderCommand = require("../commands/orders/updateOrder");
```

```js
/** Create an order (POST /orders) — the save is the orders.create command. */
const createOrder = httpRoute(createOrderCommand, {
  respond: async ({ id }) => ({ status: 201, message: "Order created successfully", data: await Order.findByPk(id, { include: orderIncludes() }) }),
  failMessage: "Failed to create order",
});

/** Update an order (PUT /orders/:id) — the save is the orders.update command. */
const updateOrder = httpRoute(updateOrderCommand, {
  toInput: (req) => ({ ...req.body, id: req.params.id }),
  respond: async ({ id }) => ({
    status: 200,
    message: "Order updated successfully",
    data: await Order.findOne({ where: { id, is_archived: false }, include: orderIncludes() }),
  }),
  failMessage: "Failed to update order",
});
```

Place both after `orderIncludes` is defined (they call it at request time, so any position after its definition works).

- [ ] **Step 6: Run the order tests**

Run: `cd backend && npm test -- tests/orderCommands.test.js tests/orderController.test.js tests/invoicePieces.test.js`
Expected: PASS.

- [ ] **Step 7: Whole suite**

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: every suite passes.

- [ ] **Step 8: Commit**

```bash
git add backend/src/commands/orders/schema.js backend/src/commands/orders/lines.js backend/src/commands/orders/createOrder.js backend/src/commands/orders/updateOrder.js backend/src/commands/index.js backend/src/controllers/orderController.js backend/tests/orderCommands.test.js
git commit -m "refactor(orders): create and update saved through commands; unknown status is a 400

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: Free model chain — Groq + Cloudflare, per-minute limits handled

**Files:**
- Create: `backend/src/assistant/config.js`, `backend/src/assistant/tokens.js`, `backend/src/assistant/providers/openaiCompat.js`, `backend/src/assistant/chain.js`, `backend/src/assistant/llm.js`
- Modify: `backend/src/services/assistant/assistantService.js` (use the new chain; removed entirely in Task 6)
- Delete: `backend/src/services/assistant/providers/geminiProvider.js`, `backend/src/services/assistant/providers/openaiCompatProvider.js`, `backend/src/services/assistant/providerChain.js`, `backend/tests/geminiProvider.test.js`, `backend/tests/openaiCompatProvider.test.js`, `backend/tests/providerChain.test.js`; npm package `@google/genai`
- Test: `backend/tests/assistantProvider.test.js`, `backend/tests/assistantChain.test.js`, `backend/tests/assistantLlm.test.js`

**Interfaces:**
- Produces:
  - `config.js`: `ASSISTANT_NAME`, `MAX_ROUNDS` (6), `CORE_BUDGET` (2000), `GUIDE_BUDGET` (800), `HISTORY_BUDGET` (900), `TOOL_RESULT_CHARS` (2400), `ACTION_TTL_MINUTES` (15), `SHORT_WAIT_S` (8), `PROVIDERS`, `MODEL_CHAIN`.
  - `estimateTokens(text) → number` from `tokens.js`.
  - `OpenAiCompatProvider({ key, baseUrl, apiKey, fetchFn?, timeoutMs? })`:
    - `.stream({ model, system, messages, tools, options })`: an async iterable of `{ text }` / `{ toolCalls: [{ id, name, args }] }`.
    - `.classify(err) → { cooldownS, waitable }`.
  - `parseDuration(text) → seconds | null`.
  - `createChain(entries, { now?, sleep?, log? }) → { stream(request) }`.
  - `QuotaExhaustedError(retryAfterSeconds)`, `NoModelError`, `formatWait(seconds)`.
  - `buildEntries(env) → entries`, `getChain() → chain`, from `llm.js`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/assistantProvider.test.js`:

```js
"use strict";

const { OpenAiCompatProvider, parseDuration } = require("../src/assistant/providers/openaiCompat");

const sse = (events, { status = 200, headers = {}, text = "" } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] },
  text: async () => text,
  body: new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(events.map((e) => `data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`).join("")));
      c.close();
    },
  }),
});

const collect = async (it) => {
  const out = [];
  for await (const c of it) out.push(c);
  return out;
};

describe("OpenAiCompatProvider", () => {
  test("streams text and joins tool-call fragments; sends model options", async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      sse([
        { choices: [{ delta: { reasoning: "thinking" } }] },
        { choices: [{ delta: { content: "Hi " } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "find", arguments: "{\"kind\":" } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "\"plate\"}" } }] } }] },
        "[DONE]",
      ])
    );
    const p = new OpenAiCompatProvider({ key: "groq", baseUrl: "https://x/v1", apiKey: "k", fetchFn });
    const chunks = await collect(p.stream({ model: "m", system: "s", messages: [{ role: "user", content: "q" }], tools: [{ name: "find", description: "d", parameters: {} }], options: { reasoning_effort: "low" } }));
    expect(chunks).toEqual([{ text: "Hi " }, { toolCalls: [{ id: "c1", name: "find", args: { kind: "plate" } }] }]);
    const [url, init] = fetchFn.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe("https://x/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer k");
    expect(body).toMatchObject({ model: "m", stream: true, reasoning_effort: "low", tools: [{ type: "function", function: { name: "find" } }] });
    expect(body.messages[0]).toEqual({ role: "system", content: "s" });
  });

  test("replays tool rounds in OpenAI shape", () => {
    const p = new OpenAiCompatProvider({ key: "groq", baseUrl: "https://x/v1", apiKey: "k" });
    const out = p.toMessages("s", [
      { role: "user", content: "q" },
      { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "dues", args: {} }] },
      { role: "tool", results: [{ id: "c1", name: "dues", result: "To collect ₹10" }] },
    ]);
    expect(out.slice(2)).toEqual([
      { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "dues", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "c1", content: "To collect ₹10" },
    ]);
  });

  test("a non-OK response throws with status and retry-after", async () => {
    const fetchFn = jest.fn().mockResolvedValue(sse([], { status: 429, headers: { "retry-after": "3" }, text: "rate limited" }));
    const p = new OpenAiCompatProvider({ key: "groq", baseUrl: "https://x/v1", apiKey: "k", fetchFn });
    await expect(collect(p.stream({ model: "m", system: "s", messages: [] }))).rejects.toMatchObject({ status: 429, retryAfterHeader: "3" });
  });

  describe("classify", () => {
    const p = new OpenAiCompatProvider({ key: "groq", baseUrl: "https://x/v1", apiKey: "k" });
    const err = (status, message = "", retryAfterHeader) => Object.assign(new Error(message), { status, retryAfterHeader });

    test.each([
      ["per-minute limit with a short retry-after is waited out", err(429, "", "3"), { cooldownS: 3, waitable: true }],
      ["per-minute limit from the message", err(429, "Please try again in 2.36s"), { cooldownS: 3, waitable: true }],
      ["daily limit with a long wait", err(429, "tokens per day (TPD): try again in 7m12.3s"), { cooldownS: 433, waitable: false }],
      ["daily limit with no time given", err(429, "daily free allocation exceeded"), { cooldownS: 3600, waitable: false }],
      ["too large for this model's minute", err(413, "Request too large"), { cooldownS: 60, waitable: false }],
      ["a fumbled tool call: try the next model, no cooldown", err(400, "tool_use_failed"), { cooldownS: 0, waitable: false }],
      ["model gone or key wrong", err(404, "model not found"), { cooldownS: 600, waitable: false }],
      ["server error or network", err(undefined, "fetch failed"), { cooldownS: 60, waitable: false }],
    ])("%s", (_, e, expected) => expect(p.classify(e)).toEqual(expected));
  });

  test.each([
    ["Please try again in 585ms", 1],
    ["try again in 2.36s", 3],
    ["try again in 7m12.3s", 433],
    ["try again in 1h2m", 3720],
    ["no time here", null],
  ])("parseDuration(%s) = %s", (text, s) => expect(parseDuration(text)).toBe(s));
});
```

`backend/tests/assistantChain.test.js`:

```js
"use strict";

const { createChain, QuotaExhaustedError, NoModelError, formatWait } = require("../src/assistant/chain");

// A provider whose calls follow a script: "ok", or an error to throw before the first chunk.
const scripted = (script) => {
  const calls = [];
  return {
    calls,
    stream({ model }) {
      calls.push(model);
      const step = script[Math.min(calls.length - 1, script.length - 1)];
      return (async function* () {
        if (step !== "ok") throw Object.assign(new Error(step.message || "err"), step);
        yield { text: `from ${model}` };
      })();
    },
    classify: (e) => e.verdict,
  };
};

const collect = async (it) => {
  const out = [];
  for await (const c of it) out.push(c.text);
  return out.join("");
};

describe("chain", () => {
  test("answers from the first healthy model", async () => {
    const a = scripted(["ok"]);
    const chain = createChain([{ label: "a", provider: a, model: "m1" }]);
    expect(await collect(chain.stream({}))).toBe("from m1");
  });

  test("a short per-minute limit is waited out once on the same model", async () => {
    const a = scripted([{ verdict: { cooldownS: 3, waitable: true } }, "ok"]);
    const sleep = jest.fn().mockResolvedValue();
    const chain = createChain([{ label: "a", provider: a, model: "m1" }], { sleep, log: () => {} });
    expect(await collect(chain.stream({}))).toBe("from m1");
    expect(sleep).toHaveBeenCalledWith(3000);
    expect(a.calls).toEqual(["m1", "m1"]);
  });

  test("anything else moves to the next model and cools the first down", async () => {
    let t = 0;
    const a = scripted([{ verdict: { cooldownS: 600, waitable: false } }]);
    const b = scripted(["ok"]);
    const chain = createChain([{ label: "a", provider: a, model: "m1" }, { label: "b", provider: b, model: "m2" }], { now: () => t, log: () => {} });
    expect(await collect(chain.stream({}))).toBe("from m2");
    t += 1000;
    expect(await collect(chain.stream({}))).toBe("from m2");
    expect(a.calls).toEqual(["m1"]); // still cooling down on the second request
  });

  test("when every model is rate-limited, says when to come back", async () => {
    const a = scripted([{ verdict: { cooldownS: 120, waitable: false } }]);
    const chain = createChain([{ label: "a", provider: a, model: "m1" }], { now: () => 0, log: () => {} });
    await expect(collect(chain.stream({}))).rejects.toBeInstanceOf(QuotaExhaustedError);
  });

  test("when no model could answer and none is rate-limited, it is a NoModelError", async () => {
    const a = scripted([{ verdict: { cooldownS: 0, waitable: false } }]);
    const chain = createChain([{ label: "a", provider: a, model: "m1" }], { log: () => {} });
    await expect(collect(chain.stream({}))).rejects.toBeInstanceOf(NoModelError);
  });

  test("formatWait reads naturally", () => {
    expect([formatWait(30), formatWait(600), formatWait(3600), formatWait(7300)]).toEqual(["a minute", "10 minutes", "an hour", "3 hours"]);
  });
});
```

`backend/tests/assistantLlm.test.js`:

```js
"use strict";

const { buildEntries } = require("../src/assistant/llm");
const { MODEL_CHAIN } = require("../src/assistant/config");

describe("model chain from config", () => {
  test("every configured model is used when both keys are set, in order", () => {
    const entries = buildEntries({ GROQ_API_KEY: "g", CLOUDFLARE_ACCOUNT_ID: "acc", CLOUDFLARE_API_TOKEN: "t" });
    expect(entries.map((e) => e.label)).toEqual(MODEL_CHAIN.map((m) => `${m.provider}:${m.model}`));
    expect(entries[0]).toMatchObject({ model: "openai/gpt-oss-120b", options: { reasoning_effort: "low" } });
  });

  test("a provider without its key is left out", () => {
    expect(buildEntries({ GROQ_API_KEY: "g" }).every((e) => e.label.startsWith("groq:"))).toBe(true);
    expect(buildEntries({ CLOUDFLARE_ACCOUNT_ID: "acc", CLOUDFLARE_API_TOKEN: "t" }).map((e) => e.label)).toEqual(["cloudflare:@cf/openai/gpt-oss-120b"]);
    expect(buildEntries({})).toEqual([]);
  });

  test("Cloudflare's URL carries the account id", () => {
    const [entry] = buildEntries({ CLOUDFLARE_ACCOUNT_ID: "acc", CLOUDFLARE_API_TOKEN: "t" });
    expect(entry.provider._baseUrl).toBe("https://api.cloudflare.com/client/v4/accounts/acc/ai/v1");
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `cd backend && npm test -- tests/assistantProvider.test.js tests/assistantChain.test.js tests/assistantLlm.test.js`
Expected: FAIL — `Cannot find module '../src/assistant/providers/openaiCompat'`.

- [ ] **Step 3: Write config and tokens**

`backend/src/assistant/config.js`:

```js
"use strict";

/** Everything someone might want to change about the assistant, in one place. */

const ASSISTANT_NAME = "Sage";

const MAX_ROUNDS = 6; // model calls per message; tools are withheld on the last
// Groq's free tier allows 8,000 tokens per minute per model (measured 2026-10-01),
// so one round's input stays near 3.5k (core + history + tool results) and a
// two-round answer fits in a minute.
const CORE_BUDGET = 2000; // core instructions + every tool declaration
const GUIDE_BUDGET = 800; // each knowledge guide
const HISTORY_BUDGET = 900; // earlier messages sent with a new question
const TOOL_RESULT_CHARS = 2400; // ≈ 600 tokens per tool result
const ACTION_TTL_MINUTES = 15;
const SHORT_WAIT_S = 8; // a per-minute limit that clears this soon is waited out

/** Each provider from the environment; `ready` is false when its key isn't set. */
const PROVIDERS = {
  groq: (env) => ({
    key: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: env.GROQ_API_KEY,
    ready: Boolean(env.GROQ_API_KEY),
  }),
  cloudflare: (env) => ({
    key: "cloudflare",
    baseUrl: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
    apiKey: env.CLOUDFLARE_API_TOKEN,
    ready: Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN),
  }),
};

/**
 * Failover order, best first. All free; none trains on our data. Each Groq
 * model has its own quota. reasoning_effort "low" halves gpt-oss's hidden
 * reasoning tokens (and its wait) with the same answers in our tests.
 */
const MODEL_CHAIN = [
  { provider: "groq", model: "openai/gpt-oss-120b", options: { reasoning_effort: "low" } },
  { provider: "groq", model: "qwen/qwen3.8-27b" },
  { provider: "cloudflare", model: "@cf/openai/gpt-oss-120b", options: { reasoning_effort: "low" } },
  { provider: "groq", model: "openai/gpt-oss-20b", options: { reasoning_effort: "low" } },
];

module.exports = {
  ASSISTANT_NAME, MAX_ROUNDS, CORE_BUDGET, GUIDE_BUDGET, HISTORY_BUDGET,
  TOOL_RESULT_CHARS, ACTION_TTL_MINUTES, SHORT_WAIT_S, PROVIDERS, MODEL_CHAIN,
};
```

`backend/src/assistant/tokens.js`:

```js
"use strict";

/** Rough token count — about 4 characters per token in English. Good enough for budgets. */
const estimateTokens = (text) => Math.ceil(String(text || "").length / 4);

module.exports = { estimateTokens };
```

- [ ] **Step 4: Write the provider adapter**

`backend/src/assistant/providers/openaiCompat.js`:

```js
"use strict";

const { SHORT_WAIT_S } = require("../config");

const DAILY = /per day|\(TPD\)|\(RPD\)|daily/i;

/** Groq's "try again in 7m12.3s" / "2.36s" / "585ms" → whole seconds, or null. */
const parseDuration = (text) => {
  const m = String(text || "").match(/try again in\s+([0-9hms.]+)/i);
  if (!m) return null;
  const s = m[1];
  if (/^[\d.]+ms$/.test(s)) return 1;
  const h = s.match(/([\d.]+)h/);
  const min = s.match(/([\d.]+)m(?!s)/);
  const sec = s.match(/([\d.]+)s/);
  if (!h && !min && !sec) return null;
  return Math.max(1, Math.ceil((h ? Number(h[1]) * 3600 : 0) + (min ? Number(min[1]) * 60 : 0) + (sec ? Number(sec[1]) : 0)));
};

/**
 * One OpenAI-compatible chat API (Groq, Cloudflare Workers AI), streamed over
 * SSE. Speaks the neutral message shape the agent loop uses:
 *   {role:'user', content} · {role:'assistant', content, toolCalls?} · {role:'tool', results}
 */
class OpenAiCompatProvider {
  constructor({ key, baseUrl, apiKey, fetchFn, timeoutMs = 30000 }) {
    this.key = key;
    this._baseUrl = baseUrl.replace(/\/$/, "");
    this._apiKey = apiKey;
    this._fetch = fetchFn || fetch;
    this._timeoutMs = timeoutMs;
  }

  toMessages(system, messages) {
    const out = [{ role: "system", content: system }];
    for (const m of messages) {
      if (m.role === "user") {
        out.push({ role: "user", content: m.content });
      } else if (m.role === "assistant") {
        const msg = { role: "assistant", content: m.content || "" };
        if (m.toolCalls?.length) {
          msg.tool_calls = m.toolCalls.map((tc, i) => ({
            id: tc.id || `call_${i}`,
            type: "function",
            function: { name: tc.name, arguments: JSON.stringify(tc.args ?? {}) },
          }));
        }
        out.push(msg);
      } else if (m.role === "tool") {
        m.results.forEach((r, i) => out.push({ role: "tool", tool_call_id: r.id || `call_${i}`, content: r.result }));
      }
    }
    return out;
  }

  async *stream({ model, system, messages, tools, options }) {
    // The timeout covers waiting for the response to start; streaming then runs freely.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this._timeoutMs);
    let res;
    try {
      res = await this._fetch(`${this._baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${this._apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: true,
          ...(options || {}),
          messages: this.toMessages(system, messages),
          tools: tools?.length ? tools.map((t) => ({ type: "function", function: t })) : undefined,
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(`${this.key} ${res.status}: ${body.slice(0, 500)}`);
      err.status = res.status;
      err.retryAfterHeader = res.headers?.get?.("retry-after") || undefined;
      throw err;
    }

    // Tool-call arguments arrive as JSON fragments that only parse once complete.
    const calls = new Map();
    const handleLine = (line) => {
      if (!line.startsWith("data:")) return null;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return null;
      let delta;
      try {
        delta = JSON.parse(data).choices?.[0]?.delta;
      } catch {
        return null; // keep-alive noise / truncated tail
      }
      if (!delta) return null;
      (delta.tool_calls || []).forEach((tc, pos) => {
        const idx = tc.index ?? pos;
        const slot = calls.get(idx) || { id: null, name: "", argsText: "" };
        if (tc.id) slot.id = tc.id;
        if (tc.function?.name) slot.name = tc.function.name;
        if (tc.function?.arguments) slot.argsText += tc.function.arguments;
        calls.set(idx, slot);
      });
      return delta.content || null; // reasoning deltas are not shown
    };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const text = handleLine(buf.slice(0, nl).trim());
        buf = buf.slice(nl + 1);
        if (text) yield { text };
      }
    }
    buf += decoder.decode();
    const tail = buf.trim();
    if (tail) {
      const text = handleLine(tail);
      if (text) yield { text };
    }

    if (calls.size) {
      yield {
        toolCalls: [...calls.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, c]) => {
            let args;
            try {
              args = JSON.parse(c.argsText || "{}");
            } catch {
              args = {}; // malformed: the tool's argument error goes back and the model retries
            }
            return { id: c.id || undefined, name: c.name, args };
          }),
      };
    }
  }

  /**
   * What to do after an error before the first chunk: how long to rest this
   * model, and whether the wait is short enough to just wait and retry it.
   */
  classify(err) {
    const status = err?.status;
    if (status === 429 || status === 413) {
      const header = parseFloat(err.retryAfterHeader);
      let s = Number.isFinite(header) && header > 0 ? Math.ceil(header) : parseDuration(err.message);
      if (s === null) s = DAILY.test(String(err.message)) ? 3600 : 60;
      return { cooldownS: s, waitable: s <= SHORT_WAIT_S };
    }
    if (status === 400) return { cooldownS: 0, waitable: false }; // the model fumbled a tool call
    if (status === 401 || status === 403 || status === 404) return { cooldownS: 600, waitable: false };
    return { cooldownS: 60, waitable: false }; // 5xx, timeout, network
  }
}

module.exports = { OpenAiCompatProvider, parseDuration };
```

- [ ] **Step 5: Write the chain and the chain builder**

`backend/src/assistant/chain.js`:

```js
"use strict";

class QuotaExhaustedError extends Error {
  constructor(retryAfterSeconds) {
    super("All assistant models are resting after their free limits");
    this.name = "QuotaExhaustedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

class NoModelError extends Error {
  constructor() {
    super("No assistant model could answer");
    this.name = "NoModelError";
  }
}

const formatWait = (seconds) => {
  if (seconds < 90) return "a minute";
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} minutes`;
  const hours = Math.ceil(seconds / 3600);
  return hours === 1 ? "an hour" : `${hours} hours`;
};

/**
 * Failover over (provider, model) entries, best first. Before the first chunk,
 * a short per-minute limit is waited out once on the same model; any other
 * failure rests that entry for the provider's cooldown and tries the next.
 * After the first chunk, errors propagate — replaying a half-streamed answer
 * on another model would duplicate it.
 */
const createChain = (entries, { now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = console.warn } = {}) => {
  const restUntil = entries.map(() => 0);

  async function* stream(request) {
    let soonest = Infinity;
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      if (restUntil[i] > now()) {
        soonest = Math.min(soonest, restUntil[i]);
        continue;
      }

      let opened = null;
      for (let attempt = 0; attempt < 2 && !opened; attempt += 1) {
        const iterator = entry.provider.stream({ ...request, model: entry.model, options: entry.options })[Symbol.asyncIterator]();
        try {
          opened = { iterator, first: await iterator.next() };
        } catch (err) {
          const { cooldownS, waitable } = entry.provider.classify(err);
          if (waitable && attempt === 0) {
            await sleep(cooldownS * 1000);
            continue;
          }
          if (cooldownS > 0) {
            restUntil[i] = now() + cooldownS * 1000;
            soonest = Math.min(soonest, restUntil[i]);
          }
          log(`assistant: ${entry.label} skipped (${err.status || err.message}); resting ${cooldownS}s`);
          break;
        }
      }
      if (!opened) continue;

      if (!opened.first.done) yield opened.first.value;
      for (;;) {
        const next = await opened.iterator.next();
        if (next.done) return;
        yield next.value;
      }
    }
    if (soonest === Infinity) throw new NoModelError();
    throw new QuotaExhaustedError(Math.max(Math.ceil((soonest - now()) / 1000), 30));
  }

  return { stream };
};

module.exports = { createChain, QuotaExhaustedError, NoModelError, formatWait };
```

`backend/src/assistant/llm.js`:

```js
"use strict";

const { OpenAiCompatProvider } = require("./providers/openaiCompat");
const { createChain } = require("./chain");
const { PROVIDERS, MODEL_CHAIN } = require("./config");

/** Chain entries from config, leaving out providers whose key isn't set. */
const buildEntries = (env = process.env) => {
  const providers = {};
  const entries = [];
  for (const { provider, model, options } of MODEL_CHAIN) {
    const def = PROVIDERS[provider](env);
    if (!def.ready) continue;
    providers[provider] = providers[provider] || new OpenAiCompatProvider(def);
    entries.push({ label: `${provider}:${model}`, provider: providers[provider], model, options });
  }
  return entries;
};

// One chain per process: rest periods must survive across requests.
let chain = null;
const getChain = () => {
  if (!chain) {
    const entries = buildEntries();
    if (!entries.length) console.error("assistant: no model keys set (GROQ_API_KEY, or CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN)");
    chain = createChain(entries);
  }
  return chain;
};

module.exports = { buildEntries, getChain };
```

- [ ] **Step 6: Point today's assistant at the new chain and remove Gemini**

In `backend/src/services/assistant/assistantService.js`:
- Delete the imports of `providerChain`, `GeminiProvider` and `OpenAiCompatProvider`.
- Delete the `buildEntries` and `getChain` functions and the comment above `buildEntries`.
- Add:

```js
const { getChain } = require("../../assistant/llm");
const { QuotaExhaustedError, formatWait } = require("../../assistant/chain");
```

`runAgent` keeps calling `getChain().stream(req)`; `module.exports` keeps exporting `QuotaExhaustedError` and `formatWait`.

Run:

```bash
cd backend && git rm -q src/services/assistant/providers/geminiProvider.js src/services/assistant/providers/openaiCompatProvider.js src/services/assistant/providerChain.js tests/geminiProvider.test.js tests/openaiCompatProvider.test.js tests/providerChain.test.js && npm uninstall @google/genai
```

Expected: the files are removed and `@google/genai` is gone from `package.json`.

- [ ] **Step 7: Run the new tests and the whole suite**

Run: `cd backend && npm test -- tests/assistantProvider.test.js tests/assistantChain.test.js tests/assistantLlm.test.js`
Expected: PASS.

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: every suite passes (`assistantService.test.js` still passes; it injects its own stream).

- [ ] **Step 8: Commit**

```bash
git add backend/src/assistant/config.js backend/src/assistant/tokens.js backend/src/assistant/providers/openaiCompat.js backend/src/assistant/chain.js backend/src/assistant/llm.js backend/src/services/assistant/assistantService.js backend/package.json backend/package-lock.json backend/tests/assistantProvider.test.js backend/tests/assistantChain.test.js backend/tests/assistantLlm.test.js
git commit -m "feat(assistant): free Groq + Cloudflare model chain; short per-minute limits waited out; Gemini and Mistral removed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(The `git rm` in Step 6 already staged the deletions.)

---
### Task 5: Tool framework and typed read tools (dues, customer summary, period summary, find, SQL fallback)

**Files:**
- Create: `backend/src/assistant/format.js`, `backend/src/assistant/tools/defineTool.js`, `backend/src/assistant/tools/fields.js`, `backend/src/assistant/tools/executeTool.js`, `backend/src/assistant/tools/find.js`, `backend/src/assistant/tools/dues.js`, `backend/src/assistant/tools/customerSummary.js`, `backend/src/assistant/tools/periodSummary.js`, `backend/src/assistant/tools/runQuery.js`, `backend/src/assistant/tools/index.js`
- Move: `backend/src/services/assistant/sqlGuard.js` → `backend/src/assistant/db/sqlGuard.js`; `backend/src/services/assistant/assistantDb.js` → `backend/src/assistant/db/assistantDb.js`
- Modify: imports in `backend/tests/sqlGuard.test.js`, `backend/tests/assistantDb.test.js`, `backend/tests/knowledgeQueries.test.js`, `backend/src/services/assistant/assistantService.js`
- Test: `backend/tests/assistantTools.test.js`

**Interfaces:**
- Consumes: `loadOrders`, `loadLedger`, `computeOverview`, `computePeriod`, `resolvePeriod`, `PeriodError`, `buildCustomerSummary`, `toOrderRow`, `findSimilar` (existing services); `TOOL_RESULT_CHARS` (Task 4).
- Produces:
  - **From `tools/defineTool.js`:**
    - `defineTool({ name, description, input, run }) → { name, description, input, run, declaration: { name, description, parameters } }`. `run(args, ctx)` returns a string or `{ text, action? }`.
    - `parseArgs(schema, args)`: drops `null`s recursively, then Zod-parses; throws `ToolInputError` (`expected = true`).
    - `toParameters(schema)`: Zod → JSON Schema, without `$schema`.
    - `dropNulls(value)`.
  - **From `tools/fields.js`:** `recordId()`, `isoDate()`, `money()`. `money()` accepts numbers or text like "₹5,000".
  - **From `tools/executeTool.js`:** `executeTool(tools, { name, args }, ctx) → Promise<{ text, action? }>`. It never throws.
  - **From `tools/index.js`:** `READ_TOOLS`.
  - **From `format.js`:** `rupee(n)`, `dayText(iso)`, `itemsText(items)`, `capLines(lines, max)`, `ORDER_STATUS_LABEL`, `METHOD_LABEL`, `PAYMENT_TYPE_LABEL`.
  - **Tool names:** `find`, `dues`, `customer_summary`, `period_summary`, `run_query`.

- [ ] **Step 1: Move the read-only database files**

```bash
cd backend && mkdir -p src/assistant/db && git mv src/services/assistant/sqlGuard.js src/assistant/db/sqlGuard.js && git mv src/services/assistant/assistantDb.js src/assistant/db/assistantDb.js
```

Then fix the import paths:
- In `tests/sqlGuard.test.js`, `tests/assistantDb.test.js` and `tests/knowledgeQueries.test.js`: `../src/services/assistant/sqlGuard` → `../src/assistant/db/sqlGuard`, and `../src/services/assistant/assistantDb` → `../src/assistant/db/assistantDb`.
- In `src/services/assistant/assistantService.js`: `./assistantDb` → `../../assistant/db/assistantDb`.

Run: `cd backend && npm test -- tests/sqlGuard.test.js tests/assistantDb.test.js tests/knowledgeQueries.test.js tests/assistantService.test.js`
Expected: PASS (moved code, same behaviour).

- [ ] **Step 2: Write the failing tests**

`backend/tests/assistantTools.test.js`:

```js
"use strict";

const { z } = require("zod");
const db = require("../src/models");
const { executeTool } = require("../src/assistant/tools/executeTool");
const { defineTool, parseArgs } = require("../src/assistant/tools/defineTool");
const { money } = require("../src/assistant/tools/fields");
const { READ_TOOLS } = require("../src/assistant/tools");
const { closePool } = require("../src/assistant/db/assistantDb");
const { computeOverview, computePeriod } = require("../src/services/dashboard/metrics");
const { loadLedger, loadOrders } = require("../src/services/dashboard/ledger");
const { buildCustomerSummary } = require("../src/services/lists/customerDirectory");
const { todayIST, resolvePeriod } = require("../src/services/dashboard/dateRanges");
const { rupee } = require("../src/assistant/format");
const { TOOL_RESULT_CHARS } = require("../src/assistant/config");
const { createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

afterAll(() => closePool());

const run = async (name, args) => (await executeTool(READ_TOOLS, { name, args }, {})).text;

describe("read tools", () => {
  let surat;
  let delhi;
  let plate;
  let pcsSize;

  beforeEach(async () => {
    surat = await db.Customer.create({ name: "Sharma Traders", metadata: { phone: "9876500001", city: "Surat" } });
    delhi = await db.Customer.create({ name: "Sharma Traders", metadata: { phone: "9876500002", city: "Delhi" } });
    plate = await createPlateType("1500.00");
    const kgSize = await createSize({ size_label: "12 x 16", rate_per_kg: "180.00" });
    pcsSize = await createSize({ size_label: "14 x 18", rate_per_kg: "0.00", piece_price_amount: "375", piece_price_count: 1000 });
    const order = await createOrderWithLines({
      customer: surat, plateType: plate, order_date: todayIST(),
      lines: [{ product_size_id: kgSize.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "180.00" }],
    });
    await db.Payment.create({ order_id: order.id, customer_id: surat.id, amount: "1000.00", payment_type: "PARTIAL", payment_date: todayIST() });
  });

  test("find customer by name lists every match with its id", async () => {
    const text = await run("find", { kind: "customer", text: "sharma" });
    expect(text).toContain(`${surat.id} | Sharma Traders | 9876500001 | Surat`);
    expect(text).toContain(`${delhi.id} | Sharma Traders | 9876500002 | Delhi`);
  });

  test("find customer by phone digits", async () => {
    const text = await run("find", { kind: "customer", text: "500002" });
    expect(text).toContain(delhi.id);
    expect(text).not.toContain(surat.id);
  });

  test("find size matches labels written either way and says what is not saved", async () => {
    const text = await run("find", { kind: "size", text: "14x18" });
    expect(text).toBe(`${pcsSize.id} | 14 x 18 | rate/kg not saved | pcs price ₹375 per 1000`);
  });

  test("find plate lists plates with their charge", async () => {
    expect(await run("find", { kind: "plate", text: null })).toContain(`${plate.id} | ${plate.type_name} | ₹1,500`);
  });

  test("find order lists a customer's orders with the due the screens show", async () => {
    const text = await run("find", { kind: "order", customer_id: surat.id });
    expect(text).toMatch(/\| 12 x 16 10 kg \| Pending \| total ₹3,300 \| due ₹2,300$/);
    expect(await run("find", { kind: "order" })).toMatch(/customer_id/);
  });

  test("dues gives the dashboard's figures", async () => {
    const o = computeOverview(await loadLedger(db), todayIST());
    const text = await run("dues", {});
    expect(text).toContain(`To collect ${rupee(o.toCollect)} from 1 customers`);
    expect(text).toContain(`${surat.id} | Sharma Traders | ₹2,300 | 1 orders`);
  });

  test("customer_summary gives the customer page's figures", async () => {
    const s = buildCustomerSummary(surat.toJSON(), await loadOrders(db, { is_archived: false, customer_id: surat.id }), todayIST());
    const text = await run("customer_summary", { customer_id: surat.id });
    expect(text).toContain(`Owes ${rupee(s.owes)} | credit ${rupee(s.credit)} | business ${rupee(s.totalBusiness)} | received ${rupee(s.received)}`);
    expect(await run("customer_summary", { customer_id: "00000000-0000-4000-8000-000000000000" })).toMatch(/No customer with that id/);
  });

  test("period_summary gives the dashboard period card's figures", async () => {
    const ledger = await loadLedger(db);
    const { range, compare } = resolvePeriod({ preset: "this_month" }, todayIST(), ledger.earliest, ledger.latest);
    const p = computePeriod(ledger, range, compare);
    const text = await run("period_summary", { preset: "this_month" });
    expect(text).toContain(`Sales ${rupee(p.sales.value)}`);
    expect(text).toContain(`Collected ${rupee(p.collected.value)}`);
    expect(await run("period_summary", { preset: "custom", from: "2026-09-10", to: "2026-09-01" })).toBe("From date must be on or before To date");
  });

  test("run_query answers with rows", async () => {
    expect(await run("run_query", { sql: "SELECT 1 AS n" })).toBe('{"rowCount":1,"rows":[{"n":1}]}');
  });
});

describe("executeTool", () => {
  const echo = defineTool({ name: "echo", description: "d", input: z.object({ word: z.string() }), run: ({ word }) => word.repeat(10000) });

  test("bad arguments come back as an error the model can read", async () => {
    expect((await executeTool([echo], { name: "echo", args: { word: 5 } }, {})).text).toMatch(/^\{"error":"word: /);
  });

  test("an unknown tool is an error, not a crash", async () => {
    expect((await executeTool([echo], { name: "nope", args: {} }, {})).text).toBe('{"error":"There is no tool called nope"}');
  });

  test("long results are cut to the budget", async () => {
    const { text } = await executeTool([echo], { name: "echo", args: { word: "ab" } }, {});
    expect(text.length).toBeLessThanOrEqual(TOOL_RESULT_CHARS + 10);
    expect(text.endsWith("…[cut]")).toBe(true);
  });

  test("nulls are treated as not given, at any depth", () => {
    const schema = z.object({ a: z.string().optional(), list: z.array(z.object({ b: z.number().optional() })) });
    expect(parseArgs(schema, { a: null, list: [{ b: null }] })).toEqual({ list: [{}] });
  });

  test("money accepts text with ₹ and commas", () => {
    const schema = z.object({ amount: money() });
    expect(["5,000", "₹5000", "5000.00", 5000].map((amount) => parseArgs(schema, { amount }).amount)).toEqual([5000, 5000, 5000, 5000]);
    expect(() => parseArgs(schema, { amount: "five" })).toThrow(/amount/);
  });

  test("every read tool declares JSON Schema parameters", () => {
    for (const t of READ_TOOLS) expect(t.declaration.parameters).toMatchObject({ type: "object" });
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `cd backend && npm test -- tests/assistantTools.test.js`
Expected: FAIL — `Cannot find module '../src/assistant/tools/executeTool'`.

- [ ] **Step 4: Write formatting helpers**

`backend/src/assistant/format.js`:

```js
"use strict";

const fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ₹ the way the app shows it: Indian grouping, no trailing zeros (₹2,300, ₹250.5). */
const rupee = (n) => {
  const v = Number(n) || 0;
  return `${v < 0 ? "-" : ""}₹${fmt.format(Math.abs(v))}`;
};

/** "2026-09-12" → "12 Sep 2026". */
const dayText = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

/** Order-row items → "12 x 16 10 kg, 14 x 18 5000 pcs". */
const itemsText = (items) => (items || []).map((i) => `${i.size} ${i.quantity} ${i.unit === "PIECES" ? "pcs" : "kg"}`).join(", ") || "no items";

const capLines = (lines, max) => (lines.length > max ? [...lines.slice(0, max), `…and ${lines.length - max} more`] : lines);

const ORDER_STATUS_LABEL = { PENDING: "Pending", IN_PROGRESS: "In progress", COMPLETED: "Completed", DELIVERED: "Delivered", CANCELLED: "Cancelled" };
const METHOD_LABEL = { CASH: "Cash", UPI: "UPI", BANK_TRANSFER: "Bank", CHECK: "Cheque", OTHER: "Other" };
const PAYMENT_TYPE_LABEL = { ADVANCE: "Advance", PARTIAL: "Part payment", FINAL: "Final payment", REFUND: "Refund" };

module.exports = { rupee, dayText, itemsText, capLines, ORDER_STATUS_LABEL, METHOD_LABEL, PAYMENT_TYPE_LABEL };
```

- [ ] **Step 5: Write the tool framework**

`backend/src/assistant/tools/defineTool.js`:

```js
"use strict";

const { z } = require("zod");

/** Told back to the model so it can fix the call or ask the person. */
class ToolInputError extends Error {
  constructor(message) {
    super(message);
    this.expected = true;
  }
}

/** Models send null for "not given"; Zod's optional() wants the key left out. */
const dropNulls = (v) => {
  if (Array.isArray(v)) return v.map(dropNulls);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null).map(([k, x]) => [k, dropNulls(x)]));
  }
  return v;
};

const parseArgs = (schema, args) => {
  const result = schema.safeParse(dropNulls(args && typeof args === "object" ? args : {}));
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw new ToolInputError(`${issue.path.join(".") || "arguments"}: ${issue.message}`);
};

/** JSON Schema for the model, made from the same Zod schema that checks its arguments. */
const toParameters = (schema) => {
  // "any" keeps preprocess steps (money()) from throwing; the model sees the output type.
  const { $schema, ...rest } = z.toJSONSchema(schema, { unrepresentable: "any" }); // eslint-disable-line no-unused-vars
  return rest;
};

/**
 * A tool the model can call. `run(args, ctx)` returns the text the model reads,
 * or { text, action } for a proposal card. Keep text compact: on the free tier
 * every character costs tokens.
 */
const defineTool = ({ name, description, input, run }) => {
  if (!/^[a-z_]+$/.test(name || "") || !description || !input || typeof run !== "function") {
    throw new Error(`defineTool: bad definition for ${name}`);
  }
  return Object.freeze({ name, description, input, run, declaration: { name, description, parameters: toParameters(input) } });
};

module.exports = { defineTool, parseArgs, toParameters, dropNulls, ToolInputError };
```

`backend/src/assistant/tools/fields.js`:

```js
"use strict";

const { z } = require("zod");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An id the model got from find — never a name. */
const recordId = () => z.string().regex(UUID, { error: "use an id from find, not a name" });

const isoDate = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "use a date like 2026-10-01" });

/** Rupees as a number; "₹5,000" and "5000.00" are read as 5000. */
const money = () =>
  z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/[₹,\s]/g, "")) : v),
    z.number({ error: "give the amount as a number" }).positive({ error: "the amount must be above 0" })
  );

module.exports = { recordId, isoDate, money };
```

`backend/src/assistant/tools/executeTool.js`:

```js
"use strict";

const { parseArgs } = require("./defineTool");
const { TOOL_RESULT_CHARS } = require("../config");

const cap = (text) => (text.length > TOOL_RESULT_CHARS ? `${text.slice(0, TOOL_RESULT_CHARS)} …[cut]` : text);
const errorText = (message) => JSON.stringify({ error: message });

/**
 * Run one tool call from the model. Never throws: problems come back as
 * {"error": …} so the model can fix its call or ask the person.
 * Resolves to { text, action? } — action is a card for the app.
 */
const executeTool = async (tools, call, ctx) => {
  const tool = tools.find((t) => t.name === call.name);
  if (!tool) return { text: errorText(`There is no tool called ${call.name}`) };
  try {
    const out = await tool.run(parseArgs(tool.input, call.args), ctx);
    return typeof out === "string" ? { text: cap(out) } : { ...out, text: cap(out.text) };
  } catch (err) {
    if (!err.expected) console.error(`assistant tool ${call.name} failed:`, err);
    return { text: errorText(err.message) };
  }
};

module.exports = { executeTool };
```

- [ ] **Step 6: Write the read tools**

`backend/src/assistant/tools/find.js`:

```js
"use strict";

const { z } = require("zod");
const models = require("../../models");
const { defineTool } = require("./defineTool");
const { recordId } = require("./fields");
const { findSimilar } = require("../../services/customerSimilar");
const { loadOrders } = require("../../services/dashboard/ledger");
const { toOrderRow } = require("../../services/lists/orderList");
const { rupee, itemsText, capLines, ORDER_STATUS_LABEL } = require("../format");

const digits = (s) => String(s || "").replace(/\D/g, "");
const squashSize = (s) => String(s || "").toLowerCase().replace(/[×*]/g, "x").replace(/[^a-z0-9.]/g, "");

const customers = async (text) => {
  if (!text.trim()) return "Give a name or phone number to look for.";
  const all = (await models.Customer.findAll({ where: { is_archived: false }, attributes: ["id", "name", "metadata"] })).map((c) => c.toJSON());
  const d = digits(text);
  const byPhone = d.length >= 4 ? all.filter((c) => digits(c.metadata?.phone).includes(d)) : [];
  const seen = new Set();
  const list = [...byPhone, ...findSimilar(text, all, null, 5)].filter((c) => !seen.has(c.id) && seen.add(c.id)).slice(0, 5);
  if (!list.length) return `No customer matches "${text}".`;
  return list.map((c) => [c.id, c.name, c.metadata?.phone || "no phone", c.metadata?.city].filter(Boolean).join(" | ")).join("\n");
};

const sizes = async (text) => {
  const all = await models.ProductSize.findAll({ where: { is_archived: false }, order: [["size_label", "ASC"]] });
  const q = squashSize(text);
  const list = q ? all.filter((s) => squashSize(s.size_label).includes(q)) : all;
  if (!list.length) return `No size matches "${text}". Call find with kind size and no text to list them all.`;
  const line = (s) => {
    const rate = Number(s.rate_per_kg) > 0 ? `rate/kg ${rupee(s.rate_per_kg)}` : "rate/kg not saved";
    const pcs = s.piece_price_amount != null ? `pcs price ${rupee(s.piece_price_amount)} per ${s.piece_price_count}` : "pcs price not saved";
    return `${s.id} | ${s.size_label} | ${rate} | ${pcs}`;
  };
  return capLines(list.map(line), 25).join("\n");
};

const plates = async () => {
  const all = await models.PlateType.findAll({ where: { is_archived: false }, order: [["type_name", "ASC"]] });
  return all.map((p) => `${p.id} | ${p.type_name} | ${rupee(p.charge)}`).join("\n") || "No plate types are saved.";
};

const orders = async (customerId) => {
  if (!customerId) return "Give customer_id (from find with kind customer) to list that customer's orders.";
  const rows = (await loadOrders(models, { is_archived: false, customer_id: customerId }))
    .map(toOrderRow)
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate) || new Date(b.createdAt) - new Date(a.createdAt));
  if (!rows.length) return "This customer has no orders.";
  const line = (r) => `${r.id} | ${r.orderDate} | ${itemsText(r.items)} | ${ORDER_STATUS_LABEL[r.status] || r.status} | total ${rupee(r.total)} | due ${rupee(r.due)}`;
  return capLines(rows.map(line), 10).join("\n");
};

module.exports = defineTool({
  name: "find",
  description:
    "Look up ids. kind customer: text is a name or phone. kind size: text is a label like 12 x 16 (empty lists all). kind plate: lists all. kind order: customer_id lists that customer's orders, newest first, with due.",
  input: z.object({ kind: z.enum(["customer", "size", "plate", "order"]), text: z.string().optional(), customer_id: recordId().optional() }),
  run: ({ kind, text = "", customer_id }) => {
    if (kind === "customer") return customers(text);
    if (kind === "size") return sizes(text);
    if (kind === "plate") return plates();
    return orders(customer_id);
  },
});
```

`backend/src/assistant/tools/dues.js`:

```js
"use strict";

const { z } = require("zod");
const models = require("../../models");
const { defineTool } = require("./defineTool");
const { loadLedger } = require("../../services/dashboard/ledger");
const { computeOverview } = require("../../services/dashboard/metrics");
const { todayIST } = require("../../services/dashboard/dateRanges");
const { rupee, capLines } = require("../format");

module.exports = defineTool({
  name: "dues",
  description: "Money customers owe right now, as on the dashboard: total to collect, credit, and each customer owing (largest first).",
  input: z.object({}),
  run: async () => {
    const o = computeOverview(await loadLedger(models), todayIST());
    const head = `To collect ${rupee(o.toCollect)} from ${o.customersOwing} customers (${o.ordersOwing} orders). Paid extra (credit) ${rupee(o.credit)}.`;
    const lines = [...o.customers]
      .sort((a, b) => b.amount - a.amount)
      .map((c) => `${c.id} | ${c.name} | ${rupee(c.amount)} | ${c.orders} orders | oldest unpaid ${c.oldestOrderDate} (${c.oldestDays} days)`);
    return [head, ...capLines(lines, 20)].join("\n");
  },
});
```

`backend/src/assistant/tools/customerSummary.js`:

```js
"use strict";

const { z } = require("zod");
const models = require("../../models");
const { defineTool } = require("./defineTool");
const { recordId } = require("./fields");
const { loadOrders } = require("../../services/dashboard/ledger");
const { buildCustomerSummary } = require("../../services/lists/customerDirectory");
const { todayIST } = require("../../services/dashboard/dateRanges");
const { rupee, itemsText, ORDER_STATUS_LABEL, PAYMENT_TYPE_LABEL, METHOD_LABEL } = require("../format");

module.exports = defineTool({
  name: "customer_summary",
  description: "One customer as on their page: owes, credit, business, received, their orders with due, and recent payments.",
  input: z.object({ customer_id: recordId() }),
  run: async ({ customer_id }) => {
    const customer = await models.Customer.findOne({ where: { id: customer_id, is_archived: false } });
    if (!customer) return "No customer with that id. Use find with kind customer.";
    const s = buildCustomerSummary(customer.toJSON(), await loadOrders(models, { is_archived: false, customer_id }), todayIST());
    const c = s.customer;
    const lines = [
      [c.name, c.phone, c.city].filter(Boolean).join(" | "),
      `Owes ${rupee(s.owes)} | credit ${rupee(s.credit)} | business ${rupee(s.totalBusiness)} | received ${rupee(s.received)} | ${s.ordersCount} orders` +
        (s.oldestUnpaidDays != null ? ` | oldest unpaid ${s.oldestUnpaidDays} days` : ""),
      ...s.orders.slice(0, 10).map((r) =>
        `order ${r.id} | ${r.orderDate} | ${itemsText(r.items)} | ${ORDER_STATUS_LABEL[r.status] || r.status} | total ${rupee(r.total)} | received ${rupee(r.received)} | due ${rupee(r.due)}`),
      ...(s.orders.length > 10 ? [`…and ${s.orders.length - 10} older orders`] : []),
      ...s.payments.slice(0, 5).map((p) => `payment | ${p.date} | ${rupee(p.amount)} | ${PAYMENT_TYPE_LABEL[p.type] || p.type} | ${METHOD_LABEL[p.method] || p.method}`),
    ];
    return lines.join("\n");
  },
});
```

`backend/src/assistant/tools/periodSummary.js`:

```js
"use strict";

const { z } = require("zod");
const models = require("../../models");
const { defineTool } = require("./defineTool");
const { isoDate } = require("./fields");
const { loadLedger } = require("../../services/dashboard/ledger");
const { computePeriod } = require("../../services/dashboard/metrics");
const { todayIST, resolvePeriod, PeriodError } = require("../../services/dashboard/dateRanges");
const { rupee } = require("../format");

const prev = (x) => (x === null || x === undefined ? "" : ` (previous ${rupee(x)})`);

module.exports = defineTool({
  name: "period_summary",
  description: "Sales, money collected, kg sold and expenses for a period, as on the dashboard. preset this_month, last_month, this_fy, all, or custom with from and to.",
  input: z.object({ preset: z.enum(["this_month", "last_month", "this_fy", "all", "custom"]), from: isoDate().optional(), to: isoDate().optional() }),
  run: async ({ preset, from, to }) => {
    const ledger = await loadLedger(models);
    let period;
    try {
      period = resolvePeriod({ preset, from, to }, todayIST(), ledger.earliest, ledger.latest);
    } catch (err) {
      if (err instanceof PeriodError) return err.message;
      throw err;
    }
    const p = computePeriod(ledger, period.range, period.compare);
    const v = p.volume;
    return [
      `${p.range.label}: ${p.range.from} to ${p.range.to}` + (p.compare ? `; previous period ${p.compare.from} to ${p.compare.to}` : ""),
      `Sales ${rupee(p.sales.value)}${prev(p.sales.previous)} from ${p.sales.orders} orders`,
      `Collected ${rupee(p.collected.value)}${prev(p.collected.previous)} in ${p.collected.payments} payments`,
      `Sold ${v.kgSold} kg` + (v.piecesTotal ? ` and ${v.piecesTotal} pcs` : "") + (v.piecesWithoutWeight ? ` (${v.piecesWithoutWeight} pcs have no weight, so they are not in the kg)` : ""),
      `Expenses ${rupee(p.expenses.value)}${prev(p.expenses.previous)}` +
        (p.expenses.byCategory.length ? `: ${p.expenses.byCategory.slice(0, 6).map((c) => `${c.name} ${rupee(c.amount)}`).join(", ")}` : ""),
      p.excluded.cancelled.count ? `Not counted: ${p.excluded.cancelled.count} cancelled orders (${rupee(p.excluded.cancelled.amount)})` : null,
    ].filter(Boolean).join("\n");
  },
});
```

`backend/src/assistant/tools/runQuery.js`:

```js
"use strict";

const { z } = require("zod");
const { defineTool } = require("./defineTool");
const { runQuery } = require("../db/assistantDb");

module.exports = defineTool({
  name: "run_query",
  description: "Fallback for questions the other tools don't answer: one read-only SELECT (or WITH … SELECT). Read the area's guide first. At most 200 rows.",
  input: z.object({ sql: z.string().min(1) }),
  run: async ({ sql }) => {
    try {
      return await runQuery(sql);
    } catch (err) {
      return JSON.stringify({ error: err.message }); // a bad query is normal: the model fixes it
    }
  },
});
```

`backend/src/assistant/tools/index.js`:

```js
"use strict";

/** Tools that only read. Typed tools first: their figures match the screens. */
const READ_TOOLS = [
  require("./dues"),
  require("./customerSummary"),
  require("./periodSummary"),
  require("./find"),
  require("./runQuery"),
];

module.exports = { READ_TOOLS };
```

- [ ] **Step 7: Run the tests**

Run: `cd backend && npm test -- tests/assistantTools.test.js`
Expected: PASS (15 tests). If `find size` fails on the exact text, compare against the line format in `find.js` and fix the code, not the test. The test pins the format the model reads.

- [ ] **Step 8: Whole suite, then commit**

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: every suite passes.

```bash
git add backend/src/assistant/format.js backend/src/assistant/tools/defineTool.js backend/src/assistant/tools/fields.js backend/src/assistant/tools/executeTool.js backend/src/assistant/tools/find.js backend/src/assistant/tools/dues.js backend/src/assistant/tools/customerSummary.js backend/src/assistant/tools/periodSummary.js backend/src/assistant/tools/runQuery.js backend/src/assistant/tools/index.js backend/src/assistant/db/sqlGuard.js backend/src/assistant/db/assistantDb.js backend/src/services/assistant/assistantService.js backend/tests/sqlGuard.test.js backend/tests/assistantDb.test.js backend/tests/knowledgeQueries.test.js backend/tests/assistantTools.test.js
git commit -m "feat(assistant): typed read tools that reuse the dashboard and customer page code; find for ids

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: Guides on demand, core instructions, agent loop, and the chat switched to Sage

**Files:**
- Create: `backend/src/assistant/guides.js`, `backend/src/assistant/prompt/core.md`, `backend/src/assistant/prompt/buildSystemPrompt.js`, `backend/src/assistant/tools/readGuide.js`, `backend/src/assistant/toolset.js`, `backend/src/assistant/history.js`, `backend/src/assistant/agentLoop.js`, `backend/src/assistant/index.js`
- Rewrite: every file in `backend/knowledge/` (front matter, ≤ 800 tokens each, split as listed in Step 4)
- Modify: `backend/src/assistant/tools/index.js` (add `read_guide`), `backend/src/controllers/assistantController.js` (`sendMessage` uses `runAssistant`), `backend/tests/knowledgeQueries.test.js` (find the tested SQL in any guide)
- Delete: `backend/src/services/assistant/` (`agentLoop.js`, `assistantService.js`, `knowledgeLoader.js`), `backend/tests/assistantService.test.js`, `backend/tests/knowledgeLoader.test.js`, `backend/knowledge/00-instructions.md`, `backend/knowledge/schema.md`, `backend/knowledge/routes.md`
- Test: `backend/tests/assistantAgent.test.js`, `backend/tests/assistantGuides.test.js`

**Interfaces:**
- Consumes: `READ_TOOLS`, `executeTool` (Task 5); `getChain`, config budgets (Task 4).
- Produces:
  - **From `guides.js`:**
    - `parseGuide(file, text) → { file, area, summary, tables: string[], body }` (throws on missing front matter).
    - `loadGuides(dir?) → Guide[]`, cached.
    - `guideIndex(guides?) → string`.
  - `buildSystemPrompt({ today, actions = [] }) → string`, where `actions` is `[{ toolName, summary }]`.
  - `allTools() → Tool[]` from `toolset.js`. Task 7 adds action tools here.
  - `fitHistory(messages, budgetTokens) → messages`.
  - `runAgent({ system, history, tools, stream, executeTool, onDelta, onStatus, onAction?, maxRounds? }) → Promise<string>`. `executeTool(call)` resolves to `{ text, action? }`, and each `action` is passed to `onAction`.
  - `runAssistant(history, { onDelta, onStatus, onAction? }, ctx = {}, deps = {}) → Promise<string>`:
    - `ctx` is `{ conversationId, userId, requestText }`.
    - `deps` is `{ stream?, tools?, system? }`, for tests.

- [ ] **Step 1: Write the failing tests**

`backend/tests/assistantAgent.test.js`:

```js
"use strict";

const { runAgent } = require("../src/assistant/agentLoop");
const { fitHistory } = require("../src/assistant/history");
const { runAssistant } = require("../src/assistant");

const fakeStream = (rounds) => {
  let call = 0;
  const fn = async function* (request) {
    fn.requests.push(request);
    const chunks = rounds[Math.min(call, rounds.length - 1)];
    call += 1;
    for (const c of chunks) yield c;
  };
  fn.requests = [];
  return fn;
};
const noop = () => {};
const base = (extra) => ({ system: "s", history: [{ role: "user", content: "q" }], tools: [{ name: "dues" }], onDelta: noop, onStatus: noop, ...extra });

describe("agent loop", () => {
  test("a plain answer is streamed and returned", async () => {
    const deltas = [];
    const final = await runAgent(base({ stream: fakeStream([[{ text: "Hello " }, { text: "there" }]]), executeTool: jest.fn(), onDelta: (t) => deltas.push(t) }));
    expect([final, deltas]).toEqual(["Hello there", ["Hello ", "there"]]);
  });

  test("a tool round runs the tool, shows a status and feeds the result back", async () => {
    const stream = fakeStream([[{ toolCalls: [{ id: "c1", name: "dues", args: {} }] }], [{ text: "You are owed ₹10." }]]);
    const executeTool = jest.fn().mockResolvedValue({ text: "To collect ₹10" });
    const statuses = [];
    const final = await runAgent(base({ stream, executeTool, onStatus: (t) => statuses.push(t) }));
    expect(final).toBe("You are owed ₹10.");
    expect(statuses).toEqual(["Checking dues…"]);
    expect(stream.requests[1].messages.slice(-2)).toEqual([
      { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "dues", args: {} }] },
      { role: "tool", results: [{ id: "c1", name: "dues", result: "To collect ₹10" }] },
    ]);
  });

  test("a card a tool returns goes to onAction", async () => {
    const card = { id: "a1", status: "pending" };
    const stream = fakeStream([[{ toolCalls: [{ id: "c1", name: "propose_x", args: {} }] }], [{ text: "Tap Confirm." }]]);
    const onAction = jest.fn();
    await runAgent(base({ stream, executeTool: jest.fn().mockResolvedValue({ text: "Card shown", action: card }), onAction }));
    expect(onAction).toHaveBeenCalledWith(card);
  });

  test("tools are withheld from the last round, so it must answer", async () => {
    const stream = fakeStream([[{ toolCalls: [{ name: "dues", args: {} }] }]]);
    const final = await runAgent(base({ stream, executeTool: jest.fn().mockResolvedValue({ text: "x" }), maxRounds: 2 }));
    expect(stream.requests.map((r) => Boolean(r.tools))).toEqual([true, true, false]);
    expect(final).toMatch(/couldn't finish/);
  });

  test("an empty answer never reaches the person blank", async () => {
    expect(await runAgent(base({ stream: fakeStream([[]]), executeTool: jest.fn() }))).toMatch(/couldn't come up with an answer/);
  });
});

describe("fitHistory", () => {
  const msgs = [{ role: "user", content: "a".repeat(4000) }, { role: "assistant", content: "b".repeat(400) }, { role: "user", content: "q" }];

  test("keeps the newest messages that fit and starts with a person's message", () => {
    expect(fitHistory(msgs, 200)).toEqual([{ role: "user", content: "q" }]);
    expect(fitHistory(msgs, 2000)).toHaveLength(3);
  });

  test("the new question is kept even when it alone is over budget", () => {
    expect(fitHistory([{ role: "user", content: "x".repeat(10000) }], 10)).toHaveLength(1);
  });
});

describe("runAssistant", () => {
  test("sends Sage's instructions, every tool and the fitted history", async () => {
    const stream = fakeStream([[{ text: "ok" }]]);
    expect(await runAssistant([{ role: "user", content: "hi" }], { onDelta: noop, onStatus: noop }, {}, { stream })).toBe("ok");
    const req = stream.requests[0];
    expect(req.system).toMatch(/^You are Sage/);
    expect(req.tools.map((t) => t.name)).toEqual(expect.arrayContaining(["dues", "customer_summary", "period_summary", "find", "read_guide", "run_query"]));
    expect(req.messages).toEqual([{ role: "user", content: "hi" }]);
  });
});
```

`backend/tests/assistantGuides.test.js`:

```js
"use strict";

const { loadGuides, parseGuide } = require("../src/assistant/guides");
const { buildSystemPrompt } = require("../src/assistant/prompt/buildSystemPrompt");
const { allTools } = require("../src/assistant/toolset");
const { estimateTokens } = require("../src/assistant/tokens");
const { CORE_BUDGET, GUIDE_BUDGET } = require("../src/assistant/config");

const guides = loadGuides();

describe("guides", () => {
  test("every guide names an area and a summary, and areas are unique", () => {
    expect(guides.length).toBeGreaterThanOrEqual(10);
    for (const g of guides) expect([g.area, g.summary].every(Boolean)).toBe(true);
    expect(new Set(guides.map((g) => g.area)).size).toBe(guides.length);
  });

  test.each(guides.map((g) => [g.file, g]))("%s fits the guide budget", (_, g) => {
    expect(estimateTokens(g.body)).toBeLessThanOrEqual(GUIDE_BUDGET);
  });

  test("links are app paths only", () => {
    for (const g of guides) for (const m of g.body.matchAll(/\]\(([^)]+)\)/g)) expect(m[1].startsWith("/")).toBe(true);
  });

  test("nothing mentions the old name or Hindi", () => {
    for (const g of guides) expect(g.body).not.toMatch(/jarvis|hindi|hinglish/i);
  });

  test("each tested SQL block is in exactly one guide", () => {
    for (const name of ["pending", "volume"]) expect(guides.filter((g) => g.body.includes(`<!-- canonical:${name} -->`))).toHaveLength(1);
  });

  test("a guide without front matter is refused", () => {
    expect(() => parseGuide("x.md", "# Title\nbody")).toThrow(/front matter/);
  });
});

describe("prompt budget", () => {
  test("core instructions plus every tool declaration fit the budget", () => {
    const system = buildSystemPrompt({ today: "2026-10-01" });
    const tools = JSON.stringify(allTools().map((t) => t.declaration));
    expect(estimateTokens(system) + estimateTokens(tools)).toBeLessThanOrEqual(CORE_BUDGET);
  });

  test("the prompt carries the name, today's date and every guide", () => {
    const system = buildSystemPrompt({ today: "2026-10-01" });
    expect(system).toContain("Today is 2026-10-01");
    for (const g of guides) expect(system).toContain(`- ${g.area}: ${g.summary}`);
    expect(system).not.toMatch(/\{\{/);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `cd backend && npm test -- tests/assistantAgent.test.js tests/assistantGuides.test.js`
Expected: FAIL — `Cannot find module '../src/assistant/agentLoop'`.

- [ ] **Step 3: Write guides loader, prompt and history**

`backend/src/assistant/guides.js`:

```js
"use strict";

const fs = require("fs");
const path = require("path");

const KNOWLEDGE_DIR = path.join(__dirname, "../../knowledge");

/**
 * A guide is a markdown file with front matter:
 *   ---
 *   area: payments
 *   summary: Recording, editing and refunding payments.
 *   tables: payments
 *   ---
 * The core prompt lists every area's summary; read_guide returns the body.
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
```

`backend/src/assistant/prompt/core.md` (exactly this text):

```markdown
You are {{name}}, the assistant inside YARS, the back-office app of a non-woven bags factory in India. Two people use it on their phones. Today is {{today}} (India). Be friendly, short and exact. Answer in English.

Money is rupees, written like ₹12,345.5. Every figure must come from a tool — never guess or work one out yourself.

Reading
- Who owes money: dues. One customer's position: customer_summary. Sales, collections, kg sold or expenses for a period: period_summary.
- Ids: find (customer by name or phone, size by label like 12 x 16, plates, a customer's orders).
- Anything else: read_guide for that area, then run_query.

Changing data
- You never save anything. A propose_ tool shows the person a card; they tap Confirm on it. Then tell them in one line what the card does and to tap Confirm. Never say it is saved or done.
- Use ids from find. If more than one record matches, list them and ask which. If a detail is missing (amount, size, quantity, rate), ask. Never invent a rate or price.
- A payment goes against one order. One order with money due: use it. Several: list them with their due and ask.
- You cannot delete anything. For a delete, or anything you can't do, say so and link the screen.

Links: markdown with app paths only, like [Orders](/orders). Paths are in the app guide. Short answers; a table only for more than 3 rows.

Guides (read_guide):
{{guides}}

Cards you can propose:
{{actions}}
```

`backend/src/assistant/prompt/buildSystemPrompt.js`:

```js
"use strict";

const fs = require("fs");
const path = require("path");
const { ASSISTANT_NAME } = require("../config");
const { guideIndex } = require("../guides");

const CORE = fs.readFileSync(path.join(__dirname, "core.md"), "utf8").trim();

/** The system prompt: core rules + one line per guide + one line per action. */
const buildSystemPrompt = ({ today, actions = [] } = {}) =>
  CORE.replaceAll("{{name}}", ASSISTANT_NAME)
    .replace("{{today}}", today)
    .replace("{{guides}}", guideIndex())
    .replace("{{actions}}", actions.length ? actions.map((a) => `- ${a.toolName}: ${a.summary}`).join("\n") : "- none yet");

module.exports = { buildSystemPrompt };
```

`backend/src/assistant/history.js`:

```js
"use strict";

const { estimateTokens } = require("./tokens");

/**
 * The newest messages that fit `budgetTokens`. The last message (the new
 * question) is always kept; the result starts with a person's message, as
 * every chat API expects.
 */
const fitHistory = (messages, budgetTokens) => {
  const out = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const cost = estimateTokens(messages[i].content);
    if (out.length && used + cost > budgetTokens) break;
    out.unshift({ role: messages[i].role, content: messages[i].content });
    used += cost;
  }
  while (out.length > 1 && out[0].role !== "user") out.shift();
  return out;
};

module.exports = { fitHistory };
```

- [ ] **Step 4: Rewrite the knowledge files as guides**

These are documentation files, not code. Each one is written from the existing files named below. The tests in Step 1 enforce these rules:
- front matter with `area`, `summary` and `tables`;
- a body of at most 3,200 characters (≈ 800 tokens);
- app-path links only;
- no "Jarvis" and no Hindi;
- canonical SQL blocks copied **verbatim**, each into exactly one guide.

Keep:
- exact button and field labels;
- the screen paths;
- the columns a SELECT needs.

Drop:
- history;
- repetition;
- anything about the old assistant.

| New file | Front matter (`area` / `summary` / `tables`) | Carry from |
|---|---|---|
| `customers.md` | `customers` / Adding, finding and editing customers / `customers` | `customers.md`; `schema.md` § customers |
| `orders.md` | `orders` / Creating, finding and editing orders, kg and pieces lines / `orders, order_product_sizes` | `orders.md` (finding, creating, order page, editing); `schema.md` § orders, § order_product_sizes |
| `catalog.md` | `catalog` / Sizes and plate types: rates, piece prices, weights / `product_sizes, plate_types` | `orders.md` (managing plate types, managing sizes); `schema.md` § plate_types, § product_sizes |
| `payments.md` | `payments` / Recording, editing and refunding payments; received and due / `payments` | `payments.md`; `schema.md` § payments |
| `money-sql.md` | `money_sql` / Rules and tested SQL for totals, received, pending and kg sold / `orders, order_product_sizes, payments` | `schema.md` § "Global quirks" (condensed) + the `canonical:pending` and `canonical:volume` blocks verbatim |
| `invoices.md` | `invoices` / Making invoices, GST, invoice status and dues / `invoices, invoice_items` | `invoices.md`; `schema.md` § invoices, § invoice_items |
| `dashboard.md` | `dashboard` / What each dashboard figure means and why screens can differ / (none) | `dashboard.md` |
| `expenses.md` | `expenses` / Adding and finding expenses and their categories / `expenses, expense_categories` | `expenses.md`; `schema.md` § expense_categories, § expenses |
| `history.md` | `history` / The History screen: who changed what, and when / `audit_logs` | `history.md`; `schema.md` § audit_logs. Add: "metadata.source is app (a screen) or assistant (confirmed on a Sage card)". |
| `stock.md` | `stock` / Stock on hand, FIFO batches, stock issues and wastage / `inventory_items, inventory_categories, stock_batches, stock_issues, stock_issue_items, stock_movements` | `inventory.md` (checking stock, issues, items, categories, attributes); `schema.md` inventory § items, batches, issues, movements |
| `purchasing.md` | `purchasing` / Suppliers, purchase orders and receiving material / `suppliers, purchase_orders, purchase_order_items, goods_receipts, goods_receipt_items` | `inventory.md` (POs, receiving, suppliers); `schema.md` inventory § suppliers, POs, receipts |
| `app.md` | `app` / Every screen's path, for links / (none) | `routes.md` (the table of paths; `/assistant` is "Sage — this assistant") |

Then delete the old files that have no new counterpart:

```bash
cd backend && git rm -q knowledge/00-instructions.md knowledge/schema.md knowledge/routes.md
```

In `backend/tests/knowledgeQueries.test.js`, replace the `schemaMd` / `canonical` lines at the top with:

```js
const { loadGuides } = require("../src/assistant/guides");

const guidesText = loadGuides().map((g) => g.body).join("\n");
const canonical = (name) => {
  const m = guidesText.match(new RegExp(`<!-- canonical:${name} -->([\\s\\S]*?)<!-- /canonical:${name} -->`));
  if (!m) throw new Error(`canonical:${name} block missing from the guides`);
  return m[1].trim();
};
```

and rename its `describe("Jarvis canonical queries match the app"` to `describe("the guides' tested SQL matches the app"`. Remove the now-unused `fs` and `path` requires if nothing else uses them.

- [ ] **Step 5: Write `read_guide`, the tool set, the agent loop and `runAssistant`**

`backend/src/assistant/tools/readGuide.js`:

```js
"use strict";

const { z } = require("zod");
const { defineTool } = require("./defineTool");
const { loadGuides } = require("../guides");

const guides = loadGuides();

module.exports = defineTool({
  name: "read_guide",
  description: "The guide for one area of the app: screens, labels, links and its tables. Read it before run_query.",
  input: z.object({ area: z.enum(guides.map((g) => g.area)) }),
  run: ({ area }) => guides.find((g) => g.area === area).body,
});
```

In `backend/src/assistant/tools/index.js`, add `require("./readGuide"),` to `READ_TOOLS` just before `require("./runQuery"),`.

`backend/src/assistant/toolset.js`:

```js
"use strict";

const { READ_TOOLS } = require("./tools");

/** Every tool the model gets. Action tools join in the action kit. */
const allTools = () => [...READ_TOOLS];

module.exports = { allTools };
```

`backend/src/assistant/agentLoop.js`:

```js
"use strict";

const { MAX_ROUNDS } = require("./config");

const STATUS = {
  dues: "Checking dues…",
  customer_summary: "Looking up the customer…",
  period_summary: "Adding up the period…",
  find: "Looking that up…",
  read_guide: "Reading the guide…",
  run_query: "Looking at the data…",
};
const statusFor = (name) => STATUS[name] || (String(name).startsWith("propose_") ? "Preparing a card…" : "Working…");

/**
 * Stream a model turn, run its tool calls, feed the results back, repeat.
 * Neutral messages: {role:'user', content} · {role:'assistant', content, toolCalls?} · {role:'tool', results}.
 * `executeTool(call)` resolves to { text, action? }; a card goes to onAction.
 */
const runAgent = async ({ system, history, tools, stream, executeTool, onDelta, onStatus, onAction = () => {}, maxRounds = MAX_ROUNDS }) => {
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  let finalText = "";

  for (let round = 0; round <= maxRounds; round += 1) {
    const allowTools = round < maxRounds;
    let roundText = "";
    const calls = [];
    for await (const chunk of stream({ system, messages, tools: allowTools ? tools : undefined })) {
      if (chunk.text) {
        roundText += chunk.text;
        onDelta(chunk.text);
      }
      if (chunk.toolCalls) calls.push(...chunk.toolCalls);
    }

    finalText += roundText; // text before a tool call is part of the answer
    if (calls.length === 0) return finalText || "I couldn't come up with an answer — please try rephrasing.";

    messages.push({ role: "assistant", content: roundText, toolCalls: calls });
    const results = [];
    for (const call of calls) {
      onStatus(statusFor(call.name));
      const out = await executeTool(call);
      if (out.action) onAction(out.action);
      results.push({ id: call.id, name: call.name, result: out.text });
    }
    messages.push({ role: "tool", results });
  }
  return finalText || "I couldn't finish that — please try rephrasing.";
};

module.exports = { runAgent };
```

`backend/src/assistant/index.js`:

```js
"use strict";

const { runAgent } = require("./agentLoop");
const { getChain } = require("./llm");
const { allTools } = require("./toolset");
const { executeTool } = require("./tools/executeTool");
const { buildSystemPrompt } = require("./prompt/buildSystemPrompt");
const { fitHistory } = require("./history");
const { HISTORY_BUDGET } = require("./config");
const { todayIST } = require("../services/dashboard/dateRanges");

/**
 * Answer one message. `history`: saved messages, oldest first, the new question
 * last. `ctx`: { conversationId, userId, requestText } — what a proposal records.
 * `deps` replaces the model stream, tools or prompt in tests.
 */
const runAssistant = async (history, { onDelta, onStatus, onAction }, ctx = {}, deps = {}) => {
  const tools = deps.tools || allTools();
  return runAgent({
    system: deps.system ?? buildSystemPrompt({ today: todayIST(), actions: deps.actions || [] }),
    history: fitHistory(history, HISTORY_BUDGET),
    tools: tools.map((t) => t.declaration),
    stream: deps.stream || ((request) => getChain().stream(request)),
    executeTool: (call) => executeTool(tools, call, ctx),
    onDelta,
    onStatus,
    onAction,
  });
};

module.exports = { runAssistant };
```

- [ ] **Step 6: Switch the chat to `runAssistant` and remove the old assistant**

In `backend/src/controllers/assistantController.js` replace the import line `const { runAgent, formatWait } = require("../services/assistant/assistantService");` with:

```js
const { runAssistant } = require("../assistant");
const { formatWait } = require("../assistant/chain");
const { ASSISTANT_NAME } = require("../assistant/config");
```

In `sendMessage`, replace the `try { finalText = await runAgent(history, {...}); } catch …` block with:

```js
    let finalText;
    try {
      finalText = await runAssistant(
        history,
        {
          onDelta: (t) => sendEvent(res, "delta", { text: t }),
          onStatus: (t) => sendEvent(res, "status", { text: t }),
        },
        { conversationId: id, userId: req.user?.sub || null, requestText: text }
      );
    } catch (err) {
      console.error("assistant failed:", err);
      const message =
        err.name === "QuotaExhaustedError"
          ? `${ASSISTANT_NAME}'s free daily limit is used up for now. Please try again in about ${formatWait(err.retryAfterSeconds)}.`
          : `${ASSISTANT_NAME} is busy right now — try again in a minute.`;
      sendEvent(res, "error", { message });
      return res.end();
    }
```

Then:

```bash
cd backend && git rm -q src/services/assistant/agentLoop.js src/services/assistant/assistantService.js src/services/assistant/knowledgeLoader.js tests/assistantService.test.js tests/knowledgeLoader.test.js
/usr/bin/grep -rn "services/assistant" src tests scripts
```

Expected: the grep prints nothing.

- [ ] **Step 7: Run the tests**

Run: `cd backend && npm test -- tests/assistantAgent.test.js tests/assistantGuides.test.js tests/knowledgeQueries.test.js tests/assistantTools.test.js tests/assistantController.test.js`
Expected: PASS.
- If a guide is over budget, shorten that guide.
- If the prompt budget fails, shorten tool descriptions first, then `core.md`.
- Raising `CORE_BUDGET` or `GUIDE_BUDGET` is a Ruling with the measured numbers. The budget comes from Groq's 8k tokens/minute.

- [ ] **Step 8: Whole suite, then commit**

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: every suite passes.

```bash
git add backend/src/assistant/guides.js backend/src/assistant/prompt/core.md backend/src/assistant/prompt/buildSystemPrompt.js backend/src/assistant/tools/readGuide.js backend/src/assistant/tools/index.js backend/src/assistant/toolset.js backend/src/assistant/history.js backend/src/assistant/agentLoop.js backend/src/assistant/index.js backend/src/controllers/assistantController.js backend/knowledge backend/tests/knowledgeQueries.test.js backend/tests/assistantAgent.test.js backend/tests/assistantGuides.test.js
git commit -m "feat(assistant): Sage answers from a small core prompt and guides read on demand

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: Action kit — propose with a trial run, confirm exactly once, cancel, open in form

**Files:**
- Create: `backend/src/migrations/20261001000001-create-assistant-actions.js`, `backend/src/models/assistantAction.js`, `backend/src/assistant/actionKit/errors.js`, `backend/src/assistant/actionKit/defineAction.js`, `backend/src/assistant/actionKit/actionService.js`, `backend/src/assistant/actionKit/actionTool.js`, `backend/src/assistant/actionKit/registry.js`, `backend/src/controllers/assistantActionController.js`
- Modify: `backend/src/models/assistantConversation.js` (hasMany actions), `backend/src/routes/assistantRoutes.js`, `backend/src/assistant/toolset.js`, `backend/src/assistant/index.js`, `backend/tests/setup.js` (`TABLES`)
- Test: `backend/tests/assistantActions.test.js`

**Interfaces:**
- Consumes: `runCommand`, `CommandError`, `NotFoundError` (Task 1); `parseArgs`, `toParameters` (Task 5); `ACTION_TTL_MINUTES` (Task 4).
- Produces:
  - **`defineAction(def)`:**
    - Required in `def`: `name`, `area`, `summary`, `description`, `input` (Zod), `trialRunSafe` (boolean), `evals` (array).
    - Required functions:
      - `resolve(args, { models, today }) → resolved` (throws `ActionError`).
      - `preview(resolved, { transaction, result, models }) → card`, where card is `{ title, rows: [{ label, value, before?, after? }], warnings: string[] }`.
      - `toCommandInput(resolved) → commandInput`, used with `command`.
      - `resultLink(result, payload) → path`.
      - `formLink(payload, actionId) → path`.
    - Optional: `fingerprint(payload, { models, transaction }) → JSON`, `context(resolved) → JSON`.
    - Adds `toolName` (`propose_<name>`) and `declaration`.
  - `ActionError(message)` with `expected = true`.
  - **`actionService`:**
    - `propose(action, args, { conversationId, userId, requestText }) → Presented`
    - `confirm(registry, id, { userId }) → Presented`
    - `cancel(id) → Presented`
    - `completedInForm(id, { resultId, saved }) → Presented`
    - `formData(id) → Presented & { payload, context }`
    - `present(row) → Presented`, `effectiveStatus(row)`, `changedKeys(before, after)`.
    - `Presented = { id, name, status, card, error, resultLink, formLink, expiresAt, messageId }`. `status` is one of `pending | confirmed | cancelled | expired | failed | completed_in_form`.
  - `actionTool(action) → Tool` (`run` returns `{ text, action: Presented }`).
  - `ACTIONS` (array) and `registry` (`Map` from name to action), from `actionKit/registry.js`. These load every file in `src/assistant/actions/`.
  - **HTTP:**
    - `GET /api/assistant/actions/:id`
    - `POST /api/assistant/actions/:id/confirm`
    - `POST /api/assistant/actions/:id/cancel`
    - `POST /api/assistant/actions/:id/completed-in-form` with body `{ result_id, saved }`.
    - Each answers `200 { data: Presented }`, or `404` for an unknown id.

- [ ] **Step 1: Write the migration and model**

`backend/src/migrations/20261001000001-create-assistant-actions.js`:

```js
"use strict";

/**
 * Cards Sage proposes. Purely additive: one new table, created in one
 * transaction so a failure leaves nothing behind.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "assistant_actions",
        {
          id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
          conversation_id: { type: Sequelize.UUID, allowNull: false, references: { model: "assistant_conversations", key: "id" }, onDelete: "CASCADE" },
          message_id: { type: Sequelize.UUID, allowNull: true, references: { model: "assistant_messages", key: "id" }, onDelete: "SET NULL" },
          user_id: { type: Sequelize.UUID, allowNull: true }, // who asked; no FK, so an old login can never block a card
          name: { type: Sequelize.TEXT, allowNull: false },
          request_text: { type: Sequelize.TEXT, allowNull: true },
          payload: { type: Sequelize.JSONB, allowNull: false },
          context: { type: Sequelize.JSONB, allowNull: true },
          card: { type: Sequelize.JSONB, allowNull: false },
          fingerprint: { type: Sequelize.JSONB, allowNull: true },
          status: { type: Sequelize.TEXT, allowNull: false, defaultValue: "pending" },
          result_id: { type: Sequelize.UUID, allowNull: true },
          result_link: { type: Sequelize.TEXT, allowNull: true },
          form_link: { type: Sequelize.TEXT, allowNull: true },
          error: { type: Sequelize.TEXT, allowNull: true },
          outcome: { type: Sequelize.JSONB, allowNull: true },
          expires_at: { type: Sequelize.DATE, allowNull: false },
          confirmed_at: { type: Sequelize.DATE, allowNull: true },
          created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
          updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        },
        { transaction }
      );
      await queryInterface.addIndex("assistant_actions", ["conversation_id", "created_at"], { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("assistant_actions");
  },
};
```

`backend/src/models/assistantAction.js`:

```js
"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

const STATUSES = ["pending", "confirmed", "cancelled", "expired", "failed", "completed_in_form"];

module.exports = (sequelize, DataTypes) => {
  class AssistantAction extends Model {
    static associate(models) {
      AssistantAction.belongsTo(models.AssistantConversation, { foreignKey: "conversation_id", as: "conversation" });
      AssistantAction.belongsTo(models.AssistantMessage, { foreignKey: "message_id", as: "message" });
    }
  }

  AssistantAction.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      conversation_id: { type: DataTypes.UUID, allowNull: false },
      message_id: { type: DataTypes.UUID, allowNull: true },
      user_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.TEXT, allowNull: false },
      request_text: { type: DataTypes.TEXT, allowNull: true },
      payload: { type: DataTypes.JSONB, allowNull: false },
      context: { type: DataTypes.JSONB, allowNull: true },
      card: { type: DataTypes.JSONB, allowNull: false },
      fingerprint: { type: DataTypes.JSONB, allowNull: true },
      status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "pending", validate: { isIn: [STATUSES] } },
      result_id: { type: DataTypes.UUID, allowNull: true },
      result_link: { type: DataTypes.TEXT, allowNull: true },
      form_link: { type: DataTypes.TEXT, allowNull: true },
      error: { type: DataTypes.TEXT, allowNull: true },
      outcome: { type: DataTypes.JSONB, allowNull: true },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      confirmed_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, modelName: "AssistantAction", tableName: "assistant_actions", timestamps: true, underscored: true }
  );

  return AssistantAction;
};
```

In `backend/src/models/assistantConversation.js`, inside `associate`, add after the `hasMany(models.AssistantMessage …)` call:

```js
      AssistantConversation.hasMany(models.AssistantAction, { foreignKey: "conversation_id", as: "actions" });
```

In `backend/tests/setup.js`, add `"assistant_actions",` to `TABLES` directly before `"assistant_messages",`.

Run: `cd backend && npm run test:migrate`
Expected: `== 20261001000001-create-assistant-actions: migrated`.

- [ ] **Step 2: Write the failing tests**

`backend/tests/assistantActions.test.js`:

```js
"use strict";

const { z } = require("zod");
const db = require("../src/models");
const { defineAction } = require("../src/assistant/actionKit/defineAction");
const { ActionError } = require("../src/assistant/actionKit/errors");
const service = require("../src/assistant/actionKit/actionService");
const { actionTool } = require("../src/assistant/actionKit/actionTool");
const createCustomerCommand = require("../src/commands/customers/createCustomer");

// A small action on top of a real command: add a customer by name.
const addShop = defineAction({
  name: "add_shop",
  area: "customers",
  summary: "Add a shop (test)",
  description: "Add a shop by name",
  input: z.object({ name: z.string() }),
  resolve: async ({ name }) => {
    if (name === "ask") throw new ActionError("Which shop do you mean?");
    return { name };
  },
  preview: async (resolved, { transaction, result, models }) => ({
    title: `New customer ${resolved.name}`,
    rows: [{ label: "Seen in trial", value: String(Boolean(await models.Customer.findByPk(result.id, { transaction }))) }],
    warnings: [],
  }),
  command: createCustomerCommand,
  toCommandInput: (r) => ({ name: r.name }),
  fingerprint: async (input, { models, transaction }) => ({ customers: await models.Customer.count({ transaction }) }),
  context: (r) => ({ asked: r.name }),
  resultLink: (result) => `/customers/${result.id}`,
  formLink: (input, id) => `/customers/new?assistant=${id}`,
  trialRunSafe: true,
  evals: [],
});
const registry = new Map([[addShop.name, addShop]]);

let conversationId;
beforeEach(async () => {
  conversationId = (await db.AssistantConversation.create({})).id;
});

const propose = (name) => service.propose(addShop, { name }, { conversationId, requestText: `add ${name}` });

describe("propose", () => {
  test("runs the real save, shows the card, and leaves the database as it was", async () => {
    const shown = await propose("Laxmi Stores");
    expect(shown).toMatchObject({ name: "add_shop", status: "pending", card: { title: "New customer Laxmi Stores", rows: [{ label: "Seen in trial", value: "true" }] } });
    expect(shown.formLink).toBe(`/customers/new?assistant=${shown.id}`);
    expect(await db.Customer.count()).toBe(0);
    const row = await db.AssistantAction.findByPk(shown.id);
    expect(row).toMatchObject({ payload: { name: "Laxmi Stores" }, context: { asked: "Laxmi Stores" }, fingerprint: { customers: 0 }, request_text: "add Laxmi Stores" });
  });

  test("a question back to the person stores nothing", async () => {
    await expect(propose("ask")).rejects.toThrow("Which shop do you mean?");
    expect(await db.AssistantAction.count()).toBe(0);
  });

  test("the app's own refusal is passed on", async () => {
    await expect(propose("")).rejects.toThrow("The app would refuse this: Customer name is required");
  });

  test("as a tool: the model reads a line, the app gets the card", async () => {
    const out = await actionTool(addShop).run({ name: "Om Traders" }, { conversationId });
    expect(out.text).toMatch(/^Card shown to the person: New customer Om Traders\. They must tap Confirm/);
    expect(out.action.status).toBe("pending");
    expect(actionTool(addShop).declaration).toMatchObject({ name: "propose_add_shop", parameters: { type: "object" } });
  });
});

describe("confirm", () => {
  test("saves once; a second tap returns the same result", async () => {
    const { id } = await propose("Kept");
    const first = await service.confirm(registry, id, {});
    const second = await service.confirm(registry, id, {});
    expect(first).toMatchObject({ status: "confirmed", resultLink: expect.stringMatching(/^\/customers\//) });
    expect(second).toEqual(first);
    expect(await db.Customer.count()).toBe(1);
  });

  test("concurrent confirms save once", async () => {
    const { id } = await propose("Twice");
    const [a, b] = await Promise.all([service.confirm(registry, id, {}), service.confirm(registry, id, {})]);
    expect([a.status, b.status]).toEqual(["confirmed", "confirmed"]);
    expect(await db.Customer.count()).toBe(1);
  });

  test("an expired card can't be confirmed", async () => {
    const { id } = await propose("Late");
    await db.AssistantAction.update({ expires_at: new Date(Date.now() - 1000) }, { where: { id } });
    expect((await service.confirm(registry, id, {})).status).toBe("expired");
    expect((await db.AssistantAction.findByPk(id)).status).toBe("expired");
    expect(await db.Customer.count()).toBe(0);
  });

  test("if what the card was based on changed, it refuses", async () => {
    const { id } = await propose("Stale");
    await db.Customer.create({ name: "Someone else" });
    const shown = await service.confirm(registry, id, {});
    expect(shown).toMatchObject({ status: "failed", error: "This changed after Sage suggested it — ask again." });
    expect(await db.Customer.count()).toBe(1);
  });

  test("a refusal at confirm marks the card failed and saves nothing", async () => {
    const { id } = await propose("Fine");
    await db.AssistantAction.update({ payload: { name: "" } }, { where: { id } });
    expect(await service.confirm(registry, id, {})).toMatchObject({ status: "failed", error: "Customer name is required" });
    expect(await db.Customer.count()).toBe(0);
  });

  test("an unknown card is a 404", async () => {
    await expect(service.confirm(registry, "00000000-0000-4000-8000-000000000000", {})).rejects.toMatchObject({ status: 404 });
  });
});

describe("cancel and open in form", () => {
  test("a cancelled card stays cancelled", async () => {
    const { id } = await propose("Nope");
    expect((await service.cancel(id)).status).toBe("cancelled");
    expect((await service.confirm(registry, id, {})).status).toBe("cancelled");
    expect(await db.Customer.count()).toBe(0);
  });

  test("the form gets the payload; finishing in the form records what changed", async () => {
    const { id } = await propose("Form Shop");
    expect(await service.formData(id)).toMatchObject({ payload: { name: "Form Shop" }, context: { asked: "Form Shop" } });
    const done = await service.completedInForm(id, { resultId: "11111111-1111-4111-8111-111111111111", saved: { name: "Form Shop Ltd", phone: "98765 43210" } });
    expect(done.status).toBe("completed_in_form");
    expect((await db.AssistantAction.findByPk(id)).outcome).toEqual({ changed: ["name", "phone"] });
  });

  test("changedKeys ignores number formatting", () => {
    expect(service.changedKeys({ amount: 5000, lines: [{ q: "10" }] }, { amount: "5000.00", lines: [{ q: 10 }] })).toEqual([]);
  });
});

describe("defineAction", () => {
  test("refuses an action missing a piece", () => {
    expect(() => defineAction({ name: "x" })).toThrow(/missing area/);
    expect(() => defineAction({ ...addShop, name: "y", trialRunSafe: undefined })).toThrow(/trialRunSafe/);
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `cd backend && npm test -- tests/assistantActions.test.js`
Expected: FAIL — `Cannot find module '../src/assistant/actionKit/defineAction'`.

- [ ] **Step 4: Write the action kit**

`backend/src/assistant/actionKit/errors.js`:

```js
"use strict";

/** Told to the model, which asks the person (e.g. "two customers match — which one?"). */
class ActionError extends Error {
  constructor(message) {
    super(message);
    this.expected = true;
  }
}

module.exports = { ActionError };
```

`backend/src/assistant/actionKit/defineAction.js`:

```js
"use strict";

const { toParameters } = require("../tools/defineTool");

const REQUIRED = ["name", "area", "summary", "description", "input", "resolve", "preview", "command", "toCommandInput", "resultLink", "formLink", "evals"];

/**
 * One thing Sage can propose. The file is the whole feature: what the model
 * may send (input), how ids become records (resolve), what the card shows
 * (preview), which command saves it, and the requests it must handle (evals).
 * trialRunSafe: true only when the command has no effect outside the database
 * transaction (no files, no external calls, no counters that don't roll back).
 */
const defineAction = (def) => {
  for (const key of REQUIRED) if (def[key] === undefined) throw new Error(`Action ${def.name || "?"}: missing ${key}`);
  if (!/^[a-z_]+$/.test(def.name)) throw new Error(`Action ${def.name}: name must be lower_snake_case`);
  if (typeof def.trialRunSafe !== "boolean") throw new Error(`Action ${def.name}: say trialRunSafe: true or false`);
  const toolName = `propose_${def.name}`;
  return Object.freeze({
    fingerprint: null,
    context: null,
    ...def,
    toolName,
    declaration: { name: toolName, description: def.description, parameters: toParameters(def.input) },
  });
};

module.exports = { defineAction };
```

`backend/src/assistant/actionKit/actionService.js`:

```js
"use strict";

const { isDeepStrictEqual } = require("util");
const { v4: uuidv4 } = require("uuid");
const db = require("../../models");
const { runCommand } = require("../../commands/runCommand");
const { CommandError, NotFoundError } = require("../../commands/errors");
const { todayIST } = require("../../services/dashboard/dateRanges");
const { parseArgs } = require("../tools/defineTool");
const { ACTION_TTL_MINUTES, ASSISTANT_NAME } = require("../config");
const { ActionError } = require("./errors");

const effectiveStatus = (row, now = new Date()) => (row.status === "pending" && new Date(row.expires_at) <= now ? "expired" : row.status);

/** What the app shows for one card. */
const present = (row) => ({
  id: row.id,
  name: row.name,
  status: effectiveStatus(row),
  card: row.card,
  error: row.error || null,
  resultLink: row.result_link || null,
  formLink: row.form_link || null,
  expiresAt: row.expires_at,
  messageId: row.message_id || null,
});

/** Numbers and numeric text compare equal ("5000.00" = 5000); empty = missing. */
const canon = (v) => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return /^-?\d+(\.\d+)?$/.test(v.trim()) ? String(Number(v)) : v.trim();
  if (Array.isArray(v)) return v.map(canon);
  if (typeof v === "object") {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]).filter(([, x]) => x !== null));
  }
  return v;
};
const changedKeys = (before = {}, after = {}) =>
  [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
    .filter((k) => !isDeepStrictEqual(canon(before?.[k]), canon(after?.[k])))
    .sort();

/** The real save in a transaction that is always rolled back; the card reads the after-figures inside it. */
const trialRun = async (action, resolved, input) => {
  if (!action.trialRunSafe) return action.preview(resolved, { transaction: null, result: null, models: db });
  const t = await db.sequelize.transaction();
  try {
    const result = await runCommand(action.command, input, { transaction: t, actor: { source: "assistant", trial: true } });
    return await action.preview(resolved, { transaction: t, result, models: db });
  } catch (err) {
    if (err instanceof CommandError) throw new ActionError(`The app would refuse this: ${err.message}`);
    throw err;
  } finally {
    await t.rollback();
  }
};

const propose = async (action, rawArgs, { conversationId, userId = null, requestText = null } = {}) => {
  const args = parseArgs(action.input, rawArgs);
  const resolved = await action.resolve(args, { models: db, today: todayIST() });
  const payload = action.toCommandInput(resolved);
  const card = await trialRun(action, resolved, payload);
  const id = uuidv4();
  const row = await db.AssistantAction.create({
    id,
    conversation_id: conversationId,
    user_id: userId,
    name: action.name,
    request_text: requestText,
    payload,
    context: action.context ? action.context(resolved) : null,
    card,
    fingerprint: action.fingerprint ? await action.fingerprint(payload, { models: db }) : null,
    status: "pending",
    form_link: action.formLink(payload, id),
    expires_at: new Date(Date.now() + ACTION_TTL_MINUTES * 60 * 1000),
  });
  return present(row);
};

const locked = async (id, t) => {
  const row = await db.AssistantAction.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
  if (!row) throw new NotFoundError("This card no longer exists");
  return row;
};

/**
 * Save what the card shows. The row is locked, so two taps (or two phones)
 * save once. Refuses when expired, when what it was based on changed, or when
 * the app refuses; nothing half-saves.
 */
const confirm = (registry, id, { userId = null } = {}) =>
  db.sequelize.transaction(async (t) => {
    const row = await locked(id, t);
    const status = effectiveStatus(row);
    if (status === "expired" && row.status === "pending") {
      await row.update({ status: "expired" }, { transaction: t });
      return present(row);
    }
    if (status !== "pending") return present(row);

    const action = registry.get(row.name);
    if (!action) {
      await row.update({ status: "failed", error: `${ASSISTANT_NAME} can't do this any more — use the screen.` }, { transaction: t });
      return present(row);
    }
    if (action.fingerprint) {
      const now = await action.fingerprint(row.payload, { models: db, transaction: t });
      if (!isDeepStrictEqual(now, row.fingerprint)) {
        await row.update({ status: "failed", error: action.staleMessage || `This changed after ${ASSISTANT_NAME} suggested it — ask again.` }, { transaction: t });
        return present(row);
      }
    }

    try {
      // A savepoint: if the save fails, the card can still be marked failed.
      const result = await db.sequelize.transaction({ transaction: t }, (sp) =>
        runCommand(action.command, row.payload, { transaction: sp, actor: { source: "assistant", userId, actionId: row.id } })
      );
      await row.update(
        { status: "confirmed", result_id: result.id, result_link: action.resultLink(result, row.payload), confirmed_at: new Date(), outcome: { confirmed: true } },
        { transaction: t }
      );
    } catch (err) {
      if (!(err instanceof CommandError)) throw err;
      await row.update({ status: "failed", error: err.message }, { transaction: t });
    }
    return present(row);
  });

const cancel = (id) =>
  db.sequelize.transaction(async (t) => {
    const row = await locked(id, t);
    if (effectiveStatus(row) === "pending") await row.update({ status: "cancelled", outcome: { cancelled: true } }, { transaction: t });
    return present(row);
  });

/** "Open in form" finished: record what the person changed (the learning report reads it). */
const completedInForm = (id, { resultId = null, saved = {} } = {}) =>
  db.sequelize.transaction(async (t) => {
    const row = await locked(id, t);
    if (["pending", "expired"].includes(effectiveStatus(row))) {
      await row.update({ status: "completed_in_form", result_id: resultId, outcome: { changed: changedKeys(row.payload, saved) } }, { transaction: t });
    }
    return present(row);
  });

const formData = async (id) => {
  const row = await db.AssistantAction.findByPk(id);
  if (!row) throw new NotFoundError("This card no longer exists");
  return { ...present(row), payload: row.payload, context: row.context };
};

module.exports = { propose, confirm, cancel, completedInForm, formData, present, effectiveStatus, changedKeys };
```

`backend/src/assistant/actionKit/actionTool.js`:

```js
"use strict";

const { propose } = require("./actionService");

/** An action as a tool the model calls: it reads one line, the app gets the card. */
const actionTool = (action) =>
  Object.freeze({
    name: action.toolName,
    description: action.description,
    input: action.input,
    declaration: action.declaration,
    run: async (args, ctx) => {
      const shown = await propose(action, args, ctx);
      return {
        text: `Card shown to the person: ${shown.card.title}. They must tap Confirm. Tell them in one line; do not say it is saved.`,
        action: shown,
      };
    },
  });

module.exports = { actionTool };
```

`backend/src/assistant/actionKit/registry.js`:

```js
"use strict";

const fs = require("fs");
const path = require("path");

const ACTIONS_DIR = path.join(__dirname, "../actions");

/** Every file in src/assistant/actions is an action. Adding a file adds the action. */
const loadActions = (dir = ACTIONS_DIR) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort().map((f) => require(path.join(dir, f))) : [];

const ACTIONS = loadActions();
const registry = new Map(ACTIONS.map((a) => [a.name, a]));

module.exports = { ACTIONS, registry, loadActions };
```

- [ ] **Step 5: Give the model the action tools; expose the endpoints**

`backend/src/assistant/toolset.js` becomes:

```js
"use strict";

const { READ_TOOLS } = require("./tools");
const { ACTIONS } = require("./actionKit/registry");
const { actionTool } = require("./actionKit/actionTool");

/** Every tool the model gets: read tools, then one propose_ tool per action. */
const allTools = () => [...READ_TOOLS, ...ACTIONS.map(actionTool)];

module.exports = { allTools };
```

In `backend/src/assistant/index.js` add `const { ACTIONS } = require("./actionKit/registry");` and change the prompt line to:

```js
    system: deps.system ?? buildSystemPrompt({ today: todayIST(), actions: deps.actions || ACTIONS }),
```

`backend/src/controllers/assistantActionController.js`:

```js
"use strict";

const { success, error } = require("../utils/response");
const { CommandError } = require("../commands/errors");
const service = require("../assistant/actionKit/actionService");
const { registry } = require("../assistant/actionKit/registry");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const handle = (fn, failMessage) => async (req, res) => {
  if (!UUID.test(req.params.id)) return error(res, 404, "This card no longer exists");
  try {
    return success(res, 200, "Card", await fn(req));
  } catch (err) {
    if (err instanceof CommandError) return error(res, err.status, err.message);
    console.error(`${failMessage}:`, err);
    return error(res, 500, failMessage);
  }
};

const getAction = handle((req) => service.formData(req.params.id), "Couldn't load this card");
const confirmAction = handle((req) => service.confirm(registry, req.params.id, { userId: req.user?.sub || null }), "Couldn't save this — try again");
const cancelAction = handle((req) => service.cancel(req.params.id), "Couldn't cancel this card");
const completedInForm = handle(
  (req) => service.completedInForm(req.params.id, { resultId: req.body?.result_id || null, saved: req.body?.saved || {} }),
  "Couldn't record that"
);

module.exports = { getAction, confirmAction, cancelAction, completedInForm };
```

In `backend/src/routes/assistantRoutes.js` add:

```js
const a = require("../controllers/assistantActionController");

router.get("/actions/:id", a.getAction);
router.post("/actions/:id/confirm", a.confirmAction);
router.post("/actions/:id/cancel", a.cancelAction);
router.post("/actions/:id/completed-in-form", a.completedInForm);
```

- [ ] **Step 6: Run the tests**

Run: `cd backend && npm test -- tests/assistantActions.test.js tests/assistantAgent.test.js tests/assistantGuides.test.js`
Expected: PASS.

- [ ] **Step 7: Whole suite, then commit**

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: every suite passes.

```bash
git add backend/src/migrations/20261001000001-create-assistant-actions.js backend/src/models/assistantAction.js backend/src/models/assistantConversation.js backend/src/assistant/actionKit/errors.js backend/src/assistant/actionKit/defineAction.js backend/src/assistant/actionKit/actionService.js backend/src/assistant/actionKit/actionTool.js backend/src/assistant/actionKit/registry.js backend/src/assistant/toolset.js backend/src/assistant/index.js backend/src/controllers/assistantActionController.js backend/src/routes/assistantRoutes.js backend/tests/setup.js backend/tests/assistantActions.test.js
git commit -m "feat(assistant): cards — trial run before showing, confirm saves exactly once, refuses when stale or expired

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 8: The four phase-1 actions, and the guards that keep Sage complete

**Files:**
- Create: `backend/src/services/paymentType.js`, `backend/src/services/phone.js`, `backend/src/assistant/actionKit/orderView.js`, `backend/src/assistant/actions/record_payment.js`, `backend/src/assistant/actions/create_customer.js`, `backend/src/assistant/actions/create_order.js`, `backend/src/assistant/actions/set_order_status.js`, `backend/src/assistant/screenOnly.js`
- Test: `backend/tests/paymentTypePhone.test.js`, `backend/tests/assistantPhase1.test.js`, `backend/tests/assistantContract.test.js`

**Interfaces:**
- Consumes: `defineAction`, `ActionError`, `propose`, `confirm`, `registry`, `ACTIONS` (Task 7); `recordId`, `isoDate`, `money` (Task 5); commands (Tasks 2–3); `loadOrders` with `{ transaction }` (Task 1).
- Produces:
  - `paymentTypeFor(amount, due)`, `overpayment(amount, due)`: the same rules as `frontend/src/utils/paymentType.js`.
  - `toIndianMobile`, `mobileDigits`, `mobileStatus`: the same rules as `frontend/src/utils/phone.js`.
  - `orderView(models, id, transaction?) → { order, row, label, counted } | null`. `row` is `toOrderRow`, so it carries `total`, `received`, `due` and `customer`.
  - **Actions:**
    - `record_payment`: `{ order_id, amount, method?, date?, reference?, notes?, refund? }`.
    - `create_customer`: `{ name, phone?, city?, email?, address?, gstin? }`.
    - `create_order`: `{ customer_id, plate_type_id, lines: [{ size_id, unit: KG|PIECES, quantity, rate_per_kg?, price?, price_per? }], order_date?, advance?, custom_plate_charge? }`.
    - `set_order_status`: `{ order_id, status }`.
  - **Payloads and context:**
    - Payloads are the command inputs.
    - `context.customer = { id, name, phone }`, for "Open in form".
    - `create_order` payload lines always carry an explicit `rate_per_kg` (KG) or `price_amount` + `price_pieces_count` (PIECES).
  - `SCREEN_ONLY`: `{ "METHOD /path": reason }`.
  - **Eval case shape (used in Task 12):** `{ ask, expect }`, where `expect` is one of:
    - `{ action, args?, refs? }`: `args` is a subset match; `refs` maps an argument path to a fixture record name.
    - `{ asks: true }`
    - `{ noAction: true, mentions }`

- [ ] **Step 1: Write the failing tests**

`backend/tests/paymentTypePhone.test.js`:

```js
"use strict";

const { paymentTypeFor, overpayment } = require("../src/services/paymentType");
const { toIndianMobile, mobileDigits, mobileStatus } = require("../src/services/phone");

// The same cases as frontend/src/utils/paymentType.test.js and mobile/dashboardHelpers tests.
describe("payment type follows the amount (same as the payment sheet)", () => {
  test("paying the whole due is final, less is part", () => {
    expect([paymentTypeFor(1000, 1000), paymentTypeFor(999.99, 1000), paymentTypeFor(500, 0)]).toEqual(["FINAL", "PARTIAL", "FINAL"]);
  });
  test("overpayment in exact paise", () => {
    expect([overpayment(1200, 1000), overpayment(900, 1000), overpayment(0.3, 0.1)]).toEqual([200, 0, 0.2]);
  });
});

describe("mobile numbers (same as the customer form)", () => {
  test("strips +91, a leading 0 and spaces", () => {
    expect([mobileDigits("+91 98765 43210"), mobileDigits("098765-43210")]).toEqual(["9876543210", "9876543210"]);
  });
  test("status", () => {
    expect(["", "98765", "5876543210", "98765 43210", "08217 453398"].map(mobileStatus)).toEqual(["empty", "invalid", "invalid", "valid", "invalid"]);
  });
  test("landlines and short numbers are not mobiles", () => {
    for (const raw of [null, "", "08482-234567", "12345", "5876543210", "0987654321"]) expect(toIndianMobile(raw)).toBeNull();
    expect(toIndianMobile("919876543210")).toBe("9876543210");
  });
});
```

`backend/tests/assistantPhase1.test.js`:

```js
"use strict";

const db = require("../src/models");
const service = require("../src/assistant/actionKit/actionService");
const { registry } = require("../src/assistant/actionKit/registry");
const { createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const action = (name) => registry.get(name);
let conversationId;
let bombay;
let plate;
let kgSize;
let pcsSize;
let order;

beforeEach(async () => {
  conversationId = (await db.AssistantConversation.create({})).id;
  bombay = await db.Customer.create({ name: "Bombay Saree Centre", metadata: { phone: "9876500003" } });
  plate = await createPlateType("1500.00");
  kgSize = await createSize({ size_label: "12 x 16", rate_per_kg: "180.00" });
  pcsSize = await createSize({ size_label: "14 x 18", rate_per_kg: "0.00", piece_price_amount: "375", piece_price_count: 1000 });
  order = await createOrderWithLines({
    customer: bombay, plateType: plate, order_date: "2026-09-12",
    lines: [{ product_size_id: kgSize.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "180.00" }],
  });
  await db.Payment.create({ order_id: order.id, customer_id: bombay.id, amount: "1000.00", payment_type: "PARTIAL", payment_date: "2026-09-13" });
});

const propose = (name, args) => service.propose(action(name), args, { conversationId });
const row = (card, label) => card.rows.find((r) => r.label === label);

describe("record_payment", () => {
  test("card shows the due before and after; confirm saves it as the sheet would", async () => {
    const shown = await propose("record_payment", { order_id: order.id, amount: 2000, method: "UPI", date: "2026-10-01" });
    expect(shown.card.title).toBe("Record payment ₹2,000");
    expect(row(shown.card, "Due")).toEqual({ label: "Due", value: "₹300", before: "₹2,300", after: "₹300" });
    expect(row(shown.card, "Type").value).toBe("Part payment");
    expect(shown.formLink).toBe(`/orders/${order.id}?pay=assistant:${shown.id}`);

    const done = await service.confirm(registry, shown.id, {});
    expect(done).toMatchObject({ status: "confirmed", resultLink: `/orders/${order.id}` });
    const pay = await db.Payment.findOne({ where: { order_id: order.id, payment_method: "UPI" } });
    expect([Number(pay.amount), pay.payment_type, pay.payment_date]).toEqual([2000, "PARTIAL", "2026-10-01"]);
    const log = await db.AuditLog.findOne({ where: { entity_type: "PAYMENT", entity_id: pay.id } });
    expect(log.metadata).toMatchObject({ source: "assistant", assistant_action_id: shown.id });
  });

  test("paying more than the due warns, exactly like the sheet", async () => {
    const shown = await propose("record_payment", { order_id: order.id, amount: 2500 });
    expect(shown.card.warnings).toEqual(["That's ₹200 more than the due. It will show as extra received."]);
    expect(row(shown.card, "Type").value).toBe("Final payment");
  });

  test("record_payment refuses after another payment", async () => {
    const shown = await propose("record_payment", { order_id: order.id, amount: 500 });
    await db.Payment.create({ order_id: order.id, customer_id: bombay.id, amount: "100.00", payment_type: "PARTIAL", payment_date: "2026-10-01" });
    const done = await service.confirm(registry, shown.id, {});
    expect(done.status).toBe("failed");
    expect(done.error).toMatch(/changed/);
  });

  test("a refund above what was received is refused by the app's own rule", async () => {
    await expect(propose("record_payment", { order_id: order.id, amount: 1500, refund: true })).rejects.toThrow("The app would refuse this: A refund can't be more than received (₹1,000)");
  });

  test("a cancelled order takes no payments", async () => {
    await order.update({ status: "CANCELLED" });
    await expect(propose("record_payment", { order_id: order.id, amount: 100 })).rejects.toThrow(/cancelled/);
  });
});

describe("create_customer", () => {
  test("stores the mobile the way the form does and warns about look-alikes", async () => {
    const shown = await propose("create_customer", { name: "Bombay Saree Centre", phone: "+91 98450 12345", city: "Hubli" });
    expect(row(shown.card, "Phone").value).toBe("9845012345");
    expect(shown.card.warnings).toEqual(["Looks like an existing customer: Bombay Saree Centre (9876500003)"]);
    const done = await service.confirm(registry, shown.id, {});
    const saved = await db.Customer.findByPk(done.resultLink.split("/").pop());
    expect(saved.metadata).toEqual({ phone: "9845012345", city: "Hubli" });
  });

  test("a bad GSTIN is refused with the form's message", async () => {
    await expect(propose("create_customer", { name: "X Shop", gstin: "123" })).rejects.toThrow("GSTIN should be 15 characters, like 29ABCDE1234F1Z5");
  });
});

describe("create_order", () => {
  test("uses the size's saved rate, shows the app's total, and saves the lines", async () => {
    const shown = await propose("create_order", {
      customer_id: bombay.id, plate_type_id: plate.id, order_date: "2026-10-01",
      lines: [{ size_id: kgSize.id, unit: "KG", quantity: 20 }, { size_id: pcsSize.id, unit: "PIECES", quantity: 4000 }],
    });
    // 20 × 180 + 4000 × 375/1000 + plate 1500
    expect(row(shown.card, "Total").value).toBe("₹6,600");
    expect(row(shown.card, "12 x 16").value).toBe("20 kg × ₹180 = ₹3,600");
    expect(row(shown.card, "14 x 18").value).toBe("4000 pcs at ₹375 per 1000 = ₹1,500");
    expect(shown.formLink).toBe(`/orders/new?assistant=${shown.id}`);
    const payload = (await service.formData(shown.id)).payload;
    expect(payload.product_sizes[0]).toEqual({ product_size_id: kgSize.id, unit: "KG", quantity_kg: 20, rate_per_kg: 180 });

    const done = await service.confirm(registry, shown.id, {});
    const id = done.resultLink.split("/").pop();
    expect(await db.OrderProductSize.count({ where: { order_id: id } })).toBe(2);
    const log = await db.AuditLog.findOne({ where: { entity_type: "ORDER", entity_id: id } });
    expect(log.metadata.source).toBe("assistant");
  });

  test("never invents a rate: a size without one makes Sage ask", async () => {
    await expect(propose("create_order", { customer_id: bombay.id, plate_type_id: plate.id, lines: [{ size_id: pcsSize.id, unit: "KG", quantity: 5 }] }))
      .rejects.toThrow("Line 1: 14 x 18 has no rate per kg saved — ask the person for the rate.");
  });

  test("a piece price needs both the amount and the number of pieces", async () => {
    await expect(propose("create_order", { customer_id: bombay.id, plate_type_id: plate.id, lines: [{ size_id: pcsSize.id, unit: "PIECES", quantity: 1000, price: 400 }] }))
      .rejects.toThrow(/like ₹375 for 1000 pcs/);
  });

  test("an advance shows as received", async () => {
    const shown = await propose("create_order", { customer_id: bombay.id, plate_type_id: plate.id, advance: 600, lines: [{ size_id: kgSize.id, unit: "KG", quantity: 10 }] });
    expect([row(shown.card, "Advance").value, row(shown.card, "Due").value]).toEqual(["₹600", "₹2,700"]);
  });
});

describe("set_order_status", () => {
  test("marks delivered through the screen's own update", async () => {
    const shown = await propose("set_order_status", { order_id: order.id, status: "DELIVERED" });
    expect(row(shown.card, "Status")).toMatchObject({ before: "Pending", after: "Delivered" });
    await service.confirm(registry, shown.id, {});
    expect((await order.reload()).status).toBe("DELIVERED");
  });

  test("cancelling says it leaves totals and dues", async () => {
    const shown = await propose("set_order_status", { order_id: order.id, status: "CANCELLED" });
    expect(shown.card.title).toBe("Cancel order");
    expect(row(shown.card, "Due in totals")).toMatchObject({ before: "₹2,300", after: "not counted (cancelled)" });
  });

  test("same status, or a cancelled order going anywhere but Pending, is refused", async () => {
    await expect(propose("set_order_status", { order_id: order.id, status: "PENDING" })).rejects.toThrow("That order is already Pending.");
    await order.update({ status: "CANCELLED" });
    await expect(propose("set_order_status", { order_id: order.id, status: "DELIVERED" })).rejects.toThrow(/only be restored/);
  });
});
```

`backend/tests/assistantContract.test.js`:

```js
"use strict";

const fs = require("fs");
const path = require("path");
const { ACTIONS } = require("../src/assistant/actionKit/registry");
const { loadGuides } = require("../src/assistant/guides");
const { COMMANDS } = require("../src/commands");
const { SCREEN_ONLY } = require("../src/assistant/screenOnly");

/** Every POST/PUT/PATCH/DELETE the API serves, as "METHOD /path". */
const writeRoutes = () => {
  const index = fs.readFileSync(path.join(__dirname, "../src/routes/index.js"), "utf8");
  const files = Object.fromEntries([...index.matchAll(/const (\w+) = require\("\.\/(\w+)"\)/g)].map((m) => [m[1], m[2]]));
  const out = [];
  for (const [, prefix, name] of index.matchAll(/router\.use\("([^"]+)", (\w+)\)/g)) {
    if (!files[name]) continue;
    const router = require(path.join(__dirname, "../src/routes", files[name]));
    for (const layer of router.stack) {
      if (!layer.route) continue;
      for (const method of Object.keys(layer.route.methods)) {
        if (["post", "put", "patch", "delete"].includes(method)) out.push(`${method.toUpperCase()} ${prefix}${layer.route.path === "/" ? "" : layer.route.path}`);
      }
    }
  }
  return out;
};

describe("every action is complete", () => {
  const areas = new Set(loadGuides().map((g) => g.area));

  test("phase 1 is all there", () => {
    expect(ACTIONS.map((a) => a.name).sort()).toEqual(["create_customer", "create_order", "record_payment", "set_order_status"]);
  });

  test.each(ACTIONS.map((a) => [a.name, a]))("%s has a guide, a command, a trial-run decision and at least 3 evals", (_, a) => {
    expect(areas.has(a.area)).toBe(true);
    expect(COMMANDS).toContain(a.command);
    expect(typeof a.trialRunSafe).toBe("boolean");
    expect(a.evals.length).toBeGreaterThanOrEqual(3);
    for (const e of a.evals) expect(typeof e.ask === "string" && e.expect && typeof e.expect === "object").toBe(true);
    expect(a.declaration.parameters).toMatchObject({ type: "object" });
  });
});

describe("every write endpoint is accounted for", () => {
  const routes = writeRoutes();
  const viaSage = new Set(ACTIONS.map((a) => a.command.route));

  test("each is either behind a command Sage uses or listed as screen only, with a reason", () => {
    expect(routes.filter((r) => !viaSage.has(r) && !SCREEN_ONLY[r])).toEqual([]);
    for (const [route, reason] of Object.entries(SCREEN_ONLY)) expect([route, reason.length > 5]).toEqual([route, true]);
  });

  test("the screen-only list has no stale or double entries", () => {
    expect(Object.keys(SCREEN_ONLY).filter((r) => !routes.includes(r))).toEqual([]);
    expect(Object.keys(SCREEN_ONLY).filter((r) => viaSage.has(r))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `cd backend && npm test -- tests/paymentTypePhone.test.js tests/assistantPhase1.test.js tests/assistantContract.test.js`
Expected: FAIL. The services and actions don't exist yet, and the contract test finds no actions.

- [ ] **Step 3: Port the payment-type and phone rules**

`backend/src/services/paymentType.js`:

```js
"use strict";

/** Same rule as the payment sheet (frontend/src/utils/paymentType.js): the whole due is final, less is a part payment. */
const paymentTypeFor = (amount, due) => (Number(amount) >= Number(due) ? "FINAL" : "PARTIAL");

/** How much more than the due is being paid, exact to the paisa. */
const overpayment = (amount, due) => Math.max(0, Math.round(Number(amount) * 100) - Math.round(Number(due) * 100)) / 100;

module.exports = { paymentTypeFor, overpayment };
```

`backend/src/services/phone.js`:

```js
"use strict";

/** Same rules as frontend/src/utils/phone.js. Stored numbers are never changed; links use a normalised copy. */
const toIndianMobile = (raw) => {
  if (!raw) return null;
  // "08482-234567" is a landline (0 + STD code + number); after dropping the 0
  // it would look like a mobile, so treat that written form as not-a-mobile.
  if (/^\s*0\d{2,4}[-\s]\d/.test(String(raw))) return null;
  let d = String(raw).replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
};

const mobileDigits = (typed) => toIndianMobile(typed) || String(typed || "").replace(/\D/g, "");

const mobileStatus = (typed) => {
  if (!String(typed || "").replace(/\D/g, "")) return "empty";
  return toIndianMobile(typed) ? "valid" : "invalid";
};

module.exports = { toIndianMobile, mobileDigits, mobileStatus };
```

- [ ] **Step 4: Write the order view helper**

`backend/src/assistant/actionKit/orderView.js`:

```js
"use strict";

const { loadOrders } = require("../../services/dashboard/ledger");
const { toOrderRow } = require("../../services/lists/orderList");
const { isCounted } = require("../../services/orderFacts");
const { dayText, itemsText } = require("../format");

/** One live order as the screens show it (total / received / due from orderFacts), optionally inside a transaction. */
const orderView = async (models, id, transaction) => {
  const [order] = await loadOrders(models, { id, is_archived: false }, { transaction });
  if (!order) return null;
  const row = toOrderRow(order);
  return { order, row, label: `${dayText(row.orderDate)} · ${itemsText(row.items)}`, counted: isCounted(order) };
};

module.exports = { orderView };
```

- [ ] **Step 5: Write the four actions**

`backend/src/assistant/actions/record_payment.js`:

```js
"use strict";

const { z } = require("zod");
const { defineAction } = require("../actionKit/defineAction");
const { ActionError } = require("../actionKit/errors");
const { orderView } = require("../actionKit/orderView");
const { recordId, isoDate, money } = require("../tools/fields");
const { paymentTypeFor, overpayment } = require("../../services/paymentType");
const { rupee, dayText, METHOD_LABEL, PAYMENT_TYPE_LABEL } = require("../format");
const { ASSISTANT_NAME } = require("../config");
const command = require("../../commands/payments/createPayment");
const { PAYMENT_METHODS } = require("../../commands/payments/constants");

module.exports = defineAction({
  name: "record_payment",
  area: "payments",
  summary: "money received (or refunded) on one order",
  description: "Card to record money received on one order; refund true for money given back. order_id from find kind order. method defaults to CASH, date to today.",
  input: z.object({
    order_id: recordId(),
    amount: money(),
    method: z.enum(PAYMENT_METHODS).optional(),
    date: isoDate().optional(),
    reference: z.string().optional(),
    notes: z.string().optional(),
    refund: z.boolean().optional(),
  }),
  trialRunSafe: true,
  command,
  resolve: async (args, { models, today }) => {
    const view = await orderView(models, args.order_id);
    if (!view) throw new ActionError("No live order has that id. Use find with kind order.");
    if (!view.counted) throw new ActionError("That order is cancelled, so it takes no payments. Restore it on the order page first.");
    const refund = Boolean(args.refund);
    return {
      view,
      refund,
      amount: args.amount,
      type: refund ? "REFUND" : paymentTypeFor(args.amount, view.row.due),
      overpay: refund ? 0 : overpayment(args.amount, view.row.due),
      method: args.method || "CASH",
      date: args.date || today,
      reference: args.reference || null,
      notes: args.notes || null,
    };
  },
  toCommandInput: (r) => ({
    order_id: r.view.order.id,
    amount: r.amount,
    payment_type: r.type,
    payment_method: r.method,
    payment_date: r.date,
    reference_number: r.reference,
    notes: r.notes,
  }),
  preview: async (r, { models, transaction }) => {
    const after = await orderView(models, r.view.order.id, transaction);
    return {
      title: `${r.refund ? "Record refund" : "Record payment"} ${rupee(r.amount)}`,
      rows: [
        { label: "Customer", value: r.view.row.customer.name },
        { label: "Order", value: r.view.label },
        { label: "Type", value: PAYMENT_TYPE_LABEL[r.type] },
        { label: "Method", value: METHOD_LABEL[r.method] },
        { label: "Date", value: dayText(r.date) },
        ...(r.reference ? [{ label: "Reference", value: r.reference }] : []),
        ...(r.notes ? [{ label: "Notes", value: r.notes }] : []),
        { label: "Due", value: rupee(after.row.due), before: rupee(r.view.row.due), after: rupee(after.row.due) },
      ],
      warnings: r.overpay > 0 ? [`That's ${rupee(r.overpay)} more than the due. It will show as extra received.`] : [],
    };
  },
  context: (r) => ({ customer: r.view.row.customer, refund: r.refund }),
  // Another payment, an edit or a status change since the card was made changes the due it showed.
  fingerprint: async (payload, { models, transaction }) => {
    const view = await orderView(models, payload.order_id, transaction);
    const order = await models.Order.findByPk(payload.order_id, { attributes: ["updated_at", "status"], transaction });
    return view && order ? { received: view.row.received, status: order.status, updated: new Date(order.updated_at).toISOString() } : null;
  },
  staleMessage: `This order changed after ${ASSISTANT_NAME} suggested the payment (another payment or an edit) — ask again.`,
  resultLink: (result, payload) => `/orders/${payload.order_id}`,
  formLink: (payload, id) => `/orders/${payload.order_id}?pay=assistant:${id}`,
  evals: [
    { ask: "Bombay Saree Centre paid 5000 by UPI", expect: { action: "record_payment", args: { amount: 5000, method: "UPI" }, refs: { order_id: "bombayOrder" } } },
    { ask: "Sharma Traders paid 2000", expect: { asks: true } },
    { ask: "Sharma Traders from Surat paid 2000 cash", expect: { asks: true } },
    { ask: "Refund 500 to Bombay Saree Centre in cash", expect: { action: "record_payment", args: { amount: 500, refund: true }, refs: { order_id: "bombayOrder" } } },
  ],
});
```

`backend/src/assistant/actions/create_customer.js`:

```js
"use strict";

const { z } = require("zod");
const { defineAction } = require("../actionKit/defineAction");
const { findSimilar } = require("../../services/customerSimilar");
const { mobileStatus, mobileDigits } = require("../../services/phone");
const command = require("../../commands/customers/createCustomer");

const FIELDS = [["name", "Name"], ["phone", "Phone"], ["city", "City"], ["email", "Email"], ["address", "Address"], ["gstin", "GSTIN"]];

module.exports = defineAction({
  name: "create_customer",
  area: "customers",
  summary: "a new customer",
  description: "Card to add a customer. Only name is required.",
  input: z.object({
    name: z.string().min(1),
    phone: z.string().optional(),
    city: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    gstin: z.string().optional(),
  }),
  trialRunSafe: true,
  command,
  resolve: async (args, { models }) => {
    // The same clean-up as the customer form (toCustomerPayload).
    const fields = { name: args.name.trim() };
    if (args.phone) fields.phone = mobileStatus(args.phone) === "valid" ? mobileDigits(args.phone) : args.phone.trim();
    for (const key of ["city", "email", "address"]) if (args[key]?.trim()) fields[key] = args[key].trim();
    if (args.gstin?.trim()) fields.gstin = args.gstin.trim().toUpperCase();
    const all = (await models.Customer.findAll({ where: { is_archived: false }, attributes: ["id", "name", "metadata"] })).map((c) => c.toJSON());
    return { fields, similar: findSimilar(fields.name, all, null, 3) };
  },
  toCommandInput: (r) => r.fields,
  preview: async (r) => ({
    title: `New customer ${r.fields.name}`,
    rows: FIELDS.filter(([key]) => r.fields[key]).map(([key, label]) => ({ label, value: r.fields[key] })),
    warnings: r.similar.map((c) => `Looks like an existing customer: ${c.name}${c.metadata?.phone ? ` (${c.metadata.phone})` : ""}`),
  }),
  resultLink: (result) => `/customers/${result.id}`,
  formLink: (payload, id) => `/customers/new?assistant=${id}`,
  evals: [
    { ask: "Add a new customer Ganesh Textiles, phone 98450 12345, in Hubli", expect: { action: "create_customer", args: { name: "Ganesh Textiles", city: "Hubli" } } },
    { ask: "Add customer Laxmi Stores", expect: { action: "create_customer", args: { name: "Laxmi Stores" } } },
    { ask: "Add a customer", expect: { asks: true } },
  ],
});
```

`backend/src/assistant/actions/create_order.js`:

```js
"use strict";

const { z } = require("zod");
const { defineAction } = require("../actionKit/defineAction");
const { ActionError } = require("../actionKit/errors");
const { orderView } = require("../actionKit/orderView");
const { recordId, isoDate, money } = require("../tools/fields");
const { lineAmount } = require("../../services/orderMath");
const { rupee, dayText } = require("../format");
const command = require("../../commands/orders/createOrder");

const count = () => z.preprocess((v) => (typeof v === "string" ? Number(v.replace(/[,\s]/g, "")) : v), z.number().positive());

const lineText = (l) =>
  l.unit === "PIECES"
    ? `${l.quantity_pieces} pcs at ${rupee(l.price_amount)} per ${l.price_pieces_count} = ${rupee(lineAmount(l))}`
    : `${Number(l.quantity_kg)} kg × ${rupee(l.rate_per_kg)} = ${rupee(lineAmount(l))}`;

module.exports = defineAction({
  name: "create_order",
  area: "orders",
  summary: "a new order with kg or pieces lines",
  description:
    "Card for a new order. Ids from find. Each line: size_id, unit KG or PIECES, quantity (kg or pcs). rate_per_kg or price + price_per (e.g. 375 per 1000 pcs) only when the person gives one; otherwise the size's saved price is used.",
  input: z.object({
    customer_id: recordId(),
    plate_type_id: recordId(),
    lines: z.array(z.object({
      size_id: recordId(),
      unit: z.enum(["KG", "PIECES"]),
      quantity: count(),
      rate_per_kg: money().optional(),
      price: money().optional(),
      price_per: count().optional(),
    })).min(1),
    order_date: isoDate().optional(),
    advance: money().optional(),
    custom_plate_charge: money().optional(),
  }),
  trialRunSafe: true,
  command,
  resolve: async (args, { models, today }) => {
    const customer = await models.Customer.findOne({ where: { id: args.customer_id, is_archived: false } });
    if (!customer) throw new ActionError("No customer has that id. Use find with kind customer.");
    const plate = await models.PlateType.findOne({ where: { id: args.plate_type_id, is_archived: false } });
    if (!plate) throw new ActionError("No plate type has that id. Use find with kind plate.");

    const lines = [];
    for (const [i, l] of args.lines.entries()) {
      const n = `Line ${i + 1}`;
      const size = await models.ProductSize.findOne({ where: { id: l.size_id, is_archived: false } });
      if (!size) throw new ActionError(`${n}: no size has that id. Use find with kind size.`);
      if (l.unit === "KG") {
        // A saved ₹0 rate means "no rate saved", as on the order form.
        const rate = l.rate_per_kg ?? (Number(size.rate_per_kg) > 0 ? Number(size.rate_per_kg) : null);
        if (rate === null) throw new ActionError(`${n}: ${size.size_label} has no rate per kg saved — ask the person for the rate.`);
        lines.push({ product_size_id: size.id, unit: "KG", quantity_kg: l.quantity, rate_per_kg: rate });
        continue;
      }
      if (!Number.isInteger(l.quantity)) throw new ActionError(`${n}: pieces must be a whole number.`);
      let price;
      if (l.price !== undefined || l.price_per !== undefined) {
        if (l.price === undefined || l.price_per === undefined) throw new ActionError(`${n}: give the piece price as an amount for a number of pieces, like ₹375 for 1000 pcs.`);
        price = { price_amount: l.price, price_pieces_count: l.price_per };
      } else if (size.piece_price_amount != null) {
        price = { price_amount: Number(size.piece_price_amount), price_pieces_count: size.piece_price_count };
      } else {
        throw new ActionError(`${n}: ${size.size_label} has no piece price saved — ask the person for the price.`);
      }
      lines.push({ product_size_id: size.id, unit: "PIECES", quantity_pieces: l.quantity, ...price });
    }

    return {
      customer: { id: customer.id, name: customer.name, phone: customer.metadata?.phone || null },
      plate,
      lines,
      date: args.order_date || today,
      advance: args.advance || 0,
      customPlateCharge: args.custom_plate_charge ?? null,
    };
  },
  // Every field the order form sends, defaults included, so "open in form, save unchanged" compares equal.
  toCommandInput: (r) => ({
    customer_id: r.customer.id,
    plate_type_id: r.plate.id,
    order_date: r.date,
    status: "PENDING",
    round_off_amount: 0,
    advance_received: r.advance,
    custom_plate_charge: r.customPlateCharge,
    product_sizes: r.lines,
  }),
  preview: async (r, { models, transaction, result }) => {
    const view = await orderView(models, result.id, transaction);
    const saved = view.order.orderProductSizes || [];
    return {
      title: `New order for ${r.customer.name}`,
      rows: [
        { label: "Customer", value: r.customer.name },
        { label: "Date", value: dayText(r.date) },
        { label: "Plate", value: `${r.plate.type_name} · ${rupee(r.customPlateCharge ?? r.plate.charge)}` },
        ...saved.map((l) => ({ label: l.productSize?.size_label || "Size", value: lineText(l) })),
        { label: "Total", value: rupee(view.row.total) },
        ...(r.advance ? [{ label: "Advance", value: rupee(r.advance) }] : []),
        { label: "Due", value: rupee(view.row.due) },
      ],
      warnings: view.row.due < 0 ? [`That's ${rupee(-view.row.due)} more than the total. It will show as extra received.`] : [],
    };
  },
  context: (r) => ({ customer: r.customer }),
  resultLink: (result) => `/orders/${result.id}`,
  formLink: (payload, id) => `/orders/new?assistant=${id}`,
  evals: [
    {
      ask: "New order for Bombay Saree Centre: 20 kg of 12 x 16, single colour plate",
      expect: { action: "create_order", args: { lines: [{ unit: "KG", quantity: 20 }] }, refs: { customer_id: "bombay", plate_type_id: "single", "lines.0.size_id": "size1216" } },
    },
    {
      ask: "Order for Laxmi Stores: 5000 pcs of 14 x 18 at 400 per 1000, two colour plate",
      expect: { action: "create_order", args: { lines: [{ unit: "PIECES", quantity: 5000, price: 400, price_per: 1000 }] }, refs: { customer_id: "laxmi", plate_type_id: "double", "lines.0.size_id": "size1418" } },
    },
    { ask: "Order for Laxmi Stores, 10 kg of 14 x 18, single colour plate", expect: { asks: true } },
  ],
});
```

`backend/src/assistant/actions/set_order_status.js`:

```js
"use strict";

const { z } = require("zod");
const { defineAction } = require("../actionKit/defineAction");
const { ActionError } = require("../actionKit/errors");
const { orderView } = require("../actionKit/orderView");
const { recordId } = require("../tools/fields");
const { rupee, ORDER_STATUS_LABEL } = require("../format");
const { ORDER_STATUSES } = require("../../commands/orders/schema");
const command = require("../../commands/orders/updateOrder");

const inTotals = (v) => (v.counted ? rupee(v.row.due) : "not counted (cancelled)");

module.exports = defineAction({
  name: "set_order_status",
  area: "orders",
  summary: "change an order's status (Pending, In progress, Completed, Delivered, Cancelled)",
  description: "Card to change one order's status. order_id from find kind order. A cancelled order can only go back to PENDING.",
  input: z.object({ order_id: recordId(), status: z.enum(ORDER_STATUSES) }),
  trialRunSafe: true,
  command,
  resolve: async ({ order_id, status }, { models }) => {
    const view = await orderView(models, order_id);
    if (!view) throw new ActionError("No live order has that id. Use find with kind order.");
    const from = view.order.status;
    if (from === status) throw new ActionError(`That order is already ${ORDER_STATUS_LABEL[status]}.`);
    if (from === "CANCELLED" && status !== "PENDING") throw new ActionError("A cancelled order can only be restored (to Pending) first.");
    return { view, from, to: status };
  },
  toCommandInput: (r) => ({ id: r.view.order.id, status: r.to }),
  preview: async (r, { models, transaction }) => {
    const after = await orderView(models, r.view.order.id, transaction);
    const touchesTotals = r.to === "CANCELLED" || r.from === "CANCELLED";
    return {
      title: r.to === "CANCELLED" ? "Cancel order" : r.from === "CANCELLED" ? "Restore order" : `Mark order ${ORDER_STATUS_LABEL[r.to]}`,
      rows: [
        { label: "Customer", value: r.view.row.customer.name },
        { label: "Order", value: r.view.label },
        { label: "Status", value: ORDER_STATUS_LABEL[r.to], before: ORDER_STATUS_LABEL[r.from], after: ORDER_STATUS_LABEL[r.to] },
        ...(touchesTotals ? [{ label: "Due in totals", value: inTotals(after), before: inTotals(r.view), after: inTotals(after) }] : []),
      ],
      warnings: r.to === "CANCELLED" ? ["A cancelled order is left out of totals and dues."] : [],
    };
  },
  context: (r) => ({ customer: r.view.row.customer }),
  fingerprint: async (payload, { models, transaction }) => {
    const order = await models.Order.findByPk(payload.id, { attributes: ["status", "updated_at"], transaction });
    return order ? { status: order.status, updated: new Date(order.updated_at).toISOString() } : null;
  },
  resultLink: (result) => `/orders/${result.id}`,
  formLink: (payload) => `/orders/${payload.id}`,
  evals: [
    { ask: "Mark Bombay Saree Centre's order as delivered", expect: { action: "set_order_status", args: { status: "DELIVERED" }, refs: { order_id: "bombayOrder" } } },
    { ask: "Cancel Sharma Traders Surat's order from 20 September", expect: { action: "set_order_status", args: { status: "CANCELLED" }, refs: { order_id: "suratOrderB" } } },
    { ask: "Delete Bombay Saree Centre's order", expect: { noAction: true, mentions: "/orders" } },
  ],
});
```

- [ ] **Step 6: List the write endpoints Sage leaves to the screens**

`backend/src/assistant/screenOnly.js`:

```js
"use strict";

/**
 * Write endpoints Sage does not cover, each with the reason. A new write
 * endpoint fails the contract test until it is either given an action or
 * listed here — so a new feature is never silently missing from Sage.
 */
const NEVER = "Sage never deletes; it links to the screen";
const P2 = (what) => `Phase 2: ${what}`;
const P3 = (what) => `Phase 3: ${what}`;

const SCREEN_ONLY = {
  "POST /auth/login": "Signing in",
  "PUT /customers/:id": P2("edit a customer"),
  "DELETE /customers/:id": NEVER,
  "POST /product-sizes": P3("catalog"),
  "PUT /product-sizes/:id": P3("catalog"),
  "DELETE /product-sizes/:id": NEVER,
  "POST /plate-types": P3("catalog"),
  "PUT /plate-types/:id": P3("catalog"),
  "DELETE /plate-types/:id": NEVER,
  "DELETE /orders/:id": NEVER,
  "POST /expense-categories": P3("expense categories"),
  "PUT /expense-categories/:id": P3("expense categories"),
  "DELETE /expense-categories/:id": NEVER,
  "POST /expenses": P2("expenses"),
  "PUT /expenses/:id": P2("expenses"),
  "DELETE /expenses/:id": NEVER,
  "POST /invoices/generate": P2("invoices"),
  "PATCH /invoices/:id/status": P2("invoices"),
  "DELETE /invoices/:id": NEVER,
  "PUT /payments/:id": P2("edit a payment"),
  "DELETE /payments/:id": NEVER,
  "POST /inventory-categories": P3("item categories"),
  "PUT /inventory-categories/:id": P3("item categories"),
  "DELETE /inventory-categories/:id": NEVER,
  "PUT /item-attributes/values/:valueId": P3("item details"),
  "DELETE /item-attributes/values/:valueId": NEVER,
  "POST /item-attributes/:id/values": P3("item details"),
  "POST /item-attributes": P3("item details"),
  "PUT /item-attributes/:id": P3("item details"),
  "DELETE /item-attributes/:id": NEVER,
  "POST /suppliers": P3("suppliers"),
  "PUT /suppliers/:id": P3("suppliers"),
  "DELETE /suppliers/:id": NEVER,
  "POST /inventory-items": P3("items"),
  "PUT /inventory-items/:id": P3("items"),
  "DELETE /inventory-items/:id": NEVER,
  "POST /purchase-orders": P3("purchase orders"),
  "PUT /purchase-orders/:id": P3("purchase orders"),
  "DELETE /purchase-orders/:id": NEVER,
  "POST /purchase-orders/:id/cancel": P3("purchase orders"),
  "POST /purchase-orders/:id/receive": P2("receiving material"),
  "POST /goods-receipts": P2("receiving material"),
  "POST /stock-issues": P2("stock issues"),
  "POST /assistant/conversations": "The chat itself",
  "DELETE /assistant/conversations/:id": "The chat itself",
  "POST /assistant/conversations/:id/messages": "The chat itself",
  "POST /assistant/actions/:id/confirm": "The card's own buttons",
  "POST /assistant/actions/:id/cancel": "The card's own buttons",
  "POST /assistant/actions/:id/completed-in-form": "The card's own buttons",
};

module.exports = { SCREEN_ONLY };
```

- [ ] **Step 7: Run the tests**

Run: `cd backend && npm test -- tests/paymentTypePhone.test.js tests/assistantPhase1.test.js tests/assistantContract.test.js tests/assistantGuides.test.js`
Expected: PASS, including the prompt budget, which now counts the four `propose_` tools. If the budget fails, shorten action `description`s first, then `summary`s. Each must still say what the action needs.

- [ ] **Step 8: Whole suite, then commit**

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: every suite passes.

```bash
git add backend/src/services/paymentType.js backend/src/services/phone.js backend/src/assistant/actionKit/orderView.js backend/src/assistant/actions/record_payment.js backend/src/assistant/actions/create_customer.js backend/src/assistant/actions/create_order.js backend/src/assistant/actions/set_order_status.js backend/src/assistant/screenOnly.js backend/tests/paymentTypePhone.test.js backend/tests/assistantPhase1.test.js backend/tests/assistantContract.test.js
git commit -m "feat(assistant): Sage can propose payments, customers, orders and status changes; a new write endpoint fails the suite until Sage covers it or it is listed screen-only

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: The chat sends cards, links them to the reply, and shows them again later

**Files:**
- Modify: `backend/src/controllers/assistantController.js` (`getConversation`, `sendMessage`), `backend/src/assistant/history.js` (add `withCards`)
- Test: `backend/tests/assistantChat.test.js`; existing `backend/tests/assistantController.test.js` stays green unchanged.

**Interfaces:**
- Consumes: `runAssistant` (Task 6, with `onAction`); `present`, `propose` (Task 7); `registry` (Task 8 actions).
- Produces:
  - **SSE from `POST /assistant/conversations/:id/messages`:**
    - `delta {text}`, `status {text}`
    - `action {Presented}` (new)
    - `error {message}`
    - `done {messageId, conversationId, title?}`
  - **`GET /assistant/conversations/:id`:** returns the conversation with `messages` and with `actions: Presented[]` (oldest first). Each action carries `messageId`, the reply it belongs to (or null).
  - `withCards(messages, actions) → messages`: each assistant message gets one line per card, `[card: <title> — <status>]`. That way the model knows what was proposed and what happened to it.

- [ ] **Step 1: Write the failing tests**

`backend/tests/assistantChat.test.js`:

```js
"use strict";

jest.mock("../src/assistant", () => ({ runAssistant: jest.fn() }));

const db = require("../src/models");
const { runAssistant } = require("../src/assistant");
const { sendMessage, getConversation } = require("../src/controllers/assistantController");
const service = require("../src/assistant/actionKit/actionService");
const { registry } = require("../src/assistant/actionKit/registry");

const sseRes = () => {
  const res = {
    events: [],
    headersSent: false,
    writableEnded: false,
    set: jest.fn(),
    flushHeaders() { res.headersSent = true; },
    write(chunk) {
      const m = chunk.match(/^event: (\w+)\ndata: (.*)\n\n$/s);
      res.events.push({ event: m[1], data: JSON.parse(m[2]) });
    },
    end() { res.writableEnded = true; },
  };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const jsonRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const send = async (id, text) => {
  const res = sseRes();
  await sendMessage({ params: { id }, body: { text }, user: { sub: null } }, res);
  return res.events;
};
const open = async (id) => {
  const res = jsonRes();
  await getConversation({ params: { id } }, res);
  return res.json.mock.calls[0][0].data;
};

let convId;
beforeEach(async () => {
  runAssistant.mockReset();
  convId = (await db.AssistantConversation.create({})).id;
});

const proposingAnswer = () =>
  runAssistant.mockImplementation(async (history, { onDelta, onAction }, ctx) => {
    onAction(await service.propose(registry.get("create_customer"), { name: "Om Traders" }, ctx));
    onDelta("Tap Confirm to add Om Traders.");
    return "Tap Confirm to add Om Traders.";
  });

describe("chat with cards", () => {
  test("a card made while answering is sent and tied to the saved reply", async () => {
    proposingAnswer();
    const events = await send(convId, "add Om Traders");
    const action = events.find((e) => e.event === "action").data;
    expect(action).toMatchObject({ status: "pending", card: { title: "New customer Om Traders" } });
    const done = events.find((e) => e.event === "done").data;
    expect((await db.AssistantAction.findByPk(action.id)).message_id).toBe(done.messageId);
    expect(runAssistant.mock.calls[0][2]).toMatchObject({ conversationId: convId, requestText: "add Om Traders" });
  });

  test("the model sees earlier cards and what happened to them", async () => {
    proposingAnswer();
    await send(convId, "add Om Traders");
    runAssistant.mockReset();
    runAssistant.mockResolvedValue("Okay.");
    await send(convId, "did that work?");
    const history = runAssistant.mock.calls[0][0];
    expect(history[1]).toEqual({ role: "assistant", content: "Tap Confirm to add Om Traders.\n[card: New customer Om Traders — pending]" });
    expect(history[2]).toEqual({ role: "user", content: "did that work?" });
  });

  test("reopened conversation shows expired cards", async () => {
    proposingAnswer();
    await send(convId, "add Om Traders");
    await db.AssistantAction.update({ expires_at: new Date(Date.now() - 1000) }, { where: { conversation_id: convId } });
    const conv = await open(convId);
    expect(conv.actions).toHaveLength(1);
    expect(conv.actions[0]).toMatchObject({ status: "expired", messageId: conv.messages[1].id });
    expect((await service.confirm(registry, conv.actions[0].id, {})).status).toBe("expired");
  });

  test("old conversations open without actions", async () => {
    await db.AssistantMessage.create({ conversation_id: convId, role: "user", content: "kitna baaki hai?" });
    await db.AssistantMessage.create({ conversation_id: convId, role: "assistant", content: "₹10 is due." });
    const conv = await open(convId);
    expect([conv.messages.length, conv.actions]).toEqual([2, []]);
    runAssistant.mockResolvedValue("Still ₹10.");
    const events = await send(convId, "and now?");
    expect(events.map((e) => e.event)).toEqual(["done"]);
  });

  test("when every model is resting, the message names Sage and the wait", async () => {
    runAssistant.mockRejectedValue(Object.assign(new Error("rest"), { name: "QuotaExhaustedError", retryAfterSeconds: 600 }));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const events = await send(convId, "dues?");
    expect(events).toEqual([{ event: "error", data: { message: "Sage's free daily limit is used up for now. Please try again in about 10 minutes." } }]);
    console.error.mockRestore();
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `cd backend && npm test -- tests/assistantChat.test.js`
Expected: FAIL. No `action` event is sent, `conv.actions` is undefined, and the history has no card lines.

- [ ] **Step 3: Add `withCards`**

Append to `backend/src/assistant/history.js` (before `module.exports`) and export it:

```js
/** Each assistant message gets one line per card it showed, so the model knows what was proposed and what happened. */
const withCards = (messages, actions) =>
  messages.map((m) => {
    const cards = actions.filter((a) => a.messageId === m.id);
    const content = cards.length ? `${m.content}\n${cards.map((a) => `[card: ${a.card.title} — ${a.status}]`).join("\n")}` : m.content;
    return { role: m.role, content };
  });
```

and change the export line to `module.exports = { fitHistory, withCards };`.

- [ ] **Step 4: Update the controller**

In `backend/src/controllers/assistantController.js`:

Change the models import to `const { AssistantConversation, AssistantMessage, AssistantAction } = require("../models");` and add:

```js
const { present } = require("../assistant/actionKit/actionService");
const { withCards } = require("../assistant/history");

const actionsOf = async (conversationId) =>
  (await AssistantAction.findAll({ where: { conversation_id: conversationId }, order: [["created_at", "ASC"]] })).map(present);
```

Replace `getConversation`'s success line `return success(res, 200, "Conversation", conv);` with:

```js
    return success(res, 200, "Conversation", { ...conv.toJSON(), actions: await actionsOf(conv.id) });
```

In `sendMessage`, replace the block that builds `history` with:

```js
    const saved = await AssistantMessage.findAll({ where: { conversation_id: id }, order: [["created_at", "ASC"]] });
    const history = withCards(saved, await actionsOf(id));
    const shownActions = [];
```

and the `runAssistant(...)` call's callbacks with:

```js
        {
          onDelta: (t) => sendEvent(res, "delta", { text: t }),
          onStatus: (t) => sendEvent(res, "status", { text: t }),
          onAction: (a) => {
            shownActions.push(a.id);
            sendEvent(res, "action", a);
          },
        },
```

The reply's save line is `const saved = await AssistantMessage.create(…)`. Rename that variable to `reply`, which avoids a clash with `saved` above, and right after it add:

```js
    if (shownActions.length) await AssistantAction.update({ message_id: reply.id }, { where: { id: shownActions } });
```

Then change `sendEvent(res, "done", { messageId: saved.id, … })` to use `reply.id`.

- [ ] **Step 5: Run the tests**

Run: `cd backend && npm test -- tests/assistantChat.test.js tests/assistantController.test.js`
Expected: PASS.

- [ ] **Step 6: Whole suite, then commit**

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: every suite passes.

```bash
git add backend/src/controllers/assistantController.js backend/src/assistant/history.js backend/tests/assistantChat.test.js
git commit -m "feat(assistant): cards stream into the chat, belong to their reply, and show their current state when reopened

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 10: The app — Sage's name, cards in the chat, "via Sage" in History

**Files:**
- Create: `frontend/src/app/assistant.js`, `frontend/src/features/assistant/actionCard.js`, `frontend/src/features/assistant/actionCard.test.js`, `frontend/src/features/assistant/ActionCard.jsx`
- Modify: `frontend/src/services/assistantAPI.js`, `frontend/src/features/assistant/AssistantPage.jsx` (whole file below), `frontend/src/app/routeMeta.js:20`, `frontend/src/app/navItems.js:28`, `frontend/src/components/layout/MainLayout.jsx:34-37`, `frontend/src/assets/styles/index.css:86-128`, `frontend/src/features/history/describeAudit.js`, `frontend/src/features/history/describeAudit.test.js`, `frontend/src/features/history/HistoryPage.jsx`
- Test: `frontend/src/features/assistant/actionCard.test.js`, `frontend/src/features/history/describeAudit.test.js`

**Interfaces:**
- Consumes: the Task 7 and Task 9 endpoints, and the `Presented` shape `{ id, name, status, card: { title, rows, warnings }, error, resultLink, formLink, expiresAt, messageId }`.
- Produces:
  - `ASSISTANT_NAME` from `src/app/assistant.js`.
  - **From `actionCard.js`:**
    - `cardState(action, now?) → { status, canAct, canOpenForm, note, tone }`
    - `attachActions(messages, actions) → messages`, each message with `actions[]`.
    - `replaceAction(messages, updated) → messages`
    - `keysAfter(name) → queryKey[]`
  - `assistantAPI.getAction(id)`, `.confirmAction(id)`, `.cancelAction(id)`, `.completedInForm(id, body)`.
  - `streamMessage(..., { onAction })`.
  - `describeAudit(row)` adds `via: "Sage"` when `metadata.source === "assistant"`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/features/assistant/actionCard.test.js`:

```js
import { describe, expect, test } from "vitest";
import { cardState, attachActions, replaceAction, keysAfter } from "./actionCard";

const NOW = Date.parse("2026-10-01T10:00:00Z");
const card = (o) => ({ id: "a1", name: "record_payment", status: "pending", card: { title: "t", rows: [], warnings: [] }, error: null, formLink: "/orders/o1?pay=assistant:a1", resultLink: null, expiresAt: "2026-10-01T10:10:00Z", messageId: "m2", ...o });

describe("cardState", () => {
  test("pending: can confirm, can open the form, says when it expires", () => {
    expect(cardState(card(), NOW)).toEqual({ status: "pending", canAct: true, canOpenForm: true, note: "Expires in 10 min", tone: "info" });
  });
  test("a pending card past its time is expired: no Confirm, but the form still opens", () => {
    expect(cardState(card({ expiresAt: "2026-10-01T09:59:00Z" }), NOW)).toMatchObject({ status: "expired", canAct: false, canOpenForm: true, note: "Expired — ask again" });
  });
  test("confirmed, cancelled, failed", () => {
    expect(cardState(card({ status: "confirmed", resultLink: "/orders/o1" }), NOW)).toMatchObject({ canAct: false, canOpenForm: false, note: "Saved", tone: "good" });
    expect(cardState(card({ status: "cancelled" }), NOW)).toMatchObject({ canAct: false, note: "Cancelled — ask again if you need it" });
    expect(cardState(card({ status: "failed", error: "This order changed" }), NOW)).toMatchObject({ canAct: false, note: "This order changed", tone: "critical" });
  });
});

describe("placing cards", () => {
  const messages = [{ id: "m1", role: "user", content: "q" }, { id: "m2", role: "assistant", content: "a" }];

  test("each card sits under the reply it came with", () => {
    expect(attachActions(messages, [card()])[1].actions.map((a) => a.id)).toEqual(["a1"]);
  });
  test("a card with no reply goes under the last reply, or a reply of its own", () => {
    expect(attachActions(messages, [card({ messageId: null })])[1].actions).toHaveLength(1);
    expect(attachActions([messages[0]], [card({ messageId: null })])).toEqual([{ ...messages[0], actions: [] }, { role: "assistant", content: "", actions: [card({ messageId: null })] }]);
  });
  test("an updated card replaces the old one in place", () => {
    const placed = attachActions(messages, [card()]);
    expect(replaceAction(placed, card({ status: "confirmed" }))[1].actions[0].status).toBe("confirmed");
  });
  test("a confirmed card refreshes the money screens", () => {
    expect(keysAfter("record_payment")).toEqual([["orders"], ["customers"], ["invoices"]]);
    expect(keysAfter("anything_new")).toEqual([["orders"], ["customers"], ["invoices"]]);
  });
});
```

Append to `frontend/src/features/history/describeAudit.test.js`:

```js
describe("describeAudit — who made it", () => {
  test("a change confirmed on a Sage card says so", () => {
    const d = describeAudit(row({ entity_type: "ORDER", action: "UPDATE", metadata: { source: "assistant", customer_name: "A", previous_status: "PENDING", new_status: "DELIVERED" } }));
    expect(d.via).toBe("Sage");
  });
  test("a change from a screen doesn't", () => {
    expect(describeAudit(row({ entity_type: "ORDER", action: "UPDATE", metadata: { source: "app", previous_status: "PENDING", new_status: "DELIVERED" } })).via).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `cd frontend && npx vitest run src/features/assistant/actionCard.test.js src/features/history/describeAudit.test.js`
Expected: FAIL — `Failed to resolve import "./actionCard"`; `d.via` is undefined.

- [ ] **Step 3: Write the name and the card logic**

`frontend/src/app/assistant.js`:

```js
/** The assistant's display name — the only place the app writes it. */
export const ASSISTANT_NAME = "Sage";
```

`frontend/src/features/assistant/actionCard.js`:

```js
import { keys } from "../../lib/queryKeys";

const NOTE = {
  confirmed: "Saved",
  cancelled: "Cancelled — ask again if you need it",
  expired: "Expired — ask again",
  completed_in_form: "Finished in the form",
};
const TONE = { pending: "info", confirmed: "good", cancelled: "muted", expired: "muted", failed: "critical", completed_in_form: "good" };

/** What a card shows and allows, from the server's state (a pending card past its time counts as expired). */
export const cardState = (action, now = Date.now()) => {
  const left = new Date(action.expiresAt).getTime() - now;
  const status = action.status === "pending" && left <= 0 ? "expired" : action.status;
  return {
    status,
    canAct: status === "pending",
    canOpenForm: (status === "pending" || status === "expired") && Boolean(action.formLink),
    note: status === "pending" ? `Expires in ${Math.max(1, Math.ceil(left / 60000))} min` : status === "failed" ? action.error || "Couldn't save — ask again" : NOTE[status],
    tone: TONE[status] || "muted",
  };
};

/** Put each card under the reply it came with; a card with no reply goes under the last reply. */
export const attachActions = (messages, actions) => {
  const out = messages.map((m) => ({ ...m, actions: actions.filter((a) => a.messageId && a.messageId === m.id) }));
  const placed = new Set(out.flatMap((m) => m.actions.map((a) => a.id)));
  const loose = actions.filter((a) => !placed.has(a.id));
  if (!loose.length) return out;
  const lastReply = [...out].reverse().find((m) => m.role === "assistant");
  if (lastReply) lastReply.actions = [...lastReply.actions, ...loose];
  else out.push({ role: "assistant", content: "", actions: loose });
  return out;
};

export const replaceAction = (messages, updated) =>
  messages.map((m) => (m.actions?.some((a) => a.id === updated.id) ? { ...m, actions: m.actions.map((a) => (a.id === updated.id ? updated : a)) } : m));

const MONEY = [keys.orders.all, keys.customers.all, keys.invoices.all];
const AFTER = { record_payment: MONEY, create_order: MONEY, set_order_status: MONEY, create_customer: MONEY };

/** Cached screens to refresh after a card is saved. Unknown (newer) actions refresh the money screens. */
export const keysAfter = (name) => AFTER[name] || MONEY;
```

- [ ] **Step 4: Rename Jarvis to Sage everywhere it shows**

- `frontend/src/app/routeMeta.js:20`: `[/^\/assistant/, { title: "Jarvis" }],` → `[/^\/assistant/, { title: ASSISTANT_NAME }],`, and add `import { ASSISTANT_NAME } from "./assistant";` at the top.
- `frontend/src/app/navItems.js:28`: `label: "Jarvis"` → `label: ASSISTANT_NAME`, with the same import.
- `frontend/src/components/layout/MainLayout.jsx`:
  - `aria-label="Ask Jarvis"` → ``aria-label={`Ask ${ASSISTANT_NAME}`}``
  - `jarvis-ring` → `assistant-ring`
  - `jarvis-wiggle` → `assistant-wiggle`
  - add `import { ASSISTANT_NAME } from "../../app/assistant";`
- `frontend/src/assets/styles/index.css` lines 86–128:
  - `jarvisRing`/`jarvisWiggle`/`jarvisFloat` → `assistantRing`/`assistantWiggle`/`assistantFloat`
  - `.jarvis-ring`/`.jarvis-wiggle`/`.jarvis-float` → `.assistant-ring`/`.assistant-wiggle`/`.assistant-float`
  - the comments `Jarvis:` → `Assistant:`

Run: `cd frontend && /usr/bin/grep -rni "jarvis" src`
Expected: matches only in `AssistantPage.jsx`, which Step 6 replaces.

- [ ] **Step 5: Card API, stream event, and the card component**

In `frontend/src/services/assistantAPI.js` add to `assistantAPI`:

```js
  getAction: (id) => client.get(`/assistant/actions/${id}`),
  confirmAction: (id) => client.post(`/assistant/actions/${id}/confirm`),
  cancelAction: (id) => client.post(`/assistant/actions/${id}/cancel`),
  completedInForm: (id, body) => client.post(`/assistant/actions/${id}/completed-in-form`, body),
```

and in `streamMessage`:
- change the handler list to `{ onDelta, onStatus, onAction, onDone, onError }`;
- add `else if (event === "action") onAction?.(payload);` after the `status` branch;
- change `onError?.("The assistant is unavailable right now.")` to ``onError?.(`${ASSISTANT_NAME} is unavailable right now.`)`` with `import { ASSISTANT_NAME } from "../app/assistant";`.

`frontend/src/features/assistant/ActionCard.jsx`:

```jsx
import { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import Button from "../../ui/Button";
import { cardState } from "./actionCard";

const TONE = { info: "text-brass", good: "text-status-good", muted: "text-ink-2", critical: "text-status-critical" };

/** One proposal: what will be saved, and Confirm / Open in form / Cancel. Nothing is saved until Confirm. */
export default function ActionCard({ action, onConfirm, onCancel }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);
  const s = cardState(action);
  const run = async (kind, fn) => {
    setBusy(kind);
    try {
      await fn(action);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label={action.card.title} className="mt-2 rounded-2xl border border-line bg-raised/60 p-3">
      <h3 className="text-sm font-semibold text-ink">{action.card.title}</h3>
      <dl className="mt-2 space-y-1 text-sm">
        {action.card.rows.map((r, i) => (
          <div key={`${r.label}-${i}`} className="flex justify-between gap-3">
            <dt className="shrink-0 text-ink-2">{r.label}</dt>
            <dd className="text-right font-num tabular-nums text-ink">
              {r.before !== undefined ? <><span className="text-ink-2">{r.before}</span> → <span className="font-semibold">{r.after}</span></> : r.value}
            </dd>
          </div>
        ))}
      </dl>
      {(action.card.warnings || []).map((w) => (
        <p key={w} role="note" className="mt-2 rounded-xl bg-status-warn/10 px-3 py-2 text-xs text-status-warn">{w}</p>
      ))}
      <p className={`mt-2 text-xs ${TONE[s.tone]}`}>
        {s.status === "confirmed" && <Check className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
        {s.note}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {s.canAct && <Button size="sm" loading={busy === "confirm"} disabled={Boolean(busy)} onClick={() => run("confirm", onConfirm)}>Confirm</Button>}
        {s.canOpenForm && <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => navigate(action.formLink)}>Open in form</Button>}
        {s.canAct && <Button size="sm" variant="ghost" loading={busy === "cancel"} disabled={Boolean(busy)} onClick={() => run("cancel", onCancel)}>Cancel</Button>}
        {s.status === "confirmed" && action.resultLink && <Button size="sm" variant="secondary" onClick={() => navigate(action.resultLink)}>Open</Button>}
      </div>
    </section>
  );
}

ActionCard.propTypes = {
  action: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    card: PropTypes.shape({ title: PropTypes.string.isRequired, rows: PropTypes.array.isRequired, warnings: PropTypes.array }).isRequired,
    error: PropTypes.string,
    formLink: PropTypes.string,
    resultLink: PropTypes.string,
    expiresAt: PropTypes.string,
  }).isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
```

- [ ] **Step 6: Replace the chat page**

`frontend/src/features/assistant/AssistantPage.jsx`: the whole file. These are the changes from today's file:
- the name comes from `ASSISTANT_NAME`;
- messages carry `actions`, filled from the stream and from the conversation;
- cards render under their reply, and confirm/cancel update them in place and refresh the money screens;
- English-only copy with new suggestions;
- `assistant-ring` and `assistant-float` classes.

```jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import PropTypes from "prop-types";
import { Plus, ArrowLeft, Trash2, SendHorizontal, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { assistantAPI, streamMessage } from "../../services/assistantAPI";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { ListSkeleton } from "../../ui/States";
import { relativeTime } from "../../utils/relativeTime";
import { useToast } from "../../context/ToastContext";
import { errorText } from "../../lib/errors";
import { ASSISTANT_NAME } from "../../app/assistant";
import ActionCard from "./ActionCard";
import { attachActions, replaceAction, keysAfter } from "./actionCard";

const SUGGESTIONS = ["Who owes me the most?", "What were sales this month?", "Record a payment", "Start a new order"];

// Links to app paths become in-app buttons; tables scroll inside the bubble.
function AssistantMarkdown({ text }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-2 text-sm leading-relaxed [&_code]:rounded [&_code]:bg-canvas/60 [&_code]:px-1 [&_code]:text-xs [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        table: ({ children }) => <div className="-mx-1 my-1 overflow-x-auto rounded-xl border border-line"><table className="min-w-full border-collapse text-xs">{children}</table></div>,
        thead: ({ children }) => <thead className="bg-canvas/50">{children}</thead>,
        th: ({ children }) => <th className="whitespace-nowrap border-b border-line px-3 py-2 text-left font-semibold">{children}</th>,
        td: ({ children }) => <td className="whitespace-nowrap border-b border-line/50 px-3 py-2 align-top last:border-b-0">{children}</td>,
        a: ({ href, children }) => href?.startsWith("/") ? (
          <button type="button" onClick={() => navigate(href)} className="my-1 inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-brass/15 px-3 text-sm font-semibold text-brass">{children} →</button>
        ) : <a href={href} target="_blank" rel="noreferrer" className="text-brass underline">{children}</a>,
      }}>{text}</ReactMarkdown>
    </div>
  );
}
AssistantMarkdown.propTypes = { text: PropTypes.string.isRequired };

// On touch devices Return inserts a newline; sending is the button's job.
const isCoarsePointer = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
const isDesktop = () => typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)").matches;

// Where the layout viewport doesn't shrink with the keyboard, the visual viewport does.
const useVisualViewportHeight = () => {
  const [height, setHeight] = useState(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const update = () => setHeight(vv.height);
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, []);
  return height;
};

function Hero() {
  return (
    <div className="rounded-3xl bg-gradient-to-b from-raised to-surface p-5 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
      <div className="flex items-center gap-4">
        <div className="relative grid h-14 w-14 shrink-0 place-items-center">
          <span aria-hidden="true" className="assistant-ring absolute inset-0 rounded-full bg-brass/40" />
          <div className="assistant-float relative grid h-12 w-12 place-items-center rounded-full bg-brass text-brass-on"><Sparkles className="h-5 w-5" /></div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink">Hi, I’m {ASSISTANT_NAME} 👋</h1>
          <p className="text-sm text-ink-2">Ask about dues, orders, stock or expenses. I can also prepare a payment, a customer, an order or a status change — you check it and tap Confirm.</p>
        </div>
      </div>
    </div>
  );
}

const withLast = (list, change) => {
  const next = [...list];
  next[next.length - 1] = change(next[next.length - 1]);
  return next;
};

export default function AssistantPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [conversations, setConversations] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [statusLine, setStatusLine] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const viewportHeight = useVisualViewportHeight();
  const desktop = isDesktop();

  const loadConversations = useCallback(async () => {
    try {
      const res = await assistantAPI.listConversations({ limit: 50 });
      setConversations(res.data.data.data);
    } catch {
      /* the list shows empty; opening still works */
    } finally {
      setListLoading(false);
    }
  }, []);
  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, statusLine]);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const onResize = () => bottomRef.current?.scrollIntoView({ block: "end" });
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const openConversation = async (id) => {
    try {
      const res = await assistantAPI.getConversation(id);
      const conv = res.data.data;
      setActiveId(id);
      setDraft(false);
      setMessages(attachActions(conv.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })), conv.actions || []));
    } catch {
      toast.error("Couldn't open that conversation. Try again.");
    }
  };
  // Nothing is created on the server until the first message is sent.
  const startNew = () => { setActiveId(null); setMessages([]); setDraft(true); };
  const backToList = () => { setActiveId(null); setDraft(false); setMessages([]); loadConversations(); };
  const handleDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await assistantAPI.deleteConversation(target.id);
      if (target.id === activeId) startNew();
      loadConversations();
    } catch {
      toast.error("Couldn't delete the conversation. Try again.");
    }
  };

  /** Confirm or cancel a card; the server's answer replaces it in place. */
  const actOn = async (kind, action) => {
    try {
      const res = kind === "confirm" ? await assistantAPI.confirmAction(action.id) : await assistantAPI.cancelAction(action.id);
      const updated = res.data.data;
      setMessages((prev) => replaceAction(prev, updated));
      if (updated.status === "confirmed" && kind === "confirm") {
        toast.success("Saved");
        await Promise.all(keysAfter(updated.name).map((queryKey) => qc.invalidateQueries({ queryKey })));
      } else if (updated.status === "failed") {
        toast.error(updated.error || "Couldn't save. Ask again.");
      }
    } catch (err) {
      toast.error(errorText(err, "That didn't work. Check your connection and try again."));
    }
  };

  const send = async (typed) => {
    const text = (typed ?? input).trim();
    if (!text || streaming) return;
    let id = activeId;
    if (!id) {
      try {
        const res = await assistantAPI.createConversation();
        id = res.data.data.id;
        setActiveId(id);
      } catch {
        toast.error(`Couldn't reach ${ASSISTANT_NAME}. Check your internet and try again.`);
        return;
      }
    }
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "user", content: text, actions: [] }, { role: "assistant", content: "", actions: [] }]);
    await streamMessage(id, text, {
      onDelta: (t) => setMessages((prev) => withLast(prev, (m) => ({ ...m, content: m.content + t }))),
      onStatus: (t) => setStatusLine(t),
      onAction: (a) => setMessages((prev) => withLast(prev, (m) => ({ ...m, actions: [...(m.actions || []), a] }))),
      onDone: () => { setStatusLine(null); loadConversations(); },
      onError: (msg) => setMessages((prev) => withLast(prev, (m) => ({ ...m, content: `⚠️ ${msg}` }))),
    });
    setStatusLine(null);
    setStreaming(false);
  };

  const list = (
    <div className="space-y-2">
      <h2 className="px-1 text-xs font-semibold text-ink-2">Recent conversations</h2>
      {listLoading ? <ListSkeleton rows={4} /> : conversations.length === 0 ? (
        <p className="px-1 py-3 text-sm text-ink-2">Nothing yet — start a conversation.</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-surface">
          {conversations.map((c) => (
            <li key={c.id} className={`flex items-center gap-1 border-b border-line/60 last:border-0 ${c.id === activeId ? "bg-raised" : ""}`}>
              <button type="button" onClick={() => openConversation(c.id)} className="min-w-0 flex-1 px-4 py-3 text-left hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
                <span className="block truncate text-sm font-semibold text-ink">{c.title}</span>
                <span className="block text-xs text-ink-2">{relativeTime(c.updated_at)}</span>
              </button>
              <IconButton label={`Delete conversation ${c.title}`} onClick={() => setDeleteTarget(c)} className="mr-2 h-9 w-9 bg-transparent text-ink-2"><Trash2 className="h-4 w-4" /></IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const lastMessage = messages[messages.length - 1];
  const showTyping = streaming && lastMessage?.role === "assistant" && lastMessage.content === "" && !lastMessage.actions?.length;
  const chat = (
    <>
      <div className="flex items-center gap-2 border-b border-line/70 px-3 py-3">
        {!desktop && <IconButton label="Back to conversations" onClick={backToList} className="bg-transparent"><ArrowLeft className="h-5 w-5" /></IconButton>}
        <h1 className="flex-1 font-num text-base font-semibold text-ink">{ASSISTANT_NAME}</h1>
        {desktop && <Button size="sm" variant="secondary" onClick={startNew}><Plus className="h-4 w-4" aria-hidden="true" />New</Button>}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            {desktop && <Hero />}
            <p className="text-sm text-ink-2">Try:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-line bg-surface px-3.5 py-2 text-left text-sm font-medium text-ink hover:border-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (m.role === "user" ? (
          <div key={m.id || i} className="flex justify-end"><div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brass px-4 py-2.5 text-sm text-brass-on">{m.content}</div></div>
        ) : (
          <div key={m.id || i} className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-line/70 bg-surface px-4 py-2.5 text-ink">
              {m.content === "" && showTyping && i === messages.length - 1 ? (
                <span className="inline-flex gap-1 py-1" aria-label={`${ASSISTANT_NAME} is typing`}>
                  {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-2" style={{ animationDelay: `${d}ms` }} />)}
                </span>
              ) : m.content ? <AssistantMarkdown text={m.content} /> : null}
              {(m.actions || []).map((a) => (
                <ActionCard key={a.id} action={a} onConfirm={(x) => actOn("confirm", x)} onCancel={(x) => actOn("cancel", x)} />
              ))}
            </div>
          </div>
        )))}
        {statusLine && <p className="pl-2 text-xs italic text-ink-2">{statusLine}</p>}
        <div ref={bottomRef} />
      </div>
      <div className="bg-canvas px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <div className="flex items-end gap-1.5 rounded-[26px] border border-line bg-surface px-2 py-1.5 transition focus-within:border-brass/60 focus-within:ring-2 focus-within:ring-brass/20">
          <textarea ref={inputRef} value={input} rows={1} placeholder={`Ask ${ASSISTANT_NAME}…`} aria-label={`Message ${ASSISTANT_NAME}`}
            onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`; }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !isCoarsePointer) { e.preventDefault(); send(); } }}
            onFocus={() => setTimeout(() => bottomRef.current?.scrollIntoView({ block: "end" }), 300)}
            className="max-h-24 min-h-[40px] flex-1 resize-none border-0 bg-transparent px-3 py-2 text-base text-ink outline-none placeholder:text-ink-2 focus:ring-0 lg:text-sm" />
          <button type="button" aria-label="Send" onClick={() => send()} disabled={streaming || !input.trim()}
            className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brass text-brass-on transition active:scale-90 disabled:opacity-35">
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  const confirm = (
    <ConfirmDialog open={Boolean(deleteTarget)} title="Delete conversation?" message={`“${deleteTarget?.title || ""}” will be removed from your history.`}
      confirmLabel="Delete" cancelLabel="Keep it" onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
  );

  if (desktop) {
    return (
      <div className="mx-auto grid h-[calc(100dvh-6rem)] max-w-6xl grid-cols-[18rem_1fr] gap-4 px-6 py-4">
        <aside className="space-y-3 overflow-y-auto"><Button block onClick={startNew}><Plus className="h-4 w-4" aria-hidden="true" />New conversation</Button>{list}</aside>
        <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl bg-surface/40">{chat}</section>
        {confirm}
      </div>
    );
  }
  if (activeId === null && !draft) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 p-4">
        <Hero />
        <Button block size="lg" onClick={startNew}><Plus className="h-4 w-4" aria-hidden="true" />Start a new conversation</Button>
        {list}
        {confirm}
      </div>
    );
  }
  // Phones: portaled to <body> — the page-enter wrapper's transform would trap position:fixed.
  return createPortal(
    <div className="fixed inset-x-0 top-0 z-50 flex flex-col bg-canvas" style={{ height: viewportHeight ? `${viewportHeight}px` : "100dvh" }}>{chat}</div>,
    document.body,
  );
}
```

- [ ] **Step 7: "via Sage" in History**

In `frontend/src/features/history/describeAudit.js`:
- rename the existing `export const describeAudit = (r) => {` to `const describeEntry = (r) => {` (body unchanged);
- add `import { ASSISTANT_NAME } from "../../app/assistant";` at the top;
- below `describeEntry`, add:

```js
/** One History entry; a change confirmed on an assistant card says so. */
export const describeAudit = (r) => {
  const d = describeEntry(r);
  return r.metadata?.source === "assistant" ? { ...d, via: ASSISTANT_NAME } : d;
};
```

In `frontend/src/features/history/HistoryPage.jsx`, change the title line inside `Entry` to:

```jsx
        <span className="block text-sm font-semibold text-ink">{d.title}{d.via && <span className="ml-1.5 rounded-full bg-brass/15 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-brass">via {d.via}</span>}</span>
```

- [ ] **Step 8: Run tests and lint**

Run: `cd frontend && npm test 2>&1 | tail -4 && npm run lint 2>&1 | tail -3 && /usr/bin/grep -rni "jarvis" src`
Expected: all tests pass, lint reports 0 errors, and the grep prints nothing.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/assistant.js frontend/src/features/assistant/actionCard.js frontend/src/features/assistant/actionCard.test.js frontend/src/features/assistant/ActionCard.jsx frontend/src/features/assistant/AssistantPage.jsx frontend/src/services/assistantAPI.js frontend/src/app/routeMeta.js frontend/src/app/navItems.js frontend/src/components/layout/MainLayout.jsx frontend/src/assets/styles/index.css frontend/src/features/history/describeAudit.js frontend/src/features/history/describeAudit.test.js frontend/src/features/history/HistoryPage.jsx
git commit -m "feat(sage): cards in the chat with Confirm / Open in form / Cancel; Jarvis renamed Sage; History marks changes made via Sage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 11: "Open in form" — the real forms, filled from a card

**Files:**
- Create: `frontend/src/features/assistant/formPrefill.js`, `frontend/src/features/assistant/formPrefill.test.js`, `frontend/src/features/assistant/api.js`
- Modify: `frontend/src/lib/queryKeys.js` (`keys.assistant.action`), `frontend/src/features/orders/form/OrderFormPage.jsx`, `frontend/src/features/customers/CustomerFormPage.jsx`, `frontend/src/features/orders/OrderPage.jsx`, `frontend/src/features/payments/PaymentSheet.jsx`
- Test: `frontend/src/features/assistant/formPrefill.test.js`

**Interfaces:**
- Consumes:
  - `GET /assistant/actions/:id` → `{ name, status, payload, context }` (Task 7).
  - Payload shapes (Task 8):
    - `create_order`: the `orders.create` input, with `status` and `round_off_amount` included.
    - `create_customer`: the `customers.create` input.
    - `record_payment`: the `payments.create` input.
    - `context.customer = { id, name, phone }`; `context.refund` for payments.
- Produces:
  - `orderDraftFromAction(action) → draft` (the shape of `newDraft`).
  - `customerFormFromAction(action) → form` (the shape of `emptyCustomer`).
  - `paymentFromAction(action) → { mode, prefill }`.
  - `useAssistantAction(id)`: a query hook, disabled when `id` is falsy.
  - `PaymentSheet` gains `prefill` (initial values for a new payment) and `onSaved(saved, body)`.
  - **Pages:**
    - `/orders/new?assistant=<id>` and `/customers/new?assistant=<id>` open pre-filled.
    - `/orders/:id?pay=assistant:<id>` opens the payment sheet pre-filled.
    - After a save, each calls `completedInForm(id, { result_id, saved })`. It is fire-and-forget: a failure never blocks the save.

- [ ] **Step 1: Write the failing tests**

`frontend/src/features/assistant/formPrefill.test.js`:

```js
import { describe, expect, test } from "vitest";
import { orderDraftFromAction, customerFormFromAction, paymentFromAction } from "./formPrefill";
import { toPayload } from "../orders/form/draft";
import { toCustomerPayload } from "../customers/customerForm";
import { validatePayment } from "../payments/paymentForm";

const orderAction = {
  name: "create_order",
  context: { customer: { id: "c1", name: "Bombay Saree Centre", phone: "9876500003" } },
  payload: {
    customer_id: "c1", plate_type_id: "p1", order_date: "2026-10-01", status: "PENDING", round_off_amount: 0,
    advance_received: 600, custom_plate_charge: null,
    product_sizes: [
      { product_size_id: "s1", unit: "KG", quantity_kg: 20, rate_per_kg: 180 },
      { product_size_id: "s2", unit: "PIECES", quantity_pieces: 4000, price_amount: 375, price_pieces_count: 1000 },
    ],
  },
};

describe("order card → order form", () => {
  test("fills customer, date, plate, advance and lines as typed text", () => {
    const d = orderDraftFromAction(orderAction);
    expect(d).toMatchObject({ customer: { id: "c1", name: "Bombay Saree Centre" }, orderDate: "2026-10-01", plateTypeId: "p1", advance: "600", customPlateCharge: "" });
    expect(d.lines.map((l) => [l.unit, l.quantity_kg || l.quantity_pieces])).toEqual([["KG", "20"], ["PIECES", "4000"]]);
  });

  test("saving it unchanged sends exactly what the card showed", () => {
    expect(toPayload(orderDraftFromAction(orderAction), { isEdit: false })).toEqual(orderAction.payload);
  });

  test("a card of another kind gives an empty form", () => {
    expect(orderDraftFromAction({ name: "create_customer", payload: { name: "X" } }).lines).toHaveLength(1);
  });
});

describe("customer card → customer form", () => {
  test("saving it unchanged sends the card's fields", () => {
    const action = { name: "create_customer", payload: { name: "Ganesh Textiles", phone: "9845012345", city: "Hubli" } };
    expect(toCustomerPayload(customerFormFromAction(action))).toEqual({ name: "Ganesh Textiles", phone: "9845012345", city: "Hubli", email: "", address: "", gstin: "" });
  });
});

describe("payment card → payment sheet", () => {
  test("a payment opens the payment sheet with the card's values", () => {
    const action = { name: "record_payment", context: { refund: false }, payload: { order_id: "o1", amount: 2000, payment_type: "PARTIAL", payment_method: "UPI", payment_date: "2026-10-01", reference_number: null, notes: null } };
    const { mode, prefill } = paymentFromAction(action);
    expect(mode).toBe("payment");
    const { payload } = validatePayment({ mode, form: { amount: String(prefill.amount), type: "PARTIAL", method: prefill.method, date: prefill.date, reference: "", notes: "" }, due: 2300, received: 1000 });
    expect(payload).toEqual({ amount: 2000, payment_type: "PARTIAL", payment_method: "UPI", payment_date: "2026-10-01", reference_number: null, notes: null });
  });

  test("a refund opens the refund sheet", () => {
    expect(paymentFromAction({ name: "record_payment", context: { refund: true }, payload: { amount: 500, payment_method: "CASH", payment_date: "2026-10-01" } }).mode).toBe("refund");
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `cd frontend && npx vitest run src/features/assistant/formPrefill.test.js`
Expected: FAIL — `Failed to resolve import "./formPrefill"`.

- [ ] **Step 3: Write the mapping and the hook**

`frontend/src/features/assistant/formPrefill.js`:

```js
import { newDraft, newLine } from "../orders/form/draft";
import { emptyCustomer } from "../customers/customerForm";

const text = (v) => (v === null || v === undefined ? "" : String(v));

/** An order card → the order form's draft, as if the person had typed it. Any other card → an empty form. */
export const orderDraftFromAction = (action) => {
  if (action?.name !== "create_order") return newDraft();
  const { payload, context } = action;
  const c = context?.customer;
  return {
    ...newDraft(c ? { id: c.id, name: c.name, phone: c.phone || null } : null),
    orderDate: payload.order_date,
    plateTypeId: payload.plate_type_id,
    customPlateCharge: text(payload.custom_plate_charge),
    roundOff: payload.round_off_amount ? text(payload.round_off_amount) : "",
    advance: payload.advance_received ? text(payload.advance_received) : "",
    status: payload.status || "PENDING",
    lines: payload.product_sizes.map((l) =>
      l.unit === "PIECES"
        ? { ...newLine(), product_size_id: l.product_size_id, unit: "PIECES", quantity_pieces: text(l.quantity_pieces), price_amount: text(l.price_amount), price_pieces_count: text(l.price_pieces_count) }
        : { ...newLine(), product_size_id: l.product_size_id, unit: "KG", quantity_kg: text(l.quantity_kg), rate_per_kg: text(l.rate_per_kg) }
    ),
  };
};

/** A customer card → the customer form. */
export const customerFormFromAction = (action) => {
  if (action?.name !== "create_customer") return emptyCustomer();
  const p = action.payload;
  return { ...emptyCustomer(), ...Object.fromEntries(["name", "phone", "city", "email", "address", "gstin"].map((k) => [k, text(p[k])])) };
};

/** A payment card → which sheet to open and its starting values. */
export const paymentFromAction = (action) => {
  const p = action.payload;
  return {
    mode: action.context?.refund ? "refund" : "payment",
    prefill: { amount: p.amount, method: p.payment_method || "CASH", date: p.payment_date, reference: p.reference_number || null, notes: p.notes || null },
  };
};
```

In `frontend/src/lib/queryKeys.js` change the assistant line to:

```js
  assistant: { conversations: ["assistant", "conversations"], action: (id) => ["assistant", "action", id] },
```

`frontend/src/features/assistant/api.js`:

```js
import { useQuery } from "@tanstack/react-query";
import { assistantAPI } from "../../services/assistantAPI";
import { keys } from "../../lib/queryKeys";

/** One card, for "Open in form". Off when there is no id. */
export const useAssistantAction = (id) =>
  useQuery({
    queryKey: keys.assistant.action(id),
    queryFn: () => assistantAPI.getAction(id).then((r) => r.data.data),
    enabled: Boolean(id),
    staleTime: Infinity,
    retry: false,
  });

/** Tell the server the person finished this card in the form. Never blocks or fails the save. */
export const reportFinishedInForm = (id, resultId, saved) => {
  if (!id) return;
  assistantAPI.completedInForm(id, { result_id: resultId, saved }).catch(() => {});
};
```

- [ ] **Step 4: Run the tests**

Run: `cd frontend && npx vitest run src/features/assistant/formPrefill.test.js`
Expected: PASS. If the round-trip test fails, the mapping is wrong: fix `formPrefill.js`, not the test.

- [ ] **Step 5: Wire the order form**

In `frontend/src/features/orders/form/OrderFormPage.jsx`:
- add `import { useAssistantAction, reportFinishedInForm } from "../../assistant/api";` and `import { orderDraftFromAction } from "../../assistant/formPrefill";`;
- after `const presetId = …` add:

```js
  const assistantId = isEdit ? null : search.get("assistant");
  const actionQ = useAssistantAction(assistantId);
```

Then:
- in the `initial` `useMemo`, add as the first line after `if (isEdit) …`: `if (assistantId) return actionQ.data ? orderDraftFromAction(actionQ.data) : actionQ.isError ? newDraft() : null;`, and add `assistantId, actionQ.data, actionQ.isError` to its dependency list;
- in `submit`, replace the `save.mutate(toPayload(draft, { isEdit }), {` call so the payload is reported when Sage started it:

```js
    const payload = toPayload(draft, { isEdit });
    save.mutate(payload, {
      onSuccess: (order) => {
        reportFinishedInForm(assistantId, order.id, payload);
        toast.success(isEdit ? "Order updated" : "Order saved");
        navigate(`/orders/${isEdit ? id : order.id}`, { replace: true });
      },
    });
```

- [ ] **Step 6: Wire the customer form**

In `frontend/src/features/customers/CustomerFormPage.jsx`:
- add the same two kinds of import (`useAssistantAction, reportFinishedInForm` and `customerFormFromAction`) and `PageSkeleton` if it is not already imported;
- after `const presetName = …` add:

```js
  const assistantId = isEdit ? null : search.get("assistant");
  const actionQ = useAssistantAction(assistantId);
```

Then:
- change the `initial` memo's non-edit branch to `assistantId && actionQ.data ? customerFormFromAction(actionQ.data) : { ...emptyCustomer(), name: presetName }`, with `assistantId, actionQ.data` added to its dependency list;
- directly after the `if (isEdit && existing.isError) {…}` block, add `if (assistantId && actionQ.isPending) return <PageSkeleton />;`;
- in `submit`'s `onSuccess`, add first: `reportFinishedInForm(assistantId, c.id, toCustomerPayload(form));`.

- [ ] **Step 7: Wire the payment sheet**

In `frontend/src/features/payments/PaymentSheet.jsx`:
- add `prefill = null, onSaved` to the props;
- `useState(() => initialPaymentForm(payment))` → `useState(() => initialPaymentForm(payment || prefill))`;
- `useState(Boolean(payment?.reference || payment?.notes))` → `useState(Boolean((payment || prefill)?.reference || (payment || prefill)?.notes))`;
- change the mutate `onSuccess` to `onSuccess: (saved) => { onSaved?.(saved, body); toast.success(text.done); onClose(); },`;
- add to `propTypes`: `prefill: PropTypes.object, onSaved: PropTypes.func,`.

In `frontend/src/features/orders/OrderPage.jsx`:
- add `useEffect` to the React import and `useSearchParams` to the router import;
- import `useAssistantAction, reportFinishedInForm` from `../assistant/api` and `paymentFromAction` from `../assistant/formPrefill`;
- after the `useState` lines (before `if (isPending)`), add:

```js
  // "Open in form" from a Sage payment card: /orders/:id?pay=assistant:<cardId>
  const [search, setSearch] = useSearchParams();
  const pay = search.get("pay");
  const payCardId = pay?.startsWith("assistant:") ? pay.slice("assistant:".length) : null;
  const payCard = useAssistantAction(payCardId);
  useEffect(() => {
    if (!order || payCard.data?.name !== "record_payment") return;
    const { mode, prefill } = paymentFromAction(payCard.data);
    setSheet({ open: true, mode, payment: null, prefill, cardId: payCardId, key: Date.now() });
    setSearch((s) => { s.delete("pay"); return s; }, { replace: true });
  }, [order, payCard.data, payCardId, setSearch]);
```

and in the `<PaymentSheet …>` element add:

```jsx
        prefill={sheet.prefill || null} onSaved={(saved, body) => reportFinishedInForm(sheet.cardId, saved.id, body)}
```

`openSheet` stays as is. It creates sheets without `prefill` or `cardId`, so those stay undefined.

- [ ] **Step 8: Tests, lint, commit**

Run: `cd frontend && npm test 2>&1 | tail -4 && npm run lint 2>&1 | tail -3`
Expected: all tests pass and lint reports 0 errors.

```bash
git add frontend/src/features/assistant/formPrefill.js frontend/src/features/assistant/formPrefill.test.js frontend/src/features/assistant/api.js frontend/src/lib/queryKeys.js frontend/src/features/orders/form/OrderFormPage.jsx frontend/src/features/customers/CustomerFormPage.jsx frontend/src/features/orders/OrderPage.jsx frontend/src/features/payments/PaymentSheet.jsx
git commit -m "feat(sage): Open in form fills the real order, customer and payment forms from a card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 12: Evals against real free models, and the learning report

**Files:**
- Create: `backend/scripts/eval/fixture.js`, `backend/scripts/eval/readEvals.js`, `backend/scripts/eval/judge.js`, `backend/scripts/assistant-eval.js`, `backend/scripts/assistant-report.js`
- Test: `backend/tests/assistantEvalJudge.test.js`

**Interfaces:**
- Consumes:
  - `runAssistant` with `deps.tools` and `deps.stream` (Task 6).
  - `allTools()` (Task 7).
  - `ACTIONS[].evals` (Task 8).
  - `buildEntries`, `createChain` (Task 4).
  - `effectiveStatus` (Task 7).
- Produces:
  - `judge(expect, run, ids) → { pass, why }`. `run` is `{ calls: [{ name, args, ok }], text }`; `ids` maps a fixture name to its id.
  - `seed(db) → ids`.
  - `READ_EVALS`.
  - **CLI:**
    - `NODE_ENV=test node scripts/assistant-eval.js [--entry <label>] [--only <action>] [--pause <s>] [--gate]`
    - `NODE_ENV=production node scripts/assistant-report.js [--since YYYY-MM-DD]`

- [ ] **Step 1: Write the failing test for the judge**

`backend/tests/assistantEvalJudge.test.js`:

```js
"use strict";

const { judge } = require("../scripts/eval/judge");

const ids = { bombayOrder: "o-1", single: "p-1", size1216: "s-1" };
const proposal = (name, args, ok = true) => ({ name: `propose_${name}`, args, ok });

describe("eval judge", () => {
  test("an action passes when its arguments contain what's expected and ids point at the right records", () => {
    const run = { calls: [{ name: "find", args: {}, ok: true }, proposal("record_payment", { order_id: "o-1", amount: 5000, method: "UPI" })], text: "Tap Confirm." };
    expect(judge({ action: "record_payment", args: { amount: 5000, method: "UPI" }, refs: { order_id: "bombayOrder" } }, run, ids)).toEqual({ pass: true, why: "" });
  });

  test("the wrong record fails, saying why", () => {
    const run = { calls: [proposal("record_payment", { order_id: "o-2", amount: 5000 })], text: "" };
    expect(judge({ action: "record_payment", refs: { order_id: "bombayOrder" } }, run, ids)).toEqual({ pass: false, why: 'propose_record_payment args {"order_id":"o-2","amount":5000}' });
  });

  test("nested refs and list arguments", () => {
    const run = { calls: [proposal("create_order", { plate_type_id: "p-1", lines: [{ size_id: "s-1", unit: "KG", quantity: 20 }] })], text: "" };
    expect(judge({ action: "create_order", args: { lines: [{ unit: "KG", quantity: 20 }] }, refs: { plate_type_id: "single", "lines.0.size_id": "size1216" } }, run, ids).pass).toBe(true);
  });

  test("asking back passes only with no card and a question", () => {
    expect(judge({ asks: true }, { calls: [], text: "Which Sharma Traders — Surat or Delhi?" }, ids).pass).toBe(true);
    expect(judge({ asks: true }, { calls: [proposal("record_payment", {})], text: "Which one?" }, ids).pass).toBe(false);
    expect(judge({ asks: true }, { calls: [proposal("record_payment", {}, false)], text: "Which one?" }, ids).pass).toBe(true);
  });

  test("refusing passes with no card and the link", () => {
    expect(judge({ noAction: true, mentions: "/orders" }, { calls: [], text: "I can't delete. [Open the order](/orders/o-1)" }, ids).pass).toBe(true);
  });

  test("a read question passes when the expected tool was used", () => {
    expect(judge({ tool: "dues" }, { calls: [{ name: "dues", args: {}, ok: true }], text: "₹10" }, ids).pass).toBe(true);
    expect(judge({ tool: "dues" }, { calls: [{ name: "run_query", args: {}, ok: true }], text: "₹10" }, ids).pass).toBe(false);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `cd backend && npm test -- tests/assistantEvalJudge.test.js`
Expected: FAIL — `Cannot find module '../scripts/eval/judge'`.

- [ ] **Step 3: Write the judge, the read evals and the fixture**

`backend/scripts/eval/judge.js`:

```js
"use strict";

const at = (obj, dotted) => dotted.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

/** `want` is contained in `got`: numbers compare by value, strings ignore case and spaces at the ends. */
const contains = (want, got) => {
  if (Array.isArray(want)) return Array.isArray(got) && want.every((w, i) => contains(w, got[i]));
  if (want && typeof want === "object") return Boolean(got) && typeof got === "object" && Object.keys(want).every((k) => contains(want[k], got[k]));
  if (typeof want === "number") return Number(got) === want;
  if (typeof want === "string") return typeof got === "string" && got.trim().toLowerCase() === want.trim().toLowerCase();
  return want === got;
};

/**
 * Did one run do what the eval expects?
 * run = { calls: [{ name, args, ok }], text }; ids = fixture name → id.
 */
const judge = (expect, run, ids) => {
  const cards = run.calls.filter((c) => c.name.startsWith("propose_") && c.ok);
  if (expect.action) {
    const tool = `propose_${expect.action}`;
    const mine = cards.filter((c) => c.name === tool);
    const hit = mine.find((c) => contains(expect.args || {}, c.args) && Object.entries(expect.refs || {}).every(([path, name]) => at(c.args, path) === ids[name]));
    if (hit) return { pass: true, why: "" };
    return { pass: false, why: mine.length ? mine.map((c) => `${tool} args ${JSON.stringify(c.args)}`).join("; ") : `no ${tool} card (tools: ${run.calls.map((c) => c.name).join(", ") || "none"})` };
  }
  if (expect.asks) {
    const pass = cards.length === 0 && run.text.includes("?");
    return { pass, why: pass ? "" : cards.length ? `made a card instead of asking: ${cards[0].name}` : "no question in the answer" };
  }
  if (expect.noAction) {
    const pass = cards.length === 0 && run.text.includes(expect.mentions);
    return { pass, why: pass ? "" : cards.length ? `made a card: ${cards[0].name}` : `answer lacks ${expect.mentions}` };
  }
  if (expect.tool) {
    const pass = run.calls.some((c) => c.name === expect.tool);
    return { pass, why: pass ? "" : `used ${run.calls.map((c) => c.name).join(", ") || "no tool"}` };
  }
  if (expect.mentions) {
    const pass = run.text.includes(expect.mentions);
    return { pass, why: pass ? "" : `answer lacks ${expect.mentions}` };
  }
  return { pass: false, why: "eval has no expectation" };
};

module.exports = { judge, contains };
```

`backend/scripts/eval/readEvals.js`:

```js
"use strict";

/** Questions Sage must answer with the right tool (the action evals live in each action file). */
const READ_EVALS = [
  { ask: "Who owes me the most money?", expect: { tool: "dues" } },
  { ask: "How much has Bombay Saree Centre paid so far?", expect: { tool: "customer_summary" } },
  { ask: "What were our sales this month?", expect: { tool: "period_summary" } },
  { ask: "How do I record a payment in the app?", expect: { mentions: "/orders" } },
];

module.exports = { READ_EVALS };
```

`backend/scripts/eval/fixture.js`:

```js
"use strict";

// Named records every eval refers to. Runs only against the local *_test database.
const TABLES = [
  "assistant_actions", "assistant_messages", "assistant_conversations", "audit_logs",
  "invoice_items", "payments", "invoices", "order_product_sizes", "orders", "product_sizes", "plate_types", "customers",
];

const seed = async (db) => {
  const { host, database } = db.sequelize.config;
  if (!["localhost", "127.0.0.1"].includes(host) || !String(database).endsWith("_test")) {
    throw new Error(`Refusing to seed ${host}/${database}: evals run only on the local *_test database.`);
  }
  await db.sequelize.query(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`);

  const single = await db.PlateType.create({ type_name: "Single colour", charge: "1500.00" });
  const double = await db.PlateType.create({ type_name: "Two colour", charge: "2500.00" });
  const size1216 = await db.ProductSize.create({ size_label: "12 x 16", rate_per_kg: "180.00" });
  const size1418 = await db.ProductSize.create({ size_label: "14 x 18", rate_per_kg: "0.00", piece_price_amount: "375", piece_price_count: 1000 });
  const customer = (name, phone, city) => db.Customer.create({ name, metadata: { phone, city } });
  const sharmaSurat = await customer("Sharma Traders", "9876500001", "Surat");
  const sharmaDelhi = await customer("Sharma Traders", "9876500002", "Delhi");
  const bombay = await customer("Bombay Saree Centre", "9876500003", "Mumbai");
  const laxmi = await customer("Laxmi Stores", "9876500004", "Bidar");

  const order = async (c, date, lines) => {
    const o = await db.Order.create({ customer_id: c.id, plate_type_id: single.id, order_date: date });
    for (const l of lines) await db.OrderProductSize.create({ order_id: o.id, ...l });
    return o;
  };
  const kg = (size, q) => ({ product_size_id: size.id, unit: "KG", quantity_kg: String(q), rate_per_kg: size.rate_per_kg });
  const bombayOrder = await order(bombay, "2026-09-12", [kg(size1216, 20)]);
  const suratOrderA = await order(sharmaSurat, "2026-09-05", [kg(size1216, 10)]);
  const suratOrderB = await order(sharmaSurat, "2026-09-20", [{ product_size_id: size1418.id, unit: "PIECES", quantity_pieces: 5000, price_amount: "375", price_pieces_count: 1000 }]);
  const delhiOrder = await order(sharmaDelhi, "2026-09-08", [kg(size1216, 5)]);
  // 5 kg × 180 + plate 1500 = 2400: Delhi's only order is paid in full.
  await db.Payment.create({ order_id: delhiOrder.id, customer_id: sharmaDelhi.id, amount: "2400.00", payment_type: "FINAL", payment_date: "2026-09-09" });

  const records = { single, double, size1216, size1418, sharmaSurat, sharmaDelhi, bombay, laxmi, bombayOrder, suratOrderA, suratOrderB, delhiOrder };
  return Object.fromEntries(Object.entries(records).map(([name, r]) => [name, r.id]));
};

module.exports = { seed };
```

- [ ] **Step 4: Run the judge test**

Run: `cd backend && npm test -- tests/assistantEvalJudge.test.js`
Expected: PASS.

- [ ] **Step 5: Write the eval runner**

`backend/scripts/assistant-eval.js`:

```js
#!/usr/bin/env node
"use strict";

/**
 * Ask Sage every eval request, on the local test database, with a real free model,
 * and print what passed. Uses free quota (≈ 6–8k tokens per request).
 *
 *   cd backend && NODE_ENV=test node scripts/assistant-eval.js [--entry groq:openai/gpt-oss-120b] [--only record_payment] [--pause 20] [--gate]
 *
 * --entry  one chain entry only (default: the first configured one)
 * --only   one action's evals ("read" for the read questions)
 * --pause  seconds between requests (default 20: Groq allows 8k tokens a minute)
 * --gate   exit 1 when fewer than 90 % pass
 */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

if (process.env.NODE_ENV !== "test") {
  console.error("Run with NODE_ENV=test — evals use the local test database only.");
  process.exit(1);
}
// Model keys come from .env, read for those keys only — never its database settings.
const envFile = path.join(__dirname, "../.env");
const fileKeys = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};
for (const k of ["GROQ_API_KEY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]) if (!process.env[k] && fileKeys[k]) process.env[k] = fileKeys[k];

const db = require("../src/models");
const { runAssistant } = require("../src/assistant");
const { allTools } = require("../src/assistant/toolset");
const { buildEntries } = require("../src/assistant/llm");
const { createChain } = require("../src/assistant/chain");
const { ACTIONS } = require("../src/assistant/actionKit/registry");
const { READ_EVALS } = require("./eval/readEvals");
const { seed } = require("./eval/fixture");
const { judge } = require("./eval/judge");

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1] ?? true;
};
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

const main = async () => {
  const entries = buildEntries();
  const label = arg("--entry", entries[0]?.label);
  const entry = entries.find((e) => e.label === label);
  if (!entry) throw new Error(`No configured model "${label}". Configured: ${entries.map((e) => e.label).join(", ") || "none"}`);
  const chain = createChain([entry]);
  const only = arg("--only");
  const pause = Number(arg("--pause", 20));

  const cases = [
    ...ACTIONS.flatMap((a) => a.evals.map((e) => ({ group: a.name, ...e }))),
    ...READ_EVALS.map((e) => ({ group: "read", ...e })),
  ].filter((c) => !only || c.group === only);

  const ids = await seed(db);
  console.log(`Model ${entry.label} — ${cases.length} requests\n`);
  let passed = 0;
  for (const [i, c] of cases.entries()) {
    if (i) await sleep(pause);
    const calls = [];
    const tools = allTools().map((t) => ({
      ...t,
      run: async (args, ctx) => {
        try {
          const out = await t.run(args, ctx);
          calls.push({ name: t.name, args, ok: true });
          return out;
        } catch (err) {
          calls.push({ name: t.name, args, ok: false });
          throw err;
        }
      },
    }));
    const conversation = await db.AssistantConversation.create({});
    let text;
    try {
      text = await runAssistant([{ role: "user", content: c.ask }], { onDelta: () => {}, onStatus: () => {} },
        { conversationId: conversation.id, requestText: c.ask }, { tools, stream: (req) => chain.stream(req) });
    } catch (err) {
      text = `(failed: ${err.message})`;
    }
    const verdict = judge(c.expect, { calls, text }, ids);
    if (verdict.pass) passed += 1;
    console.log(`${verdict.pass ? "PASS" : "FAIL"}  [${c.group}] ${c.ask}${verdict.pass ? "" : `\n      → ${verdict.why}\n      reply: ${text.slice(0, 200).replace(/\n/g, " ")}`}`);
  }
  const rate = cases.length ? passed / cases.length : 0;
  console.log(`\n${passed}/${cases.length} passed (${Math.round(rate * 100)}%) on ${entry.label}`);
  await db.sequelize.close();
  if (arg("--gate") && rate < 0.9) process.exit(1);
};

main().catch(async (err) => {
  console.error(err.message);
  await db.sequelize.close().catch(() => {});
  process.exit(1);
});
```

- [ ] **Step 6: Write the learning report**

`backend/scripts/assistant-report.js`:

```js
#!/usr/bin/env node
"use strict";

/**
 * What happened to Sage's cards: how many were confirmed, cancelled, expired,
 * failed, or finished in the form (and what the person changed there).
 * Read-only. The ones "to look at" become new evals and better guide text.
 *
 *   cd backend && NODE_ENV=production node scripts/assistant-report.js [--since 2026-10-01]
 */
require("dotenv").config();
const { Op } = require("sequelize");
const db = require("../src/models");
const { effectiveStatus } = require("../src/assistant/actionKit/actionService");

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};

const main = async () => {
  const since = arg("--since") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const rows = await db.AssistantAction.findAll({ where: { created_at: { [Op.gte]: since } }, order: [["created_at", "ASC"]] });
  console.log(`Sage cards since ${since}: ${rows.length}\n`);

  const counts = {};
  for (const r of rows) {
    const s = effectiveStatus(r);
    counts[r.name] = counts[r.name] || {};
    counts[r.name][s] = (counts[r.name][s] || 0) + 1;
  }
  for (const [name, byStatus] of Object.entries(counts)) {
    console.log(`${name.padEnd(18)} ${Object.entries(byStatus).map(([s, n]) => `${s} ${n}`).join(" · ")}`);
  }

  const toLook = rows.filter((r) => effectiveStatus(r) !== "confirmed" && effectiveStatus(r) !== "pending");
  if (toLook.length) console.log("\nTo look at (each is a candidate eval):");
  for (const r of toLook) {
    const s = effectiveStatus(r);
    const detail = s === "failed" ? r.error : s === "completed_in_form" ? `changed: ${(r.outcome?.changed || []).join(", ") || "nothing"}` : "";
    console.log(`- ${r.created_at.toISOString().slice(0, 16)} ${r.name} ${s}: "${r.request_text || ""}"${detail ? ` — ${detail}` : ""}`);
  }
  await db.sequelize.close();
};

main().catch(async (err) => {
  console.error(err.message);
  await db.sequelize.close().catch(() => {});
  process.exit(1);
});
```

- [ ] **Step 7: Run the evals once on the first model**

Run: `cd backend && NODE_ENV=test node scripts/assistant-eval.js --gate 2>&1 | tail -30`
Expected: a PASS/FAIL line per request and `N/17 passed (≥90%)`. This uses about 120k tokens of the day's free quota.
- For each FAIL, read the `why` and the reply.
- Fix the cause in the core prompt, a guide, or a tool or action `description`. Never fix it by weakening the eval.
- Ledger each such change as a Ruling with the before/after pass rate.
- Re-run with `--only <group>` to save quota.
- If the first model stays below 90 % after two rounds of fixes, run `--entry groq:qwen/qwen3.8-27b` and `--entry cloudflare:@cf/openai/gpt-oss-120b`, then reorder `MODEL_CHAIN` so the best scorer is first.
- If none reaches 90 %, stop and report to the owner instead of deploying (spec §10).

- [ ] **Step 8: Whole suite, then commit**

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: every suite passes.

```bash
git add backend/scripts/eval/fixture.js backend/scripts/eval/readEvals.js backend/scripts/eval/judge.js backend/scripts/assistant-eval.js backend/scripts/assistant-report.js backend/tests/assistantEvalJudge.test.js
git commit -m "feat(sage): evals against real free models on the test database, and a report of what happened to cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Commit any prompt, guide or description changes from Step 7 with their own message, `fix(sage): <what> — evals N→M`.)

---
### Task 13: Docs, walkthrough on a copy of production data, final review, deploy

**Files:**
- Modify: `HANDOFF.md` (the line-47 note about canonical SQL; replace the line-59 "AI Assistant Jarvis" paragraph; add a "State" entry)

**Interfaces:**
- Consumes: everything above.
- Produces: the deployed release, and a handoff that tells the next person how to add a feature to Sage.

- [ ] **Step 1: Update `HANDOFF.md`**

Replace line 47 with:

```markdown
- The tested pending and kg/pieces SQL live between `<!-- canonical:… -->` markers in `backend/knowledge/money-sql.md`; `tests/knowledgeQueries.test.js` runs them through the assistant's guarded `runQuery` and asserts they match `orderMath`.
```

Replace the whole line-59 paragraph with:

```markdown
**Sage — the in-app assistant (rebuilt 2026-10-01; was "Jarvis").** Page `/assistant` + floating button. Answers questions and proposes changes as cards a person confirms; it never saves on its own and never deletes. Spec `docs/superpowers/specs/2026-10-01-sage-actions-design.md`.
- **Saves are commands** (`backend/src/commands/`): one Zod-checked definition per save, run in a transaction with an `actor`; the screens' routes (`httpRoute`) and Sage's cards both use them. History entries carry `metadata.source` = `app` or `assistant` (+ `assistant_action_id`). Moved so far: `payments.create`, `customers.create`, `orders.create`, `orders.update`.
- **Assistant** (`backend/src/assistant/`): `config.js` (name, budgets, model chain), `llm.js`/`chain.js`/`providers/openaiCompat.js` (free Groq `gpt-oss-120b` → `qwen3.8-27b` → Cloudflare `gpt-oss-120b` → Groq `gpt-oss-20b`; none trains on our data; a per-minute limit ≤ 8 s is waited out), `prompt/core.md` (~1k tokens) + guides in `backend/knowledge/*.md` read on demand (`read_guide`), typed read tools (`dues`, `customer_summary`, `period_summary`, `find`) built on the dashboard/customer code, `run_query` as the SQL fallback (SELECT-only role + `db/sqlGuard.js` + LIMIT 200 + 5 s).
- **Cards** (`actionKit/`): propose = the real command in a rolled-back transaction (catches every refusal, gives the after-figures) → row in `assistant_actions` (15 min) → SSE `action` event → card. Confirm locks the row, re-checks the action's fingerprint, runs the command once. "Open in form" pre-fills the real form and records what the person changed.
- **Budgets (Groq free = 8k tokens/min/model):** core + tool declarations ≤ 2k tokens, each guide ≤ 800 — tests fail above them.
- **Adding a feature to Sage:** (1) make its save a command in `src/commands/` and list it in `src/commands/index.js`; (2) add `src/assistant/actions/<name>.js` with `defineAction` (input, resolve, preview, toCommandInput, fingerprint if it depends on changing figures, links, ≥ 3 evals); (3) add or update its guide in `backend/knowledge/`; (4) remove its routes from `src/assistant/screenOnly.js`. The contract test fails until each step is done; a new write endpoint fails it until it is covered or listed screen-only.
- **Checking quality:** `cd backend && NODE_ENV=test node scripts/assistant-eval.js --gate` (local test DB, real free model, ~120k tokens). **Learning:** `NODE_ENV=production node scripts/assistant-report.js --since <date>` lists cancelled / failed / changed-in-form cards — turn them into evals and guide fixes.
- Env: `GROQ_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `ASSISTANT_DB_URL`. The display name is set only in `backend/src/assistant/config.js` and `frontend/src/app/assistant.js`. **Maintenance rule: a change to a screen updates its guide in the same commit.**
```

Run: `/usr/bin/grep -n "Jarvis" HANDOFF.md`
Expected: only historical lines in older "State"/sub-project sections. They describe the past, so leave them.

- [ ] **Step 2: Restore a fresh copy of production into the local copy**

```bash
cd backend && set -a && . ./.env && set +a
/opt/homebrew/bin/pg_dump "postgresql://$DB_USERNAME:$DB_PASSWORD@$DB_HOSTNAME:$DB_PORT/$DB_NAME?sslmode=require" --no-owner --no-privileges > ~/yars-full-backup-$(date +%F)-sage.sql
docker start yars-uxcopy
docker exec yars-uxcopy psql -U yars -d postgres -c "DROP DATABASE IF EXISTS yars_uxcopy" -c "CREATE DATABASE yars_uxcopy"
docker exec -i yars-uxcopy psql -U yars -d yars_uxcopy -q < ~/yars-full-backup-$(date +%F)-sage.sql
NODE_ENV=test DB_HOSTNAME=localhost DB_PORT=5434 DB_NAME=yars_uxcopy DB_USERNAME=yars DB_PASSWORD=yars npx sequelize db:migrate
NODE_ENV=test DB_HOSTNAME=localhost DB_PORT=5434 DB_NAME=yars_uxcopy DB_USERNAME=yars DB_PASSWORD=yars node scripts/create-user.js uxdemo ux-demo-pass-1 "UX Demo"
```

Expected: the dump completes; the restore prints no errors that stop it; `20261001000001-create-assistant-actions: migrated`; `uxdemo` is created.
- This backup is also the pre-deploy backup.
- The `.env` exports above are only for `pg_dump` in this shell. Never run the migrate line without the explicit `DB_*` overrides.

- [ ] **Step 3: Run the app locally on that copy**

```bash
cd backend && export $(/usr/bin/grep -E '^(GROQ_API_KEY|CLOUDFLARE_ACCOUNT_ID|CLOUDFLARE_API_TOKEN)=' .env | xargs) && NODE_ENV=test DB_HOSTNAME=localhost DB_PORT=5434 DB_NAME=yars_uxcopy DB_USERNAME=yars DB_PASSWORD=yars ASSISTANT_DB_URL=postgres://yars:yars@localhost:5434/yars_uxcopy PORT=5055 node src/server.js
cd frontend && VITE_API_URL=http://localhost:5055/api npx vite --port 5173 --strictPort
```

(Both run in the background.) Expected: the server logs that it is listening on 5055, and Vite serves on 5173.

- [ ] **Step 4: Walk through as a person would (390 px and desktop, dark and light)**

Log in as `uxdemo`. In the chat, check each of these:
1. **"Who owes me the most?"** The answer's top customer and amount equal the dashboard's To collect list.
2. **"How much did <a real customer> pay this month?"** Matches the customer page.
3. **"What were sales last month?"** Matches the dashboard period card for Last month.
4. **"<customer with one due order> paid 500 by UPI":**
   - The card shows Due before → after.
   - Confirm. The order page shows the payment, and History shows "Payment ₹500 recorded … via Sage".
   - Tapping Confirm again changes nothing.
5. **A customer name that matches two customers:** Sage asks which one.
6. **"New order for <customer>: 10 kg of <size with a rate>, <plate>":**
   - The card's total equals the order form's total after "Open in form".
   - Save in the form, then check the card's state after reopening the conversation.
7. **"Add customer <new name>"** → Cancel. The card says Cancelled; nothing is saved.
8. **"Mark <order> delivered"** → Confirm. The order shows Delivered.
9. **"Delete <order>":** no card; Sage answers with a link to the order.
10. **An expired card:** run `docker exec yars-uxcopy psql -U yars -d yars_uxcopy -c "UPDATE assistant_actions SET expires_at = now() - interval '1 minute' WHERE status = 'pending'"`, reopen the conversation; the card says Expired and has no Confirm.
11. **Old Jarvis conversations** open and can be continued.

Each check must pass. A wrong figure is a stop-and-fix (systematic-debugging), not a note.

- [ ] **Step 5: Full test runs**

Run: `cd backend && npm test 2>&1 | tail -5; cd ../frontend && npm test 2>&1 | tail -4 && npm run lint 2>&1 | tail -3`
Expected: everything passes, and lint reports 0 errors.

- [ ] **Step 6: Final whole-branch review**

Dispatch a reviewer (`model: "fable"`) on `git merge-base feature/ux-redesign-2 HEAD..HEAD` with the spec, this plan and this Review Focus. Re-grade its findings by effect:
- Critical and Important findings get one TDD fix pass, each fix RED→GREEN with a green suite.
- Minor findings are ledgered as deferred.

- [ ] **Step 7: Commit the docs**

```bash
git add HANDOFF.md
git commit -m "docs: handoff — Sage, commands, and how to add a feature to the assistant

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Deploy (the owner runs the migration)**

**Before anything, delete `frontend/public/harness.html` if it exists.**

1. **Backup:** done in Step 2 (`~/yars-full-backup-<date>-sage.sql`). Re-run `pg_dump` if more than an hour has passed.
2. **Migration — the owner runs it:** `cd backend && NODE_ENV=production npx sequelize db:migrate`. It creates `assistant_actions` only. It must run **before** the backend deploy, because the new code reads that table when a conversation opens.
3. **Backend:**
   ```bash
   cd backend && gcloud builds submit . --tag asia-south1-docker.pkg.dev/yars-dashboard/yars-backend-repo/yars-backend --project yars-dashboard --account dk7696822@gmail.com
   CF_ID=$(/usr/bin/grep -E '^CLOUDFLARE_ACCOUNT_ID=' .env | cut -d= -f2-) CF_TOKEN=$(/usr/bin/grep -E '^CLOUDFLARE_API_TOKEN=' .env | cut -d= -f2-) && gcloud run deploy yars-backend --image asia-south1-docker.pkg.dev/yars-dashboard/yars-backend-repo/yars-backend --region asia-south1 --project yars-dashboard --account dk7696822@gmail.com --update-env-vars "CLOUDFLARE_ACCOUNT_ID=$CF_ID,CLOUDFLARE_API_TOKEN=$CF_TOKEN" --remove-env-vars GEMINI_API_KEY,MISTRAL_API_KEY
   ```
   Expected: a new revision serving 100 % of traffic. Note its name; the rollback target is `yars-backend-00021-fll`.
4. **Frontend:** `cd frontend && npm run build && /usr/bin/grep -rl "localhost" dist || echo "no localhost in build"; npx firebase-tools deploy --only hosting --project yars-dashboard`
5. **Verify:**
   - `cd backend && NODE_ENV=production node scripts/dashboard-verify.js` prints ✅.
   - `curl -s -o /dev/null -w "%{http_code}" https://<service-url>/api/assistant/actions/00000000-0000-4000-8000-000000000000` prints `401`.
   - Ask the owner to try one question and one card on production. Claude can't log in to the live app.
6. **Rollback if needed:**
   - `gcloud run services update-traffic yars-backend --to-revisions yars-backend-00021-fll=100 --region asia-south1 --project yars-dashboard --account dk7696822@gmail.com`
   - Then `npx firebase-tools hosting:rollback --project yars-dashboard`. The new table can stay; old code ignores it.
