# UX Redesign — Sub-project 1: Foundation + Money Screens — Design

_Date: 2026-09-30 · Status: approved in brainstorming, awaiting spec review_
_Part 1 of 3 (2 = Expenses, History, Catalog · 3 = Stock screens, Login/Assistant re-theme)._
_Release: nothing ships until all three are done, then ONE combined release with the dashboard (`feature/dashboard-redesign`)._

## Goal

Bring the dashboard's UX standard to the screens used every day — Orders,
Order details + payments, the order form, Customers, the customer form and
Invoices — on one shared component kit, with the confirmed data bugs fixed and
a fast, scalable client. **No figure may be shown incorrectly** (same contract
as the dashboard).

## Grounding (UX walkthrough on a local copy of production, 2026-09-30)

- Orders list: ~1½ orders per phone screen (246 orders); balance hidden behind
  "View Details"; per-row delete; summary counts cancelled orders.
- Order details: first screen is contact info; money and "Record payment"
  several scrolls down. Payment form defaults to "Advance".
- Order form: one long column; 114-customer dropdown without search; rare
  fields up front; required dropdown errors invisible; 12.25 kg rejected
  (`step="0.1"`).
- Customers: one customer per screen; no dues, last order or call; customer
  page matches orders by **name substring** (e.g. "Veerbhadreshwar" shows
  "Sri Veerbhadreshwar" and "Veerbhadreshwar Garments" orders, with delete).
- Customer form: decorative icons, email before phone, no keypad/validation,
  no duplicate warning, error shown twice.
- Invoices: all 31 "Pending" though 24 fully paid; 26 have payments not linked
  to the invoice; "Total Payable" excludes tax (1 taxed invoice); Cancel on the
  status dialog crashes the page; generate form shifts dates a day (UTC);
  three different "due" figures.
- History: "impact" after-figures computed before the payment commits (+₹0).
- Navigation: bottom bar has Stock (unused) but hides Expenses/Invoices; Dues
  not in the menu.
- Client: every list fetches all rows; single 500 KB+ bundle; ~1,700 lines of
  legacy CSS (`dark-theme.css` restyles every input/table/card); duplicate
  primitives; ~20 dead files.

## Decisions (from brainstorming)

| # | Decision |
|---|---|
| 1 | Split into 3 sub-projects, one combined release at the end. |
| 2 | **Orders list = compact rows grouped by day** (A): customer + "size · qty · status"; total + "Due ₹X" (red) or "Paid ✓" (green); chips All · Due · In progress · This month; summary line; no per-row delete. |
| 3 | **Order details = tabs** (B): money card (total, received, **Due**, progress, **＋ Record payment**) above tabs **Items · Payments (n) · Details**; status as tappable chips; customer row with Call/WhatsApp; Edit/Invoice/Delete in ⋯ (Delete confirms). |
| 4 | **Payment sheet**: amount with number keypad and "Full due" quick-fill; method Cash/UPI/Bank/Cheque; date defaults today; reference/note folded; **type derived** (amount ≥ due → FINAL, else PARTIAL; an amount above the due shows a warning before saving); Advance and Refund are explicit separate actions. |
| 5 | **Order form = three steps** (1 Customer & date → 2 Items → 3 Plate, extras & review) with a **Back button on every step**, tappable progress bar to jump back, data kept when going back, "Edit" per section on review; always-visible total + next/save bar; searchable customer picker (recent first, shows dues, quick-create); size picker shows prices; live line amount (+ ≈ kg for pieces); "More options" folds custom plate charge / round-off / advance / status. |
| 6 | **Customers = A–Z directory** (B): letter index; row = avatar, name, last order + order count, due in red or "Paid up", Call; chips All · Owe money; search by name **or phone**. |
| 7 | **Customer page**: owes + oldest-unpaid age, total business / received / orders, **New order · Call · WhatsApp remind**, tabs Orders (Unpaid / Paid) · Payments · Details; only this customer's orders (by id). |
| 8 | **Customer form**: name first with **similar-name warning** (open existing instead); mobile with +91, number keypad and validity tick (optional but prompted); City/area (optional); "More details" = email, full address, **GSTIN** (new optional fields in `metadata`); sticky Save. **Quick-create sheet** (name + mobile) inside the order flow returns to the order with the customer selected. |
| 9 | **Invoices**: list rows (number · customer · date · due date; total + Due/Paid ✓; Overdue in red; chips All · Unpaid · Overdue); invoice page mirrors Order details (money card, Share PDF · ＋ Payment · WhatsApp remind, tabs Items · Payments · Details; Cancel in ⋯ with confirm); **new invoice = 3 steps** (Customer → Orders, unbilled pre-ticked, billing period from orders, GST toggle → Review) with Back. |
| 10 | **Invoice money rule**: `due = final_amount (incl. tax) − Σ payments on the invoice's orders` (all types incl. advance, refunds subtracted — same netting as `orderMath.paymentPosition`, plus the advance column where it applies); status derived: CANCELLED (manual) › PAID (due ≤ 0) › OVERDUE (past due date) › PENDING. "Mark as paid" removed. Same figure on list, page and PDF. |
| 11 | Bottom bar **Home · Orders · Customers · Expenses · More** (More: Dues, Invoices, Stock, …); desktop sidebar grouped Sales · Money · Stock · Setup; header titles from route metadata. |
| 12 | Server state via **TanStack Query**; pages code-split; lists paged server-side (30/page, infinite scroll). |

## 1. Server changes

**New endpoints** (JWT-protected; old endpoints kept until no caller remains):

- `GET /api/orders/list?search=&chip=all|due|in_progress|this_month&from=&to=&status=&page=&limit=`
  → `{ rows:[{ id, orderDate, customer:{id,name}, status, itemsSummary, total, received, due, cancelled }], page, hasMore, summary:{ count, total, due } }`.
  Totals/due via `orderMath` (paise); `summary` **excludes CANCELLED**; search
  matches customer name or size label (ILIKE); ordered by `order_date desc,
  created_at desc`; IST for "this month".
- `GET /api/customers/directory?search=&owe=1&page=&limit=` → rows
  `{ id, name, phone, city, due, ordersCount, lastOrderDate }` A–Z; search name
  or digits-in-phone; `owe=1` → due > 0 ordered oldest-due first.
- `GET /api/customers/:id/summary` → `{ customer, owes, oldestUnpaidDays, totalBusiness, received, orders:[{…, due}], payments:[…] }` — by `customer_id`.
- `GET /api/customers/similar?name=` → up to 5 live customers whose name
  contains or is contained in the input (case/space-insensitive), with dues.
- `GET /api/invoices/list?chip=all|unpaid|overdue&page=` and invoice detail
  include `{ amountPaid, amountDue, derivedStatus }` from the rule in Decision 10;
  PDF prints the same `amountDue`.

**Behaviour changes:**
- **Refunds** (`payment_type = 'REFUND'`) *reduce* received — in
  `orderMath.paymentPosition` (both sides + vectors), dashboard
  `receivedInRange`, and Jarvis canonical SQL (`schema.md`). 0 refunds exist today.
- **Advance** is set only at order creation (creates the ADVANCE payment row,
  as today); order **edit no longer changes advance** (removes the
  overwrite-the-wrong-row risk). Further advances are recorded as explicit
  ADVANCE payments.
- **History impact**: `after_metrics` computed inside the same transaction
  (payment hooks pass `options.transaction` to `calculateOrderMetrics`).
- **Customer metadata**: `city`, `gstin` accepted/returned (optional, trimmed;
  GSTIN validated as 15-char format when present). No migration (JSONB).

**Fixes:** customer page by id; invoice status dialog close prop; IST dates
everywhere (shared helper, no `toISOString().split`); kg inputs accept any
value with up to 2 decimals (the `DECIMAL(10,2)` column — a 3rd decimal shows a
visible message instead of being silently rounded), pieces are whole numbers;
required pickers show visible errors.

## 2. Frontend architecture

- **Component kit** `frontend/src/ui/` on the theme tokens: Button, IconButton
  (label required), Chips, Field, TextInput, MoneyInput, QtyInput (inputmode
  decimal, `step="any"`, parse without NaN), PhoneInput (+91, validity),
  DateChips, SearchPicker (searchable sheet), PageHeader, Tabs, Sheet/Dialog/
  ConfirmDialog (portal, focus management, Escape), StickyFooter, Stepper
  (Back, tappable progress, per-step validation), GroupedList (day groups,
  infinite scroll), Row, MoneyText/QtyText (only way figures print),
  StatusBadge (single enum map), EmptyState/ErrorState/Skeleton.
- **Data**: `@tanstack/react-query` — query keys per resource, infinite
  queries for lists, mutations invalidate order/customer/invoice/dashboard
  keys so every screen updates after a payment. Existing axios `api` client and
  auth interceptors stay; queries wrap it.
- **Performance**: `React.lazy` per route + vendor chunk split; memoised rows;
  no calculations in render loops; GPU-only animations; reduced-motion
  respected. Measured before/after: bundle sizes (build output) and Orders-list
  render counts while scrolling (React Profiler).
- **Legacy isolation**: legacy CSS scoped under `.legacy` wrapper applied to
  not-yet-migrated pages; each migrated page deletes its old files/CSS; dead
  files from the audit removed as their consumers go.
- **Navigation**: BottomNav (5 items per Decision 11, "More" sheet incl.
  Dues/Invoices/Stock), grouped Sidebar, route-driven titles.

## 3. Screens (per Decisions 2–9)

Orders list · Order details (+ payment sheet, Advance/Refund actions) · New/Edit
order (3 steps) · Customers directory · Customer page · New/Edit customer
(+ quick-create) · Invoices list · Invoice page · New invoice (3 steps).
Every list/state: skeleton, empty (with next action), error (with retry).
Money right-aligned, tabular, exact ₹ (Indian grouping). Destructive actions
never adjacent to primary actions; always confirmed.

Jarvis knowledge (`orders.md`, `payments.md`, `invoices.md`, `customers.md`,
`routes.md`) updated in the same tasks as the UI.

## 4. Testing, verification

- Backend (Jest): new endpoints (paging, search name/phone, owe filter,
  cancelled excluded, id matching), invoice due/status rule (tax, later
  payments, overdue, cancelled), refunds negative across orderMath/dashboard/
  SQL, history after-metrics, edit keeps advance rows.
- Frontend (Vitest): IST date helper, Money/Qty parsing, phone validity,
  derived payment type, stepper logic, similar-name matching.
- Extended read-only cross-check (`dashboard-verify.js`): dashboard, orders
  list summary, directory totals and invoice due agree to the rupee; reports
  invoices changing Pending → Paid and the taxed invoice's corrected due, and
  flags any order that sits on more than one non-cancelled invoice (would
  double-count payments; none expected).
- Walkthrough on the local production copy (390px + desktop, dark + light,
  all flows); bundle/render measurements; independent Fable 5 review.

## Out of scope (later sub-projects)

Expenses, History screens, Plate Types / Product Sizes (sub-project 2); Stock,
Items, Purchase Orders, Issues, Suppliers, categories/attributes, Login and
Assistant re-theme, final legacy CSS removal (sub-project 3).
