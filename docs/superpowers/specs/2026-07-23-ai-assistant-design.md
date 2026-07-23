# AI Assistant Module — Design Spec

_Date: 2026-07-23. Status: approved design, pre-implementation._
_Sub-project 2 of 2. Depends on auth (`2026-07-23-auth-design.md`) shipping first._

## What it is

A new module: a chat assistant inside the app that can

1. **Answer data questions** from the live database ("how much pending payment from X?",
   "which items are below reorder level?") — read-only.
2. **Explain the app** — features, domain terms (stock issue vs adjustment, FIFO, wastage),
   and step-by-step UI walkthroughs ("how do I record wastage?") from a curated knowledge base.
3. **Deep-link** into the app — answers can include tappable links to the relevant screen.

Model: **Gemini 2.5 Flash** (free tier; key `GEMINI_API_KEY` in env). Two users, mobile-first.

## Explicit decisions (settled during design)

| Decision | Choice |
|---|---|
| Data access | Single read-only SQL tool (agent writes SELECTs); no predefined per-question tools |
| Knowledge base | Markdown files in repo → system prompt; **no vector DB, no embeddings** |
| Auth | Behind the new app-wide JWT auth (sub-project 1) |
| UI | Dedicated Assistant page + floating button on all screens |
| History | Persisted in Postgres with list/resume/delete |
| Transport | **SSE streaming from day one** (ChatGPT-style typing + progress lines) |
| Writes | None. The assistant can never mutate data (v1 and until explicitly revisited) |

## Architecture

```
frontend (chat UI) ──POST /api/assistant/…/messages (fetch + ReadableStream)──▶ backend
                                                                                  │
                                              agent loop (max 6 tool rounds)      │
                                              Gemini 2.5 Flash ◀──REST──▶ assistantService
                                              run_query tool → read-only PG role → Supabase
                                              system prompt = instructions + schema + knowledge/*.md
```

### Backend

New module following existing conventions (controller + routes + service):

- `assistantController.js`, routes mounted at `/api/assistant` (behind auth middleware).
- **Endpoints:**
  - `GET  /conversations` — list (id, title, updatedAt), newest first, server-side pagination
    via existing `utils/pagination.js`.
  - `POST /conversations` — create empty conversation.
  - `GET  /conversations/:id` — full message history.
  - `DELETE /conversations/:id` — soft delete (`is_archived`, consistent with app conventions).
  - `POST /conversations/:id/messages` — send a user message; responds with **`text/event-stream`**.
- **Agent loop** (`assistantService.js`): calls the Gemini REST API (`streamGenerateContent`)
  with system prompt + history + tools; executes tool calls; loops until a final text answer
  or the round cap (6) is hit. Gemini text deltas are forwarded to the client as they arrive.
- **SSE event protocol** (server → client):
  - `status` — progress line, e.g. `{"text": "Looking at the database…"}` when a tool round starts.
  - `delta` — a chunk of assistant text.
  - `done` — final message persisted; carries `{ messageId, conversationId, title? }`.
  - `error` — human-readable failure; client renders it in the chat.
  - Client uses `fetch()` + `ReadableStream` (not `EventSource` — it can't send the
    Authorization header or POST bodies). Cloud Run supports HTTP response streaming.

### The `run_query` tool (security-critical)

Three independent layers; all must hold:

1. **Dedicated Postgres role** on Supabase (e.g. `yars_assistant_ro`) with `SELECT`-only
   grants on application tables (no grants on future write paths, no `pg_catalog` beyond
   defaults needed). The assistant's DB client is a **separate pg connection/pool** using
   this role — credentials in `ASSISTANT_DB_URL` env var. Even a validation bypass cannot write.
2. **Statement validation** in code: exactly one statement; must begin with `SELECT` or `WITH`;
   reject semicolons beyond a trailing one and any write/DDL keywords as top-level tokens.
3. **Resource caps**: auto-wrap with `LIMIT 200` when no limit present; `statement_timeout`
   ~5s on the assistant connection; tool result truncated to a max character size before
   being returned to the model.

Setup of the role is a one-time manual SQL step against Supabase, scripted in
`backend/scripts/` and run at rollout (with the standard pg_dump-first policy — though this
step is grants-only, no data change).

### System prompt & knowledge base

- `backend/knowledge/` — one markdown file per module: `dashboard.md`, `customers.md`,
  `orders.md`, `invoices.md`, `payments.md`, `expenses.md`, `inventory.md`, `routes.md`
  (route map for deep links), `schema.md` (tables, columns, relationships, and the quirks:
  DECIMAL-returned-as-string, `is_archived` soft deletes, paginated vs fetch-all modules).
- Written at **walkthrough detail**, derived from the actual frontend JSX: screen names,
  button labels, field names, ordered steps, and domain-term definitions.
- At request time the files are concatenated (cached in memory with mtime check) into the
  system prompt together with behavioral instructions (answer from tools not memory; use
  markdown links to app routes for navigation; say "I can't find that" rather than guess;
  currency is INR; be concise for phone screens).
- **Maintenance rule** (to be added to HANDOFF.md): any PR that changes a screen's UI updates
  that module's knowledge file in the same commit.

### Persistence

Two tables (migrations, UUID PKs, `underscored`, consistent with app conventions):

- `assistant_conversations` — `id`, `title` (generated from the first user message, by
  truncation in v1), `is_archived`, timestamps.
- `assistant_messages` — `id`, `conversation_id` FK, `role` (`user` | `assistant`),
  `content` (TEXT, markdown), `created_at`. Tool calls/results are **not** persisted in v1 —
  only the user text and the final assistant text. (History replayed to Gemini is therefore
  text-only, which is sufficient context and keeps tokens down.)

The user message is saved on receipt; the assistant message is saved when the stream
completes. If generation fails mid-way, the user message stays, an `error` event is sent,
and no partial assistant message is persisted.

### Frontend

- **Assistant page** (`/assistant`): conversation list (mobile-first) → chat view.
  Chat view: message bubbles, markdown rendering, deep-link buttons (markdown links whose
  href starts with `/` render as tappable in-app navigation buttons via react-router),
  typing indicator + streamed text, status lines shown as subtle italic progress text,
  input bar fixed at bottom (safe-area aware at 390px).
- **Floating button** on all other screens (bottom-right, above any existing FABs) that
  navigates to `/assistant`, resuming the most recent conversation.
- New `assistantAPI.js` service: axios for CRUD, `fetch` for the streaming endpoint
  (attaching the same Bearer token).
- Existing UI conventions respected (custom Dropdown, single-page-title pattern).

## Error handling

- Gemini 429/5xx → `error` event: "The assistant is busy right now — try again in a minute."
- SQL errors from `run_query` → returned to the model as tool output so it can correct its
  query (counts toward the 6-round cap).
- Round cap hit → the model is asked to answer with what it has; if impossible, honest failure.
- Stream interrupted client-side (navigation/refresh) → server finishes and persists the
  assistant message anyway; user sees it on resume.

## Testing

Lean policy — cover what can break:

- **SQL guard unit tests** (the security boundary): allowed SELECT/WITH forms; rejected
  INSERT/UPDATE/DELETE/DDL/multi-statement/comment-smuggling cases; LIMIT injection.
- Agent-loop unit test with a mocked Gemini client (tool round-trip + round cap).
- Conversation CRUD test against the Dockerized test DB.
- Existing suite stays green. UI verified by manual phone walkthrough (390px).

## Rollout

1. Create the read-only Postgres role on Supabase (scripted, grants only).
2. Migrate production (pg_dump first).
3. Deploy backend with `GEMINI_API_KEY` + `ASSISTANT_DB_URL` on the Cloud Run service.
   The Gemini key will be **rotated** first (it passed through chat/shell during setup).
4. Deploy frontend. Verify end-to-end on the phone.

## Out of scope (v1)

- Any write/mutation capability for the assistant.
- Vector search / embeddings (revisit only if the knowledge base grows ~100× — unlikely).
- Voice input, images, file uploads.
- Cross-conversation memory ("remember that…").
- Guided on-screen tours (spotlight overlays) — described steps + deep links only.
