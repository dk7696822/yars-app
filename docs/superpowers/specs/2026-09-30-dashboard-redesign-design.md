# Dashboard Redesign — Design

_Date: 2026-09-30 · Status: approved in brainstorming, awaiting spec review_
_Phase 1 of the Midnight Forest & Brass re-theme (Phase 2 = remaining screens, separate spec)._

## Goal

A mobile-first, production-grade Dashboard the owner and his brother open on a
phone to see business health at a glance — **with numbers that are never
wrong**: every figure has one written definition, is computed by the same order
math as the rest of the app, and reconciles to the paisa.

**Primary job:** show money to collect (who owes, how much, how long) and make
chasing it one tap away. **Secondary:** how the business is doing for a chosen
period (sales, collections, kg/pcs, expenses) and trends.

## Grounding: what the data actually holds (production, read-only, 2026-09-30)

| Area | Fact | Design consequence |
|---|---|---|
| Orders | 246 live (May 2025 → Sep 2026), 10–25/month; 11 deleted | Trends are meaningful |
| Status | 240 Delivered, 5 In progress, 1 Completed, 0 Cancelled | No status pipeline — just an "N in progress" count |
| Dues | ₹2,33,320 owed on 26 orders / 18 customers; ₹77,940 is 90+ days old; 0 overpaid orders | Dues + aging + oldest-first list is the hero |
| Payments | 693, all tied to orders, all dated; every advance has a dated ADVANCE row | "Collected in a period" is exact |
| Reconciliation | All-time Sales ₹26,14,607 − Collected ₹23,81,287 = ₹2,33,320 | Built-in check |
| Deleted orders | 3 payments (₹14,456) sit on 2 deleted orders | Excluded from Collected, disclosed |
| Expenses | 419 bills, all PAID, very lumpy (₹3.1L raw material in Sep) | Show by category; **no "profit" figure** |
| Invoices | 31; 208 delivered orders never invoiced | No invoice/unbilled alerts |
| Inventory | 1 item, 0 stock movements | Not on the dashboard |
| Phones | 86/113 customers have a mobile (83 stored as "0" + 10 digits) | Call + WhatsApp work for 86 |

## Decisions (from brainstorming)

| # | Decision |
|---|---|
| 1 | Two kinds of numbers: **"right now"** (dues, aging, list, in-progress) — always all-time; **"for a period"** (sales, collected, kg/pcs, expenses, top sizes, expense categories). |
| 2 | Period chips: **All time · This month · Last month · This FY · Custom**. Opens on **All time** the first time; **last choice remembered per device**. |
| 3 | Top of screen = **money to collect** (hero). |
| 4 | "Collect from" list: **oldest dues first**; row → customer page; **Call**; **WhatsApp reminder** (English, lists unpaid orders, user reviews and sends). |
| 5 | Theme **Midnight Forest & Brass**, **dark by default**; becomes the **whole app's** theme (Phase 2). |
| 6 | Layout **A · Stacked sections**. |
| 7 | Motion via the **Motion** library; charts hand-built SVG (no chart library). No 3D charts. |
| 8 | **Cancelled orders excluded** from dashboard sales and dues, with a visible note when any exist. |
| 9 | Approach: three focused read-only endpoints; order totals via the shared `orderMath`. |

## 1. Number definitions (the correctness contract)

**Scope:** live orders (`is_archived = false`) with **all** their lines — never
dropped because a size, customer or plate type was later archived. Orders with
status `CANCELLED` are excluded and reported (`excluded.cancelled`).
**Money:** order totals and remainders come only from
`backend/src/services/orderMath.js` (`orderTotal`, `paymentPosition`).
**Dates:** all boundaries in **Asia/Kolkata (IST)**; ranges are inclusive dates.
**Rounding:** none in computation; round to paise only for equality checks and
display. Compact display ("₹26.1L") always has the exact value on tap.

| Figure | Definition |
|---|---|
| Order remainder | `paymentPosition(order).remaining`, rounded to paise. `> 0` = owed; `< 0` = credit; `= 0` settled. |
| **To collect** | Σ positive order remainders (as of today). |
| **Credit** | Σ \|negative remainders\| — shown as its own line only when non-zero; never netted into To collect. |
| **Aging bands** | Positive remainders grouped by order age (`today_IST − order_date`): 0–30, 31–60, 61–90, 90+ days. Σ bands = To collect. |
| **Collect from** (per customer) | Σ positive remainders of that customer's orders; count of owed orders; oldest owed order date/age; the owed orders list. Sorted by oldest age desc, then amount desc. Σ list = To collect. |
| **Sales** (period) | Σ `orderTotal` of orders with `order_date` in period. |
| **Collected** (period) | Σ `payments.amount` with `payment_date` in period on live, non-cancelled orders; plus, for any order using only the legacy `advance_received` column (no ADVANCE rows — none today), that advance at its `order_date`. Payments on deleted orders excluded and reported (`excluded.deletedOrderPayments {count, amount}`). |
| **Kg sold / Pcs** | `volumeSummary` over orders dated in period (kg lines + ≈ kg of weighted pieces lines; pieces; pieces without weight). |
| **Expenses** | Σ `total_cost` of live expenses with `bill_date` in period; by category. |
| **Top sizes** | Kg by product size (same volume rule) for the period; top 5. |
| **Comparison** | Same metric over the comparison range (below). Δ% = (cur − prev) / prev. prev = 0 → `"new"`. No comparison for All time. Expenses Δ shown in neutral colour. |
| **Trends** | Last 6 calendar months (current month flagged `partial`): sales, collected, kg per month by the definitions above. |
| **Recent orders** | Latest 5 live orders by `order_date` desc, `created_at` desc; plus count of `PENDING` + `IN_PROGRESS`. |

**Period presets (resolved server-side in IST):**

| Preset | Range | Comparison range |
|---|---|---|
| `all` | earliest → today | none |
| `this_month` | 1st of month → today | 1st of previous month → same day-of-month (clamped to month end) |
| `last_month` | full previous month | full month before it |
| `this_fy` | 1 Apr (current FY) → today | 1 Apr previous FY → same date previous year (29 Feb → 28 Feb) |
| `custom` | from → to (validated, from ≤ to, max span 5 years) | the equal-length window ending the day before `from` |

**Reconciliation checks** (in every response, `checks`):
- `allTime`: Σ Sales(all) − Σ Collected(all) = To collect − Credit (paise-exact).
- `agingSum`: Σ bands = To collect. `customersSum`: Σ list = To collect.
If any check fails, the API still returns 200 with `checks.ok = false` and the
UI **replaces the figures with a red banner** ("These figures don't add up — not
showing them until this is fixed"). Figures are never shown silently wrong.

## 2. Screen (phone first; Layout A)

1. **Header** — "YARS Industries", theme toggle.
2. **Hero — To collect**: count-up number; "18 customers · ₹77,940 over 90 days"
   (red); aging bar (4 labeled bands, legend with amounts); tap a band → `/dues?age=90+`;
   ⓘ → definition sheet.
3. **Collect from** — top 5 rows (name, amount, oldest age [red ≥ 90], orders
   count) with Call and WhatsApp buttons (hidden without a valid mobile); row tap →
   `/customers/:id`; **"See all N customers"** → `/dues`.
4. **Period bar** (sticky) — chips + Custom date sheet; remembered per device
   (`localStorage`, try/catch).
5. **Numbers 2×2** — Sales, Collected, Kg sold (+ pcs, ≈ from pcs), Expenses;
   comparison badge + exact compared dates in ⓘ.
6. **Sales vs collected** — 6-month grouped bars (brass / blue), legend + direct
   label on current month, tap/hover tooltip with exact values, "so far" marker.
7. **Kg sold** — 6-month bars + period's top 5 sizes.
8. **Expenses by category** — horizontal bars, top 4 + "+N more" (expandable).
9. **Recent orders** — 5 rows (read-only, no delete), "N in progress", link to Orders.
10. **FAB "＋ New order"** above bottom nav.

**Dues screen `/dues`:** all owing customers (same rows/actions), age-band
filter chips (All · 90+ · 61–90 · 31–60 · 0–30), total for the filter.

**WhatsApp reminder** (`https://wa.me/91XXXXXXXXXX?text=…`):
```
Namaste {Customer}, this is a gentle reminder from YARS Industries.
Pending balance: ₹41,200
• Order of 28 Feb 2026 — ₹18,000
• Order of 12 Mar 2026 — ₹14,700
Kindly arrange the payment at your convenience. Thank you!
```
Amounts in Indian grouping; dates "DD Mon YYYY"; at most 10 orders listed, then
"…and N more orders".

**Phone links:** strip non-digits; `0XXXXXXXXXX` → `XXXXXXXXXX`; accept
`[6-9]XXXXXXXXX` or `91[6-9]XXXXXXXXX`; `tel:+91…`, `wa.me/91…`. Invalid → buttons
hidden. Stored data never modified.

**States:** skeleton (exact layout), no dues ("Nothing to collect — all
customers are paid up"), empty period ("No orders in this period" — no ₹0
charts), network error (message + Retry), checks failed (red banner).

**Desktop/tablet (≥ 1024px):** two columns — hero + collect-from + recent
orders left; period section right; sidebar unchanged.

## 3. Theme, typography, motion

**Tokens** (CSS variables on `:root` / `.dark`, mapped into Tailwind as
`background, surface, raised, line, ink, ink-2, brass, status-*, chart-*`):

| Token | Dark (default) | Light |
|---|---|---|
| background | `#06110d` | `#f4f7f5` |
| surface | `#0e1f19` | `#ffffff` |
| raised | `#123126` | `#eef3f0` |
| line | `#173229` | `#dde6e1` |
| ink / ink-2 | `#eaf6f0` / `#93b3a5` | `#10201a` / `#55706a` |
| brass (accent) | `#d9b25f` (on-brass `#1c1606`) | `#8a6a1f` |
| status good/warn/serious/critical | `#37c98f` `#f0c248` `#f08a45` `#ff6a5e` | darker steps, contrast-checked |
| chart sales / collected | `#ad8733` / `#4a90e2` (validated dark) | re-validated light |
| chart kg / expenses | one distinct hue each (validated) | re-validated |

Every chart/status colour set is run through the dataviz palette validator
(dark and light surfaces) as part of the build; failures block. Status colours
are used only for status (aging, overdue) and always with a text label.

**Type:** Sora (numbers, headings; `font-variant-numeric: tabular-nums`), DM Sans
(body). **Dark by default** via ThemeProvider; user choice remembered.

**Motion (Motion library):**
- Open sequence (~1.2 s, once): hero count-up (0.9 s ease-out) → aging bands
  fill in order → collect rows rise, 60 ms stagger; chart bars grow from baseline
  when first scrolled into view.
- Responsive motion: period switch tweens numbers old → new and morphs bars
  (~0.4 s); Dues filter re-flows rows (layout animation); sheets spring from the
  bottom; press feedback.
- Nothing loops. `prefers-reduced-motion` → no animation, final values
  immediately. Transform/opacity only.

**Phase 2 (separate spec):** all other screens migrate to the tokens.

## 4. API and code structure

All under `/api/dashboard`, JWT-protected, read-only.

`GET /overview` →
```json
{ "asOf": "2026-09-30",
  "toCollect": 233320, "credit": 0, "customersOwing": 18, "ordersOwing": 26,
  "aging": [ { "band": "0-30", "amount": 99530, "orders": 12 }, "…31-60, 61-90, 90+" ],
  "customers": [ { "id": "…", "name": "…", "phone": "0XXXXXXXXXX", "amount": 41200,
                   "orders": 3, "oldestOrderDate": "2026-02-28", "oldestDays": 214,
                   "unpaidOrders": [ { "id": "…", "orderDate": "2026-02-28", "remaining": 18000 } ] } ],
  "recentOrders": [ { "id": "…", "customerName": "…", "orderDate": "…", "status": "…", "total": 18900 } ],
  "inProgress": 5,
  "excluded": { "cancelled": { "count": 0, "amount": 0 } },
  "checks": { "ok": true, "allTime": true, "agingSum": true, "customersSum": true } }
```
`GET /period?preset=…&from=&to=` →
```json
{ "range": { "from": "2026-09-01", "to": "2026-09-30", "label": "This month" },
  "compare": { "from": "2026-08-01", "to": "2026-08-30" },
  "sales":     { "value": 164850, "previous": 82640, "orders": 20 },
  "collected": { "value": 157590, "previous": 107540, "payments": 31 },
  "volume":    { "kgSold": 558, "kgFromKgLines": 558, "kgFromPieces": 0, "piecesTotal": 0, "piecesWithoutWeight": 0, "previousKgSold": 289 },
  "expenses":  { "value": 360402, "previous": 37687, "byCategory": [ { "name": "Raw Material", "amount": 311118 } ] },
  "topSizes":  [ { "size": "14 x 18", "kg": 322, "pieces": 0 } ],
  "excluded":  { "cancelled": { "count": 0, "amount": 0 }, "deletedOrderPayments": { "count": 0, "amount": 0 } },
  "checks": { "ok": true } }
```
(Example values illustrative of shape.) 400 on bad preset/dates.

`GET /trends` → `{ "months": [ { "month": "2026-09", "sales": …, "collected": …, "kgSold": …, "partial": true } ] }`

**Backend files:** `services/dashboard/dateRanges.js` (pure IST presets and
comparison ranges), `services/dashboard/ledger.js` (one read of live orders +
lines + plate charges + payments; expenses with categories — shaped for
`orderMath`), `services/dashboard/metrics.js` (pure: dues, period, trends,
checks), `controllers/dashboardController.js`, `routes/dashboardRoutes.js`.

**Frontend files:** `services/dashboardAPI.js`; `components/dashboard/*`
(HeroDues, CollectList, CustomerRow, PeriodBar, CustomRangeSheet, KpiGrid,
SalesCollectedChart, KgChart, ExpenseCategories, RecentOrders, InfoSheet,
states); `pages/Dashboard.jsx` (rewritten), `pages/Dues.jsx` + route `/dues`;
`utils/phone.js`, `utils/whatsappReminder.js`; theme tokens in CSS + Tailwind;
`motion` dependency. Old stat-card components and dashboard-side money math
removed.

**Jarvis KB:** `dashboard.md` rewritten; `routes.md` gains `/dues`.

## 5. Testing, verification, rollout

- **Unit (Jest):** `dateRanges` (IST midnight, 1st-of-month, 31 Mar → 28/29 Feb,
  FY 1 Apr, leap years, custom windows, validation); `metrics` (bands and list
  sum to To collect; credit separate; cancelled excluded + reported;
  deleted-order payments excluded + reported; pieces counted once; legacy
  advance-column at order date; prev 0 → "new"; checks flip to false on
  tampered input).
- **Integration (Docker test DB):** endpoints vs the rest of the app — Sales =
  Σ Orders API `total_amount` (non-cancelled); To collect = Σ positive
  remainders; per-customer dues = Jarvis canonical pending SQL; checks true.
- **Frontend (Vitest):** phone normalisation, WhatsApp text, formatting;
  palette validator on both themes.
- **Pre-release production check (read-only role):** new metrics reproduce
  Sales ₹26,14,607, Collected ₹23,81,287, To collect ₹2,33,320, aging bands and
  the 18-customer list vs independent SQL. Any mismatch blocks release.
- **Walkthrough:** 390px + desktop, dark + light, reduced motion on/off, every
  chip, Dues filters, call/WhatsApp links.
- **Final code review** (fresh Fable 5 reviewer).
- **Rollout:** no migration. Backend → frontend. Verify live figures match the
  pre-release check. Rollback: previous Cloud Run revision / Firebase release.

## Out of scope

- Phase 2 re-theme of other screens.
- Profit / margin figures (lumpy expenses would mislead).
- Inventory, invoice and unpaid-expense widgets (unused / always empty).
- Changing how the Orders screen or Jarvis treat Cancelled orders.
- Push notifications, forecasting.
