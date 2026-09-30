# UX Redesign — Part 2: Every Remaining Page — Design

_Date: 2026-09-30 · Status: approved in chat ("yes looks right, write the spec and deploy when done")_
_Follows part 1 (`2026-09-30-ux-redesign-1-core-design.md`, deployed). Branch `feature/ux-redesign-2` off `feature/ux-redesign`._

## Goal

Every page and component uses the Midnight Forest & Brass kit; nothing renders
through the old stylesheets or old shared components. When done, the `.legacy`
wrapper, `dark-theme.css`, `select-override.css`, `button-override.css`,
`datepicker-*.css`, and `history-animations.css` / `page-animations.css` once no
class from them is used (checked by grep), `components/common/*`, the old `components/ui/*`,
`react-datepicker` and `react-icons` are gone.

## Constraints

- **Screens only.** Every page reuses its existing endpoint and payload. No
  change to stock / receiving / issuing / expense / audit logic or schema.
- Same patterns as part 1: kit in `src/ui/`, features in `src/features/<area>/`,
  TanStack Query hooks, lazy routes, route meta titles, India dates
  (`todayIST`), `parseNumber` for every number input, `inr`/`Money` for ₹,
  destructive actions only under ⋯ or at the end of an edit form and always
  confirmed, sticky save bar, Back on every step of multi-step forms.
- Logic (filters, grouping, form validation, payload building, labels) lives in
  pure modules with Vitest tests written first.
- Deploy when done (backend: Jarvis knowledge docs and the audit date filter).

## Current data (production copy)

Expenses 419 · expense categories 9 · history entries 728 · inventory items 1 ·
purchase orders 0 · stock issues 0 · suppliers 1 · inventory categories 5 ·
item attributes 3 · Jarvis conversations 12. Loading full lists is fine at these
sizes; paging stays where the API already pages.

## 1. Expenses (`/expenses`, `/expenses/new`, `/expenses/edit/:id`, `/expense-categories`)

- **List:** rows grouped by day (bill date): description, vendor · category,
  amount right-aligned, "Unpaid" tag when not paid. Chips **This month · Last
  month · All · Unpaid**; category chips (horizontal); search (description or
  vendor). Total card for the filtered set: total ₹, count, unpaid ₹. ⋯ →
  Download Excel (same export params as today). Tap row → edit.
- **Form (new/edit):** bill date (DateField), category (picker sheet with "＋ New
  category" inline), description, vendor, quantity × unit cost → total shown read-only (the server recalculates
  the total from quantity × cost on every save, so an edited total would not be
  kept), paid/unpaid choice. Delete at the end of edit (confirm).
- **Categories:** `/expense-categories` becomes a simple list page (name only) with add / rename / delete (confirm);
  also reachable from the Expenses ⋯ menu. Old create/edit category routes
  redirect to it.

## 2. History (`/history`)

- Timeline grouped by day, newest first. Each entry is one plain sentence built
  from the audit row: "Payment ₹5,000 recorded · Bombay Saree Centre",
  "Payment edited ₹400 → ₹500", "Order status Pending → Delivered",
  "Order deleted", "Stock issued · 3 items", etc., plus the order's figures
  before → after when present (Received / Due). Chips **All · Payments · Orders
  · Stock**; date range chips (This month / Last month / All). Tap → the order
  (or customer) when the entry has one.
- A pure `describeAudit(row)` makes the sentence; unknown shapes fall back to
  "<Entity> <action>" so nothing is hidden.
- The server's audit date filter read dates as UTC days; it is fixed to India
  days (read-only query change) and accepts a comma list of entity types so
  the Stock chip is one paged list.

## 3. Stock & purchasing

- **Stock (`/stock`):** summary card (stock value, low-stock count, received and
  consumed this month from `/stock/summary`); rows: item, category, on hand
  (qty + unit), value, "Low" tag; chips **All · Low stock**; search; ⋯ → Export.
- **Item stock (`/stock/:itemId`):** card (on hand, value, reorder level);
  tabs **Batches** (FIFO batches: received date, remaining / received, rate) ·
  **Movements** (paged) · **Details**.
- **Items (`/inventory-items`, new, edit):** list rows (name, category,
  unit, reorder level) + full form (name, category picker, unit, reorder level,
  attribute values) — like Sizes.
- **Item categories (`/inventory-categories`) and attributes
  (`/item-attributes`):** list pages with inline add / rename / delete; an
  attribute row expands to its values (add / rename / delete).
- **Purchase orders (`/purchase-orders`):** rows: PO number · supplier, date,
  status tag, ordered vs received. **New PO** = 3 steps with Back: Supplier →
  Lines (item picker, quantity, rate; live line amount) → Review. **PO page:**
  card (total, status), tabs Lines (ordered / received per line) · Receipts ·
  Details; ⋯ Cancel (confirm) / Delete (confirm, only where the API allows);
  **Receive material** keeps its route (`/purchase-orders/:id/receive`) as a
  redesigned page: quantity-to-receive per open line (pre-filled with what is
  still open), received date, reference; Back and a sticky save bar.
- **Stock issues (`/stock-issues`, new):** rows grouped by day (type tag Issue /
  Wastage / Adjustment, items count, order link when present); form: type, date,
  order (optional picker), lines (item picker + quantity, showing stock on
  hand), reason.
- **Suppliers (`/suppliers`, new, edit, detail):** directory rows (name, phone,
  PO count); form like the customer form (name, mobile, email, address, GSTIN);
  supplier page: contact card with Call / WhatsApp, tabs Purchase orders ·
  Details.

## 4. Shell and cleanup

- **Login:** centred brass card on canvas; username, password with show/hide,
  clear error text, Enter submits.
- **Jarvis (`/assistant`):** chat on the new tokens — conversation list in a
  sheet (phone) / side column (desktop), message bubbles, markdown answers,
  composer pinned to the bottom, suggestion chips when empty. Same API.
- **Not found:** plain message + links to Home and Orders.
- Theme toggle, toasts, ProtectedRoute spinner re-themed on tokens.
- Remove `Legacy` wrapper, all legacy CSS files and old component folders, the
  `react-datepicker` and `react-icons` dependencies (after `grep` shows no
  importer). Build must show no import of them.

## Testing and verification

- Vitest for every pure module (expense filters/grouping/totals, expense form,
  audit descriptions, stock row labels, PO draft/validation/payload, receive
  validation, stock-issue draft, supplier form, category/attribute names).
- Backend suite must stay green (no backend logic changes).
- Walkthrough on the production copy at 390px and desktop, dark and light: every
  list, every form save, every delete confirm; old routes redirect correctly.
- Final Fable 5 review, then deploy (backup → backend → frontend → verify).

## Out of scope

New server endpoints, schema changes, changing how stock is valued or issued.
