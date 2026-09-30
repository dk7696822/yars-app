# Dashboard

What it is: the home screen at [/](/). It summarises the order book and money
position, and lists recent orders. It is built from the latest 20 orders (not
the full history), so lifetime figures for a big order book should come from SQL,
not this screen.

What is on it:
- **Outstanding** hero card — total remaining balance across the loaded orders,
  with subtitle "Pending collection" and a badge ("Needs attention" / "All clear").
- Stat cards: **Orders** (count), **Customers** (distinct customers among those
  orders), **Revenue** (sum of order totals), **Received** (sum of payments +
  advances).
- Quick actions: **New Order** (desktop; on phones just **Order**), **Customer**,
  **Invoices** (desktop only).
- **Recent Orders** section with a summary bar — **Kg sold** (kg from kg lines
  + estimated kg from pieces lines, each line counted once; an amber note shows
  "+ N pcs without weight (not in kg)" when some pieces lines have no weight —
  tapping it opens [Product Sizes](/product-sizes)), **Pieces sold**,
  **Amount**, **Receivable** — then the order list, 5 per page, with a
  **View All** link to [Orders](/orders).
- Orders can be deleted from this list (confirmation modal "Delete order" with
  **Delete** / **Keep it**).

## Creating an order from the dashboard
1. Open the [Dashboard](/) and tap **Order** (phone) or **New Order** (desktop),
   top of the page.
2. This opens [Create Order](/orders/new) — see orders.md for the form.

## Checking who owes money
1. The **Outstanding** card on [/](/) shows the total pending collection for the
   last 20 orders. For per-customer dues or the true all-time figure, ask the
   assistant to run a query (orders + payments), or open
   [Orders](/orders) and read the **Receivable** column per order.
