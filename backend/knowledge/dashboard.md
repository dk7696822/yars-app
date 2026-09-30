# Dashboard

What it is: the home screen at [/](/), dark "Midnight Forest" theme. Every figure
is computed on the server by the same order math as the Orders screen and is
reconciled (Sales − Collected = To collect − Credit, to the paisa). If a check
ever fails the screen shows a red "These figures don't add up" banner instead
of numbers.

## Top: money to collect (always all-time, as of today)
- **To collect** — sum of every order's unpaid remainder (cancelled and deleted
  orders excluded). ⓘ explains the definition.
- **Age bar** — 0–30 / 31–60 / 61–90 / 90+ days by order date; the bands add up
  to To collect. Tap a band to open [Dues](/dues) filtered to it.
- **Collect from** — top 5 customers, oldest dues first: amount, age of oldest
  unpaid order, number of orders. Tap the name for the customer page; phone icon
  calls them; chat icon opens WhatsApp with a pre-written reminder listing their
  unpaid orders (the user sends it). Icons appear only when a valid mobile is
  saved. **See all N customers** opens [Dues](/dues).

## Period section
- Chips: **All time · This month · Last month · This FY · Custom…** (sticky; the
  last choice is remembered on the phone; opens on All time the first time).
- Under the chips: "Showing <dates> · compared with <dates>" — the exact range
  the figures below came from (dimmed with "updating…" while a new period loads;
  a failed load shows "Couldn't load this period" with Try again / Show All time).
- Tiles: **Sales** (orders dated in the period), **Collected** (payments received
  in the period, including on older orders), **Kg sold** (+ pieces, ≈ kg from
  pieces), **Expenses** (bills dated in the period). Badges compare with the
  same-length period before (e.g. same days last month); none for All time.
- Charts: **Sales vs collected** and **Kg sold** for the last 6 months (tap a
  month for exact values; the current month is marked "so far"); **Top sizes**
  and **Expenses by category** follow the chosen period.
- **Recent orders** (read-only) with the number in progress.
- There is no profit figure on purpose: big raw-material bills are used over
  many months.

## Answering "why is the dashboard different from …"
- Dashboard excludes orders with status Cancelled; the Orders list includes them
  (the Sales tile and its ⓘ say how many were excluded).
- Collected excludes payments recorded on deleted orders and payments not linked
  to any order; the Collected ⓘ lists both amounts when present.
- For kg/pieces and dues SQL, use the canonical queries in schema.md.
