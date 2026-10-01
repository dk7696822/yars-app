# Sage — an assistant that can act — Design (phase 1)

_Date: 2026-10-01 · Status: design approved in chat, spec awaiting review_
_Branch `feature/sage-actions` off `feature/ux-redesign-2`._

## Goal

Turn the read-only assistant (today "Jarvis") into **Sage**: it answers
questions about the business as today, and it can also **record payments,
create customers, create orders and change an order's status** from plain
English — always as a proposal that a person confirms. Built so that adding the
next feature to Sage is one action file plus one guide file, with tests that
fail when a new feature is forgotten.

## What the owner asked for (binding)

- Zero spend. Free model tiers only.
- English only (questions and answers). No Hindi/Hinglish support needed.
- Only providers that do **not** train on our data (option A): no Gemini, no
  Mistral free tiers.
- Sage never deletes. A delete request gets a link to the record's screen.
- Scalable and well-architected: a new feature can be added to Sage's
  context easily; best coding practice throughout.
- Rename "Jarvis" to "Sage"; the name must be one setting.
- Little to no lag.
- Standing rule: never show incorrect data.

## Decisions and why

| Question | Decision | Why |
|---|---|---|
| RAG / vector search | No | Data is relational; SQL answers exactly. The ~50 KB of guides are split and loaded on demand instead. |
| Tools, skills or training | Typed tools + on-demand guides ("skills"); no fine-tuning | Fine-tuning costs money, needs thousands of examples, and is lost when the model changes. |
| MCP / "code mode" | No | One app, one agent: in-process typed tools have no extra hop. Code mode is too risky with small free models. |
| WebSocket | No — keep SSE; Confirm/Cancel are plain POSTs | Streaming is one-way. On Cloud Run an open WebSocket keeps the instance billed and needs session affinity. |
| Who saves data | The server, only after a person taps Confirm | The model can never write. Figures on a card come from the app's own code. |

## Current state (read before changing)

- `backend/src/services/assistant/`: `agentLoop.js` (provider-neutral loop,
  `MAX_ROUNDS = 6`), `providerChain.js` (per-entry cooldown failover),
  `providers/geminiProvider.js`, `providers/openaiCompatProvider.js`,
  `assistantService.js` (one tool, `run_query`), `assistantDb.js` (pool on the
  SELECT-only role `ASSISTANT_DB_URL`), `sqlGuard.js`, `knowledgeLoader.js`
  (concatenates all `backend/knowledge/*.md`, ~50 KB ≈ 12k tokens, into every
  request).
- `assistantController.js`: conversations CRUD + SSE `sendMessage` (events
  `delta`, `status`, `error`, `done`).
- Write logic lives inside controllers (`createPayment`, `createOrder`,
  `updateOrder`, `createCustomer` take `req, res`). The `Order` and `Payment`
  models write audit logs in `afterCreate` / `afterUpdate` hooks.
- Payments always attach to an order or an invoice, never to a customer
  alone. Orders have no order number; the app identifies an order by
  customer, date and sizes.
- Order statuses: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `DELIVERED`,
  `CANCELLED`. Payment methods: `CASH`, `BANK_TRANSFER`, `UPI`, `CHECK`, `OTHER`.
- "Jarvis" appears in 7 files (`routeMeta.js`, `navItems.js`,
  `AssistantPage.jsx`, `MainLayout.jsx`, `index.css`,
  `knowledge/00-instructions.md`, `knowledge/routes.md`) plus `HANDOFF.md`.
- Usage, Jul–Sep 2026: 133 payments, 43 orders, 43 expenses, 9 customers;
  history log is 60 % payment creates. Assistant: 55 messages.
- The current chain lists `gemini-2.0-flash`, which Google has shut down, and a
  non-quota error stops the chain instead of moving to the next model.

## 1. Models

All OpenAI-compatible, so one adapter (`openaiCompatProvider.js`) serves them.

| Order | Model | Provider | Free limit |
|---|---|---|---|
| 1 | `openai/gpt-oss-120b` | Groq | 1,000 req/day, **8,000 tokens/min** (measured 2026-10-01); ~200k tokens/day (docs) |
| 2 | `qwen/qwen3.8-27b` | Groq (own quota) | same as above (measured) |
| 3 | `@cf/openai/gpt-oss-120b` | Cloudflare Workers AI | 10k neurons/day ≈ 150–300k tokens; no per-minute token cap |
| 4 | `openai/gpt-oss-20b` | Groq (own quota) | same as Groq above (measured) |

- Measured on the production Groq key (2026-10-01): the three model IDs
  above exist; `llama-3.3-70b-versatile` (today's Groq entry) no longer
  does. The free tier has **no prompt caching** (a repeated 1.7k-token
  prompt counted in full both times) and is fast (0.65 s for that call).
- The chain lists the models in one config file.
- Env: `GROQ_API_KEY` (already set on Cloud Run), `CLOUDFLARE_ACCOUNT_ID`,
  `CLOUDFLARE_API_TOKEN`. A provider without its key is left out (as today).
  The owner creates the Cloudflare account and token and adds them to
  `backend/.env` (git-ignored); the deploy copies them to Cloud Run.
  `GEMINI_API_KEY` and `MISTRAL_API_KEY` are removed from Cloud Run.
- Removed: Gemini adapter, `@google/genai`, Mistral entries.
- Chain fix: a provider error before the first streamed chunk that is not
  the user's fault (model not found, 5xx, timeout, quota) cools that entry
  down and moves on. Errors after the first chunk still stop (no duplicated
  output).
- **Token budget, set by Groq's 8k tokens/minute:** each round's input stays
  ≤ 3k tokens, so a normal two-round message (~6–7k) fits one model's minute.
  Core instructions + tool declarations ≤ 2k; each guide ≤ 800; the
  conversation history sent is trimmed to the newest messages that fit
  (older ones stay saved, and each card is sent as a one-line summary).
- **Per-minute vs per-day limits are handled differently.** A 429 whose
  `retry-after` is ≤ 8 s waits and retries the same model (keeps one model
  per answer). A longer per-minute wait moves to the next entry with a
  cooldown equal to `retry-after` (no 120 s floor). A daily limit keeps the
  long cooldown.
- Capacity: ≈ 30 messages/day per Groq model × 3 + Cloudflare ≈ 100+ per
  day. When every entry is cooling down, the user sees when it comes back.

## 2. Prompt: small core + guides on demand

- **Core instructions** (`backend/src/assistant/prompt/core.md`, ~1.2k tokens):
  who Sage is, money format, read-only SQL rules, how to use `find`, the
  propose/confirm rules (below), "never say something is saved", "never
  delete — link instead", "English only", and an auto-generated list of
  areas (one line each) and actions.
- **Guides** (`backend/knowledge/<area>.md`) gain a front-matter header:

  ```markdown
  ---
  area: payments
  summary: Recording, editing and refunding payments; how dues are worked out.
  tables: payments, orders
  ---
  ```

  `schema.md` is split so each area's guide holds its own tables. The
  canonical SQL blocks (`<!-- canonical:… -->`, tested by
  `tests/knowledgeQueries.test.js`) move with their area and stay tested.
- **`read_guide(area)`** returns one guide. The model reads the guide for an
  area before writing SQL about it.
- **Prompt budget test:** core instructions + all tool declarations must stay
  ≤ 2k tokens, and each guide ≤ 800 tokens (estimated as characters ÷ 4).
  Fails the suite if exceeded.

## 3. Tools

| Tool | Kind | Does |
|---|---|---|
| `run_query(sql)` | read | As today: SELECT-only role, `sqlGuard`, LIMIT 200, 5 s timeout. |
| `read_guide(area)` | read | Returns one guide. |
| `find(kind, text, …)` | read | `customer` (uses `customerSimilar` scoring plus phone match), `product_size` (label like "12 x 16"), `plate_type`, `order` (a customer's orders, newest first, with due, label = date + sizes). Returns a few compact lines with IDs. |
| `propose_<action>(…)` | action | One per registered action. Returns a one-line summary to the model and a card to the app. |

Every tool is declared once with a Zod schema; the tool declaration sent to
the model is generated from it (`z.toJSONSchema`) and the same schema checks
the model's arguments.

## 4. Actions (the registry)

`backend/src/assistant/actions/<name>.js`, one file per action:

```js
module.exports = defineAction({
  name: "record_payment",
  area: "payments",
  description: "Record money received against one order…",
  input: z.object({ order_id: z.string().uuid(), amount: z.number().positive(), … }),
  resolve: async (input, ctx) => {…},   // load records; throw ActionError for the model to relay
  preview: async (resolved, ctx) => ({ title, rows, warnings }),
  execute: async (resolved, { transaction, actor }) => {…}, // shared save function
  touches: (resolved) => [{ model: "Order", id }],          // for the changed-since check
  formLink: (resolved) => `/orders/${id}?pay=assistant:${actionId}`,
  evals: [ { ask: "Sharma Traders paid 5000 by UPI", expect: { tool: "propose_record_payment", args: { amount: 5000, payment_method: "UPI" } } }, … ],
});
```

`registry.js` loads every file in the folder and generates the tool
declarations, the action index in the core prompt, and the eval set.
**Adding a feature to Sage = one action file + its guide. No app code.**

### Shared save functions

The save logic for the phase-1 actions moves from controllers into
`backend/src/services/writes/`:

- `payments.js`: `createPayment(input, { transaction, actor })`
- `orders.js`: `createOrder(input, { transaction, actor })`,
  `setOrderStatus(id, status, { transaction, actor })`
- `customers.js`: `createCustomer(input, { transaction, actor })`

They throw typed errors (`ValidationError`, `NotFoundError`) instead of
writing HTTP responses. The controllers become thin wrappers that map those
errors to the same status codes and messages as today. The existing backend
suite must stay green with no test changes other than imports.

`actor` = `{ userId, source: "app" | "assistant", actionId? }`. It is
passed through Sequelize options to the model hooks, which add
`source` and `assistant_action_id` to the audit entry's `metadata`. Entries
from screens are unchanged apart from `source: "app"`.

### Phase-1 actions

| Action | Input | Card rows | Rules |
|---|---|---|---|
| `record_payment` | order, amount, method (default Cash), date (default today, India), reference, notes; refund only when asked | Customer · order (date + sizes) · amount · method · date · Due before → after; warning when the amount is more than the due | One customer with exactly one order with money due → that order. Several → Sage lists them with dues and asks. Never splits a payment. Payment type is worked out exactly as the payment sheet does (`paymentTypeFor(amount, due)` and `overpayment` in `frontend/src/features/payments/paymentForm.js`); the rule is ported to `backend/src/services/paymentType.js` with the same test cases on both sides. Refund larger than received → the app's own error. |
| `create_customer` | name, phone, address, GSTIN, notes | Each field; warning "Looks like existing customer X" from `customerSimilar` | Same fields and checks as the customer form. |
| `create_order` | customer, plate type, lines (size, unit kg or pcs, quantity, rate or piece price), order date, advance | Customer · plate · each line with amount · total · advance · due | Same line rules as the order form, including a per-order piece price when the size has none. Totals from `orderMath`. |
| `set_order_status` | order, new status | Order · status before → after · Due before → after when it changes (e.g. Cancelled) | Any of the five statuses, as the order screen's status chips allow (it sends `PUT /orders/:id` with `{ status }`). Same status → "already <status>", no card. |

Anything else ("delete", "edit an expense") → a short reply with a link to
the right screen. Requests for other writes say "I can't do that yet" with
the link.

## 5. Propose → confirm

**Propose** (inside the agent loop when the model calls `propose_*`):

1. Zod check of the arguments; failures go back to the model as a tool error
   so it can ask the user for the missing detail.
2. `resolve` loads the records; unknown or ambiguous → tool error telling the
   model to ask.
3. **Trial run:** `execute` runs inside a transaction that is always rolled
   back. Any error the real save would raise surfaces now. `preview` reads the
   after-figures inside that transaction before the rollback. Phase-1 saves
   have no side effects outside the transaction (no document numbers, no
   files, no external calls); every future action must say so in its file
   (`trialRunSafe: true`) or it skips the trial run and previews from
   `resolve` alone.
4. A row is stored in `assistant_actions` and an SSE `action` event sends the
   card. The model gets: `Proposed <title>. The user must tap Confirm.`

**Confirm** (`POST /api/assistant/actions/:id/confirm`):

1. Lock the row (`SELECT … FOR UPDATE`).
2. Already confirmed → return the stored result (taps are safe to repeat).
   Cancelled / expired → 409 with the reason.
3. Expired (15 min) → mark expired, 409.
4. Every record in `touches` still has the `updated_at` it had at propose
   time → otherwise mark failed: "This order changed after Sage suggested this
   — ask again."
5. Run `execute` for real in one transaction with
   `actor.source = "assistant"`. Mark confirmed, store `result_id` and the
   result link. Errors → mark failed with the message.

**Cancel** (`POST …/cancel`): marks cancelled. **Read**
(`GET …/:id`): returns the card and payload for "Open in form".

### Table `assistant_actions` (additive migration)

`id` uuid · `conversation_id` → assistant_conversations · `message_id` →
assistant_messages, null until the reply is saved · `user_id` · `name` ·
`payload` jsonb (validated input with IDs) · `card` jsonb · `touched` jsonb
(`[{model, id, updated_at}]`) · `status`
(`pending|confirmed|cancelled|expired|failed|completed_in_form`) ·
`result_id` · `error` · `outcome` jsonb (for the learning report) ·
`expires_at` · `created_at` · `updated_at`.

## 6. App (frontend)

- `ASSISTANT_NAME = "Sage"` in one config module; every visible "Jarvis"
  uses it. Route stays `/assistant`. Code identifiers say `assistant`.
- `features/assistant/ActionCard.jsx`: one generic card. It renders `title`,
  `rows` (label, value, optional before → after), `warnings`, and the state:
  - pending: Confirm · Open in form · Cancel, "expires in N min"
  - confirmed: ✓ and a link to the record
  - cancelled / expired: "Ask again"
  - failed: the reason
- The stream client handles the new `action` event. Cards are saved with the
  conversation and render with their current status when it is reopened.
- After Confirm the matching TanStack Query keys are invalidated (orders,
  customers, dashboard, payments) — a map from action `area` to keys.
- "Open in form": the order form (`/orders/new?assistant=<id>`), the customer
  form (`/customers/new?assistant=<id>`) and the payment sheet on the order
  page (`/orders/:id?pay=assistant:<id>`) load the payload and pre-fill. On
  save they send `assistant_action_id`; the server marks the action
  `completed_in_form` and stores what changed in `outcome`.
- Suggestion chips become examples of actions and questions.

## 7. Guard tests (keep the system complete as features are added)

- **Coverage:** walks the Express router; every POST/PUT/PATCH/DELETE
  route must be either the target of a registered action or listed in
  `assistant/screenOnly.js` with a one-line reason. A new write endpoint
  fails the suite until someone decides.
- **Contract:** every action has a guide for its `area`, ≥ 3 `evals`, a Zod
  input, and a `trialRunSafe` decision.
- **Prompt budget:** core + tool declarations ≤ 2k tokens; each guide ≤ 800.

## 8. Learning loop (free, no training)

- Every action's outcome is kept (confirmed as proposed, cancelled, expired,
  completed in form with these fields changed).
- `backend/scripts/assistant-report.js` lists the requests most often
  cancelled or corrected over a period. The owner or a developer turns them
  into new `evals` and guide text.

## 9. Error handling

- Quota on every entry → the existing "free quota used up, try again in …"
  message. Cards already shown still work.
- Model calls a tool with bad arguments → tool error back to the model (it
  asks the user); never a crash.
- `MAX_ROUNDS` stays 6; on the last round tools are withheld (as today).
- Confirm errors are shown on the card; nothing half-saves (one transaction).

## 10. Testing

- **Backend (Jest, Docker test DB):** each shared save function (moved code,
  existing tests); each action's resolve/preview/execute; trial run leaves
  every table unchanged (row counts and a checksum of the touched rows);
  confirm once / twice; expired; changed since proposal; audit metadata
  `source: "assistant"`; chain moves past a 404 model; guard tests above.
- **Frontend (Vitest):** card state logic; area → query keys map; form
  pre-fill mapping from payload.
- **Evals:** `backend/scripts/assistant-eval.js` runs every action's `evals`
  plus read questions, "should ask" cases (two customers with similar names)
  and "should refuse" cases (delete) against a chosen model, and prints a
  pass rate. Run on demand (uses free quota). Gate: the first model in the
  chain passes ≥ 90 % before deploy. If no free model reaches 90 %, stop and
  report instead of shipping.
- Walkthrough on the local copy at 390 px and desktop, light and dark.

## 11. Rollout

1. Backup (`pg_dump`).
2. Owner runs the migration (creates `assistant_actions` only).
3. Owner sets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` on Cloud Run
   and confirms `GROQ_API_KEY` is set.
4. Deploy backend, then frontend. Run `dashboard-verify.js`.
5. Rollback: route Cloud Run traffic to the previous revision; the new table
   is harmless.

`HANDOFF.md` and the guides are updated in the same change.

## Out of scope (later phases, each with its own short spec)

- Phase 2: edit order, edit payment, expenses, stock issue / receive,
  invoices.
- Phase 3: catalog, suppliers, purchase orders, categories, voice input
  (browser speech recognition).
- Deletes through Sage (owner decision: never).
- Live push of changes to other phones.
