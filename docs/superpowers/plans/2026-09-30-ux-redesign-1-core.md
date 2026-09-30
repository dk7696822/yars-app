# UX Redesign 1 — Foundation + Money Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Orders, Order details + payments, the order form, Customers, the customer form and Invoices on one component kit and the Midnight Forest & Brass theme, with the confirmed money/data bugs fixed and a code-split, server-paged client.

**Architecture:** Every money figure on every new screen comes from one server module (`orderFacts` → `orderMath`), exactly like the dashboard. New list endpoints load live orders once with `required:false` includes, compute facts in integer paise, then filter/sort/page in JS (pure, unit-tested builders). The client uses TanStack Query (one `invalidateMoney` after any money change), lazy routes, a small token-based kit in `frontend/src/ui/`, and legacy CSS scoped under `.legacy` for pages not yet redesigned.

**Tech Stack:** Node 20 / Express 5 / Sequelize 6 / Postgres; Jest (Docker `yars-test-db`, `npm test` in `backend/`). React 19 / Vite 6 / Tailwind 3 / `motion` / react-router 7 / `@tanstack/react-query` 5; Vitest (`npx vitest run` in `frontend/`).

**Spec:** `docs/superpowers/specs/2026-09-30-ux-redesign-1-core-design.md`

## Global Constraints

- **No figure may be shown incorrectly.** Money on every screen comes from `backend/src/services/orderFacts.js` (which uses `orderMath`) — never recomputed ad hoc on the client. The client only previews unsaved form totals with `frontend/src/utils/orderMath.js`.
- Existing real customer data must not change. **No migrations in this plan.** Customer `city`/`gstin` live in `customers.metadata` (JSONB).
- Kg quantities: up to 2 decimals (`DECIMAL(10,2)`); a 3rd decimal shows "Use at most 2 decimals". Pieces are whole numbers ≥ 1. Piece price up to 4 decimals, weight up to 3.
- All dates are India dates as `"YYYY-MM-DD"` strings. Never `toISOString().split("T")[0]` or `new Date()` for a stored date — use `todayIST()` (backend `services/dashboard/dateRanges.js`, frontend `utils/istDate.js`).
- Refunds (`payment_type = 'REFUND'`) reduce received everywhere (orderMath both sides, dashboard, Jarvis SQL, invoices).
- Cancelled orders never count toward due, sales, business or invoice selection; lists disclose how many were left out.
- Invoice rule: `due = final_amount − received on the invoice's orders − invoice-only payments`; status derived CANCELLED › PAID (due ≤ 0) › OVERDUE (past due date) › PENDING. Only CANCELLED/PENDING are ever written by the app.
- Payment type follows the amount: amount ≥ due → FINAL, else PARTIAL. Advance and Refund are explicit actions. An amount above the due shows a warning; the button becomes "Save anyway".
- Order edit never changes the advance (no `advance_received` writes, no ADVANCE row edits).
- Back button on every step of every multi-step form; data kept when going back; progress bar tappable for reached steps; "Edit" per section on the review step.
- Mobile first (390px), dark by default, light must also work. Theme tokens only (`bg-canvas|surface|raised`, `border-line`, `text-ink|ink-2`, `brass`, `status-good|warn|serious|critical`); no hard-coded hex in new code. Fixed-position overlays are portalled to `document.body` (the page wrapper is transformed); in-flow footers use `sticky bottom-0`.
- Touch targets ≥ 40px; every icon-only button has an `aria-label`; figures use `font-num tabular-nums`; money format is `inr()` (exact ₹, Indian grouping).
- Lists page server-side: 30 rows/page for orders and invoices, 100/page (max 500) for the customer directory.
- Stage files by explicit path. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never touch `~/Desktop/epidermohydra`. No production deploys, no pushes — one combined release happens after sub-projects 2 and 3.
- Backend suite baseline: 30 suites / 226 tests. Frontend baseline: 67 tests; lint 7 errors (all in files this plan deletes); build: one 1,271 kB JS chunk.

## Review Focus

1. **Order whose size/customer/plate was archived** — must still show every line and the right total on the detail page, lists and invoice (the old `getOrderById` dropped it: nested `where` made includes required). Pinned in Task 2.
2. **Overpaid orders (credit)** — lists must show "Paid ✓", never a negative due, and summaries must add only positive dues (credit reported separately). Pinned in Tasks 5, 6 and 7.
3. **Order date typed near midnight / server in UTC** — the form sends the picked `YYYY-MM-DD` string; server defaults use `todayIST()`. Pinned in Task 2 (fake clock) and Task 10.
4. **Invoice whose orders were later deleted or cancelled** — their payments still count toward the invoice (the bill was issued); pinned in Task 7.
5. **Payment sheet after a network error or double tap** — the Save button is disabled while saving and errors keep the entered values; pinned by `validatePayment` tests in Task 14 and the walkthrough in Task 21.

---

## File structure

Backend (new):
- `backend/src/services/orderFacts.js` — `toPaise`, `rupees`, `isCounted`, `hasAdvanceRows`, `orderFacts`, `signedPaise`
- `backend/src/services/lists/orderList.js` — `buildOrderList`, `toOrderRow`, `ListError`, `paging`, `pageOf`
- `backend/src/services/lists/customerDirectory.js` — `customerStats`, `buildDirectory`, `buildCustomerSummary`
- `backend/src/services/customerSimilar.js` — `findSimilar`
- `backend/src/services/customerFields.js` — `readCustomerBody`, `CustomerFieldError`
- `backend/src/services/invoiceMoney.js` — `invoiceMoney`, `invoiceMoneyFor`
- `backend/src/services/lists/invoiceList.js` — `buildInvoiceList`
- Tests: `orderList.test.js`, `customerDirectory.test.js`, `invoiceMoney.test.js`, `paymentAudit.test.js`, `paymentRefund.test.js`

Backend (modified): `orderMath.js`, `dashboard/metrics.js`, `dashboard/ledger.js` (+`loadOrders`), `auditService.js`, `models/payment.js`, `controllers/{order,customer,invoice,payment}Controller.js`, `routes/{order,customer,invoice}Routes.js`, `scripts/dashboard-verify.js`, `knowledge/*.md`, `tests/fixtures/order-math-vectors.json`.

Frontend (new):
- `src/lib/queryClient.js`, `src/lib/queryKeys.js`, `src/app/routeMeta.js`, `src/app/Legacy.jsx`
- `src/utils/{istDate,numberInput,paymentType,dayGroups,alphaIndex,itemsText,statusMeta}.js` (+ tests)
- `src/ui/` — `Button`, `IconButton`, `Chips`, `Field`, `TextInput`, `NumberInput`, `PhoneInput`, `DateField`, `Switch`, `Tabs`, `Sheet`, `ConfirmDialog`, `ActionSheet`, `SearchPicker`, `StickyFooter`, `Stepper`, `Money` (`Money`, `DueText`), `StatusBadge`, `States` (`EmptyState`, `ErrorState`, `ListSkeleton`, `PageSkeleton`), `styles.js`, `useDebounced.js`, `useInfiniteSentinel.js`
- `src/features/orders/` — `api.js`, `OrdersPage.jsx`, `OrderRow.jsx`, `OrderPage.jsx`, `form/draft.js` (+test), `form/OrderFormPage.jsx`, `form/CustomerStep.jsx`, `form/ItemsStep.jsx`, `form/LineCard.jsx`, `form/ExtrasStep.jsx`, `form/SizePicker.jsx`
- `src/features/payments/` — `api.js`, `paymentForm.js` (+test), `PaymentSheet.jsx`, `PaymentList.jsx`
- `src/features/customers/` — `api.js`, `CustomersPage.jsx`, `CustomerPage.jsx`, `CustomerFormPage.jsx`, `QuickCustomerSheet.jsx`, `CustomerPicker.jsx`, `SimilarWarning.jsx`, `customerForm.js` (+test)
- `src/features/invoices/` — `api.js`, `InvoicesPage.jsx`, `InvoicePage.jsx`, `NewInvoicePage.jsx`, `invoiceDraft.js` (+test)

Frontend (modified): `App.jsx`, `main.jsx`, `vite.config.js`, `package.json`, `components/layout/{MainLayout,BottomNav,Sidebar,Header}.jsx`, `services/api.js`, `utils/{phone,whatsappReminder}.js`, `styles/{dark-theme,select-override,button-override}.css`.

Frontend (deleted in Task 20): old `pages/{Orders,OrderDetails,CreateOrder,EditOrder,Customers,CustomerDetails,CreateCustomer,EditCustomer,Invoices,InvoiceDetails,GenerateInvoice}.jsx` + their CSS, `components/{orders,customers,invoices,payments}/*`, `services/paymentAPI.js`, `components/ui/action-button.jsx` — each only after `grep` shows no importer.

---

### Task 1: Refunds reduce received; Jarvis pending excludes cancelled orders

**Files:**
- Modify: `backend/src/services/orderMath.js` (`paymentPosition`)
- Modify: `frontend/src/utils/orderMath.js` (`paymentPosition`)
- Modify: `backend/tests/fixtures/order-math-vectors.json`
- Modify: `backend/src/services/dashboard/metrics.js` (`receivedInRange`)
- Modify: `backend/tests/dashboardMetrics.test.js`
- Modify: `backend/knowledge/schema.md` (canonical pending), `backend/knowledge/payments.md`
- Modify: `backend/tests/knowledgeQueries.test.js`
- Modify: `backend/scripts/dashboard-verify.js` (collected SQL, drop the "no cancelled" guard)
- Modify: `backend/src/controllers/paymentController.js` (refund guard)
- Create: `backend/tests/paymentRefund.test.js`

**Interfaces:**
- Produces: `paymentPosition(order, total)` — unchanged signature; `totalPaid` now subtracts REFUND rows. Refund create rejected with 400 when amount > what the order has received.

- [ ] **Step 1: Add the refund vector (fails on both sides)**

In `backend/tests/fixtures/order-math-vectors.json`, append this object as the last element of the `"orders"` array (add a comma after the previous element):

```json
    {
      "name": "a refund reduces what was received",
      "order": {
        "custom_plate_charge": null, "round_off_amount": "0.00", "advance_received": "0.00",
        "plateType": { "charge": "500.00" },
        "orderProductSizes": [
          { "unit": "KG", "quantity_kg": "10.00", "rate_per_kg": "150.00", "productSize": { "rate_per_kg": "150.00" } }
        ],
        "payments": [ { "payment_type": "FINAL", "amount": "2000.00" }, { "payment_type": "REFUND", "amount": "300.00" } ]
      },
      "expected": { "total": 2000, "totalPaid": 1700, "advanceReceived": 0, "totalReceived": 1700, "remaining": 300 }
    }
```

- [ ] **Step 2: Run both math suites — expect the new vector to fail**

Run: `cd backend && npm test -- orderMath` then `cd ../frontend && npx vitest run src/utils/orderMath.test.js`
Expected: FAIL on "a refund reduces what was received" (totalPaid 2300, expected 1700) in both.

- [ ] **Step 3: Implement in both orderMath files**

`backend/src/services/orderMath.js` — replace the body of `paymentPosition`:

```js
const paymentPosition = (order, total = orderTotal(order)) => {
  const payments = order.payments || [];
  // A refund is money given back: it counts against what was received.
  const signed = (p) => (p.payment_type === "REFUND" ? -1 : 1) * parseFloat(p.amount);
  const sum = (list) => list.reduce((acc, p) => acc + signed(p), 0);
  const totalPaid = sum(payments.filter((p) => p.payment_type !== "ADVANCE"));
  const advanceFromPayments = sum(payments.filter((p) => p.payment_type === "ADVANCE"));
  const advanceReceived = advanceFromPayments > 0 ? advanceFromPayments : parseFloat(order.advance_received || 0);
  return {
    totalPaid,
    advanceReceived,
    totalReceived: totalPaid + advanceReceived,
    remaining: total - totalPaid - advanceReceived,
  };
};
```

`frontend/src/utils/orderMath.js` — replace `paymentPosition` with the same logic:

```js
export const paymentPosition = (order, total = orderTotal(order)) => {
  const payments = order.payments || [];
  // A refund is money given back: it counts against what was received.
  const signed = (p) => (p.payment_type === "REFUND" ? -1 : 1) * parseFloat(p.amount);
  const sum = (list) => list.reduce((acc, p) => acc + signed(p), 0);
  const totalPaid = sum(payments.filter((p) => p.payment_type !== "ADVANCE"));
  const advanceFromPayments = sum(payments.filter((p) => p.payment_type === "ADVANCE"));
  const advanceReceived = advanceFromPayments > 0 ? advanceFromPayments : parseFloat(order.advance_received || 0);
  return { totalPaid, advanceReceived, totalReceived: totalPaid + advanceReceived, remaining: total - totalPaid - advanceReceived };
};
```

- [ ] **Step 4: Run both math suites**

Run: `cd backend && npm test -- orderMath` then `cd ../frontend && npx vitest run src/utils/orderMath.test.js`
Expected: PASS, including the refund vector.

- [ ] **Step 5: Dashboard "collected" must subtract refunds — failing test**

Append to `backend/tests/dashboardMetrics.test.js`:

```js
describe("refunds", () => {
  test("a refund inside the period reduces collected", () => {
    const l = ledger([order({ id: "r1", order_date: "2026-09-01", payments: [pay(1000, "2026-09-02", "FINAL"), pay(300, "2026-09-10", "REFUND")] })]);
    const out = m.computePeriod(l, { from: "2026-09-01", to: "2026-09-30" }, null);
    expect(out.collected.value).toBe(700);
  });
});
```

Run: `cd backend && npm test -- dashboardMetrics`
Expected: FAIL — received 1300, expected 700.

- [ ] **Step 6: Implement `receivedInRange` with signed amounts**

In `backend/src/services/dashboard/metrics.js`, replace `receivedInRange`:

```js
/** Money received for this order inside the range: dated payments (refunds negative) + a legacy column-only advance at the order date. */
const receivedInRange = (order, range) => {
  const signed = (p) => (p.payment_type === "REFUND" ? -1 : 1) * toPaise(p.amount);
  let paise = sum((order.payments || []).filter((p) => inRange(p.payment_date, range)), signed);
  if (!hasAdvanceRows(order) && Number(order.advance_received || 0) > 0 && inRange(order.order_date, range)) {
    paise += toPaise(order.advance_received);
  }
  return paise;
};
```

Run: `cd backend && npm test -- dashboardMetrics`
Expected: PASS.

- [ ] **Step 7: Jarvis canonical pending — failing tests for refunds and cancelled orders**

In `backend/tests/knowledgeQueries.test.js`, inside `beforeEach` after the Beta order is created, add a refund and a cancelled order for Beta:

```js
    const betaPaid = await createOrderWithLines({
      customer: customerB, plateType: plate,
      lines: [{ product_size_id: kgSize.id, unit: "KG", quantity_kg: "2.00", rate_per_kg: "150.00" }],
    }); // 300 + 500 plate = 800
    await db.Payment.create({ order_id: betaPaid.id, customer_id: customerB.id, amount: "800.00", payment_type: "FINAL", payment_date: "2026-09-06" });
    await db.Payment.create({ order_id: betaPaid.id, customer_id: customerB.id, amount: "100.00", payment_type: "REFUND", payment_date: "2026-09-07" });

    await createOrderWithLines({
      customer: customerB, plateType: plate, status: "CANCELLED",
      lines: [{ product_size_id: kgSize.id, unit: "KG", quantity_kg: "4.00", rate_per_kg: "150.00" }],
    }); // 1100, cancelled — never owed
```

In the pending test, count only non-cancelled orders and update Beta's expected value:

```js
    for (const order of await appOrders()) {
      if (order.status === "CANCELLED") continue;
      const remaining = paymentPosition(order, orderTotal(order)).remaining;
      expected[order.customer.name] = (expected[order.customer.name] || 0) + remaining;
    }
    for (const [name, value] of Object.entries(expected)) {
      expect(sqlPending[name]).toBeCloseTo(value, 2);
    }
    // Alpha: 1500 + 1875 + 500 − 5 − 700 − 1000 = 2170; Beta: 1006.01 + 500 + (800 − 800 + 100 refunded)
    expect(sqlPending.Alpha).toBeCloseTo(2170, 2);
    expect(sqlPending.Beta).toBeCloseTo(1606.01, 2);
```

Run: `cd backend && npm test -- knowledgeQueries`
Expected: FAIL — SQL Beta = 2506.01 (refund added as paid → −100, plus the cancelled 1100).

- [ ] **Step 8: Update the canonical pending SQL**

In `backend/knowledge/schema.md`, replace everything between `<!-- canonical:pending -->` and `<!-- /canonical:pending -->` with:

```sql
  WITH order_calc AS (
    SELECT o.customer_id,
      COALESCE((SELECT SUM(CASE WHEN ops.unit = 'PIECES'
                                THEN ROUND(ops.quantity_pieces * ops.price_amount / ops.price_pieces_count, 2)
                                ELSE ops.quantity_kg * COALESCE(ops.rate_per_kg, ps.rate_per_kg) END)
                FROM order_product_sizes ops JOIN product_sizes ps ON ps.id = ops.product_size_id
                WHERE ops.order_id = o.id), 0)
      + COALESCE(o.custom_plate_charge, pt.charge, 0)
      - COALESCE(o.round_off_amount, 0)
      - COALESCE((SELECT SUM(CASE WHEN p.payment_type = 'REFUND' THEN -p.amount ELSE p.amount END) FROM payments p
                  WHERE p.order_id = o.id AND p.payment_type <> 'ADVANCE'), 0)
      - CASE WHEN COALESCE((SELECT SUM(p.amount) FROM payments p
                            WHERE p.order_id = o.id AND p.payment_type = 'ADVANCE'), 0) > 0
             THEN (SELECT SUM(p.amount) FROM payments p
                   WHERE p.order_id = o.id AND p.payment_type = 'ADVANCE')
             ELSE COALESCE(o.advance_received, 0) END AS balance
    FROM orders o
    LEFT JOIN plate_types pt ON pt.id = o.plate_type_id
    WHERE o.is_archived = false AND o.status <> 'CANCELLED'
  )
  SELECT c.name, ROUND(SUM(oc.balance), 2) AS pending
  FROM order_calc oc JOIN customers c ON c.id = oc.customer_id
  GROUP BY c.name HAVING SUM(oc.balance) > 0 ORDER BY pending DESC
```

Directly under the block's closing marker line, the existing bullet list continues; add this bullet before `- **For ANY kg sold...`:

```md
- Refunds (`payment_type = 'REFUND'`) are money given back — always subtract
  them from received. Cancelled orders are never owed.
```

Run: `cd backend && npm test -- knowledgeQueries dashboardController dashboardVerify`
Expected: PASS.

- [ ] **Step 9: Verify script — refunds in collected SQL, compare pending always**

In `backend/scripts/dashboard-verify.js`:

1. Replace the `if (overview.excluded.cancelled.count === 0) {` guard and its closing brace so the per-customer comparison always runs (the SQL now excludes cancelled orders). Keep the loop body unchanged. Update the comment above it to: `// Jarvis's canonical per-customer pending must equal the dashboard's list.`
2. Replace the collected query with:

```js
  const [{ collected }] = await q(`SELECT COALESCE(SUM(CASE WHEN p.payment_type = 'REFUND' THEN -p.amount ELSE p.amount END),0) AS collected
                                   FROM payments p JOIN orders o ON o.id = p.order_id
                                   WHERE NOT o.is_archived AND o.status <> 'CANCELLED'`);
```

Add to `backend/tests/dashboardVerify.test.js`:

```js
test("verification agrees when there are refunds and cancelled orders", async () => {
  const today = todayIST();
  const c = await createCustomer("Delta");
  const plate = await createPlateType("0.00");
  const size = await createSize({ rate_per_kg: "100.00" });
  const line = { product_size_id: size.id, unit: "KG", quantity_kg: "5.00", rate_per_kg: "100.00" };
  const o = await createOrderWithLines({ customer: c, plateType: plate, order_date: addDays(today, -3), lines: [line] });
  await db.Payment.create({ order_id: o.id, customer_id: c.id, amount: "500.00", payment_type: "FINAL", payment_date: today });
  await db.Payment.create({ order_id: o.id, customer_id: c.id, amount: "50.00", payment_type: "REFUND", payment_date: today });
  await createOrderWithLines({ customer: c, plateType: plate, order_date: today, status: "CANCELLED", lines: [line] });

  const result = await verifyDashboard(db.sequelize, db, today);
  expect(result.problems).toEqual([]);
  expect(result.summary.toCollect).toBe(50);
});
```

Run: `cd backend && npm test -- dashboardVerify`
Expected: PASS (2 tests).

- [ ] **Step 10: Refund guard — failing test**

Create `backend/tests/paymentRefund.test.js`:

```js
"use strict";

const db = require("../src/models");
const { createPayment } = require("../src/controllers/paymentController");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const call = async (fn, req) => {
  const res = mockRes();
  await fn({ query: {}, params: {}, body: {}, ...req }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe("refunds", () => {
  let order;
  beforeEach(async () => {
    const customer = await createCustomer("Refundee");
    const plate = await createPlateType("0.00");
    const size = await createSize({ rate_per_kg: "100.00" });
    order = await createOrderWithLines({ customer, plateType: plate, lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "100.00" }] });
    await db.Payment.create({ order_id: order.id, customer_id: customer.id, amount: "600.00", payment_type: "PARTIAL", payment_date: "2026-09-02" });
  });

  test("a refund up to what was received is saved", async () => {
    const res = await call(createPayment, { body: { order_id: order.id, amount: "600", payment_type: "REFUND", payment_date: "2026-09-03" } });
    expect(res.status).toBe(201);
  });

  test("a refund above what was received is refused", async () => {
    const res = await call(createPayment, { body: { order_id: order.id, amount: "600.01", payment_type: "REFUND", payment_date: "2026-09-03" } });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("A refund can't be more than received (₹600)");
    expect(await db.Payment.count({ where: { payment_type: "REFUND" } })).toBe(0);
  });
});
```

Run: `cd backend && npm test -- paymentRefund`
Expected: FAIL — second test gets 201.

- [ ] **Step 11: Implement the guard**

In `backend/src/controllers/paymentController.js`: change the models import to also take `PlateType, OrderProductSize, ProductSize`, and add `const { orderTotal, paymentPosition } = require("../services/orderMath");`. In `createPayment`, inside the `if (order_id) {` block, right after the `if (!order) {...}` check, add:

```js
      if (payment_type === "REFUND") {
        const full = await Order.findByPk(order_id, {
          include: [
            { model: PlateType, as: "plateType", required: false },
            { model: OrderProductSize, as: "orderProductSizes", required: false, include: [{ model: ProductSize, as: "productSize", required: false }] },
            { model: Payment, as: "payments", required: false },
          ],
          transaction,
        });
        const data = full.toJSON();
        const received = Math.round(paymentPosition(data, orderTotal(data)).totalReceived * 100);
        if (Math.round(parseFloat(amount) * 100) > received) {
          await transaction.rollback();
          return error(res, 400, `A refund can't be more than received (₹${new Intl.NumberFormat("en-IN").format(received / 100)})`);
        }
      }
```

Run: `cd backend && npm test -- paymentRefund`
Expected: PASS (2 tests).

- [ ] **Step 12: Update payments knowledge**

In `backend/knowledge/payments.md`, add after the "Payment types" paragraph:

```md
A **Refund** is money given back to the customer: it is subtracted from what
the order has received (so the due goes up again). A refund can't be more than
the order has received.
```

- [ ] **Step 13: Full backend suite and commit**

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: all suites pass (≥ 31 suites).

```bash
git add backend/src/services/orderMath.js frontend/src/utils/orderMath.js backend/tests/fixtures/order-math-vectors.json backend/src/services/dashboard/metrics.js backend/tests/dashboardMetrics.test.js backend/knowledge/schema.md backend/knowledge/payments.md backend/tests/knowledgeQueries.test.js backend/scripts/dashboard-verify.js backend/tests/dashboardVerify.test.js backend/src/controllers/paymentController.js backend/tests/paymentRefund.test.js
git commit -m "fix(money): refunds reduce received everywhere; Jarvis pending skips cancelled orders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared order facts and loader; orders never lose lines; India-date defaults

**Files:**
- Create: `backend/src/services/orderFacts.js`
- Modify: `backend/src/services/dashboard/metrics.js` (use orderFacts)
- Modify: `backend/src/services/dashboard/ledger.js` (+ `loadOrders`)
- Modify: `backend/src/controllers/orderController.js` (`orderIncludes`, IST defaults)
- Modify: `backend/src/controllers/paymentController.js` (IST default payment date)
- Modify: `backend/tests/orderController.test.js`

**Interfaces:**
- Produces: `orderFacts.js` → `toPaise(x)`, `rupees(paise)`, `isCounted(order)`, `hasAdvanceRows(order)`, `signedPaise(payment)`, `orderFacts(order) → { totalPaise, receivedPaise, remainingPaise }`.
- Produces: `ledger.js` → `loadOrders(models, where = { is_archived: false }) → Promise<order[]>`; each order is plain JSON with `customerName`, `customerPhone`, `customer.metadata`, `orderProductSizes[].productSize.size_label`, `payments[]` (`id, amount, payment_type, payment_date, payment_method, reference_number, notes, invoice_id`), `invoice_id`, `created_at`, `is_archived`.

- [ ] **Step 1: Failing tests — archived size/plate/customer, IST defaults**

Append to `backend/tests/orderController.test.js` (it already defines `call`, imports `createOrder`, `getOrderById`, `getAllOrders`, `createCustomer`, `createPlateType`, `createSize`):

```js
describe("orders survive archived master data", () => {
  test("an order whose size, plate and customer were archived still shows every line", async () => {
    const customer = await createCustomer("Archived Co");
    const plate = await createPlateType("100.00");
    const size = await createSize({ rate_per_kg: "50.00" });
    const created = await call(createOrder, { body: {
      customer_id: customer.id, plate_type_id: plate.id, order_date: "2026-09-10",
      product_sizes: [{ product_size_id: size.id, unit: "KG", quantity_kg: "2.00", rate_per_kg: "50.00" }],
    } });
    const id = created.body.data.id;
    await size.update({ is_archived: true });
    await plate.update({ is_archived: true });
    await customer.update({ is_archived: true });

    const one = await call(getOrderById, { params: { id } });
    expect(one.status).toBe(200);
    expect(one.body.data.orderProductSizes).toHaveLength(1);
    expect(one.body.data.total_amount).toBe(200);

    const all = await call(getAllOrders, { query: {} });
    expect(all.body.data.map((o) => o.id)).toContain(id);
  });
});

describe("dates default to India's today", () => {
  const { todayIST } = require("../src/services/dashboard/dateRanges");
  afterEach(() => jest.useRealTimers());

  test("an order without a date is dated today in India, even at 1:30 am IST", async () => {
    // 20:00 UTC on 30 Sept = 01:30 IST on 1 Oct.
    jest.useFakeTimers({ now: new Date("2026-09-30T20:00:00Z"), doNotFake: ["nextTick", "setImmediate", "clearImmediate", "setTimeout", "setInterval", "clearTimeout", "clearInterval", "queueMicrotask", "performance", "hrtime"] }); // only Date is faked
    const customer = await createCustomer();
    const plate = await createPlateType("0.00");
    const size = await createSize({ rate_per_kg: "10.00" });
    const res = await call(createOrder, { body: {
      customer_id: customer.id, plate_type_id: plate.id, advance_received: "5",
      product_sizes: [{ product_size_id: size.id, unit: "KG", quantity_kg: "1.00", rate_per_kg: "10.00" }],
    } });
    expect(res.status).toBe(201);
    expect(todayIST()).toBe("2026-10-01");
    const saved = await db.Order.findByPk(res.body.data.id, { include: [{ model: db.Payment, as: "payments" }] });
    expect(saved.order_date).toBe("2026-10-01");
    expect(saved.payments[0].payment_date).toBe("2026-10-01");
  });
});
```

Run: `cd backend && npm test -- orderController`
Expected: FAIL — `getOrderById` returns 404 for the archived-size order; the date test gets `2026-09-30`.

- [ ] **Step 2: Create `orderFacts.js`**

```js
"use strict";

/**
 * Per-order money facts in integer paise — the ONE place list endpoints,
 * invoices and the dashboard get an order's total / received / remaining,
 * so every screen shows the same figure. Built on orderMath.
 */
const { orderTotal, paymentPosition } = require("./orderMath");

const toPaise = (x) => Math.round(Number(x) * 100);
const rupees = (paise) => paise / 100;
const isCounted = (order) => order.status !== "CANCELLED";
/** Refunds are money given back. */
const signedPaise = (p) => (p.payment_type === "REFUND" ? -1 : 1) * toPaise(p.amount);
const hasAdvanceRows = (order) =>
  (order.payments || []).filter((p) => p.payment_type === "ADVANCE").reduce((s, p) => s + Number(p.amount), 0) > 0;

/** remaining = rounded total − rounded received, so sums reconcile by construction. */
const orderFacts = (order) => {
  const total = orderTotal(order);
  const totalPaise = toPaise(total);
  const receivedPaise = toPaise(paymentPosition(order, total).totalReceived);
  return { totalPaise, receivedPaise, remainingPaise: totalPaise - receivedPaise };
};

module.exports = { toPaise, rupees, isCounted, signedPaise, hasAdvanceRows, orderFacts };
```

- [ ] **Step 3: metrics.js uses orderFacts**

In `backend/src/services/dashboard/metrics.js`:
- Replace the import `const { orderTotal, paymentPosition, volumeSummary, lineKg } = require("../orderMath");` with:

```js
const { volumeSummary, lineKg } = require("../orderMath");
const { toPaise, rupees, isCounted, hasAdvanceRows, orderFacts } = require("../orderFacts");
```

- Delete the local definitions of `toPaise`, `rupees`, `isCounted`, `orderFacts` and `hasAdvanceRows` (keep `inRange` and `sum`).
- `module.exports` stays `{ toPaise, reconcile, computeOverview, computePeriod, computeTrends }`.

- [ ] **Step 4: `loadOrders` in ledger.js**

Replace the order query at the top of `loadLedger` in `backend/src/services/dashboard/ledger.js` with a shared loader:

```js
/**
 * Live orders with everything money needs. Every include is required:false so
 * no order or line is ever dropped because a size/customer/plate was archived.
 */
const loadOrders = async (models, where = { is_archived: false }) => {
  const { Order, Customer, PlateType, OrderProductSize, ProductSize, Payment } = models;
  const rows = await Order.findAll({
    where,
    attributes: ["id", "customer_id", "order_date", "created_at", "status", "custom_plate_charge", "round_off_amount", "advance_received", "invoice_id", "is_archived"],
    include: [
      { model: Customer, as: "customer", attributes: ["id", "name", "metadata"], required: false },
      { model: PlateType, as: "plateType", attributes: ["charge", "type_name"], required: false },
      {
        model: OrderProductSize, as: "orderProductSizes", required: false,
        include: [{ model: ProductSize, as: "productSize", attributes: ["rate_per_kg", "size_label"], required: false }],
      },
      {
        model: Payment, as: "payments", required: false,
        attributes: ["id", "amount", "payment_type", "payment_date", "payment_method", "reference_number", "notes", "invoice_id"],
      },
    ],
  });
  return rows.map((r) => {
    const o = r.toJSON();
    return { ...o, customerName: o.customer?.name || "Unknown customer", customerPhone: o.customer?.metadata?.phone || null };
  });
};

/** One read of everything the dashboard needs. */
const loadLedger = async (models) => {
  const { Order, Payment, Expense, ExpenseCategory } = models;
  const orders = await loadOrders(models);
```

Keep the rest of `loadLedger` (deleted-order payments, unlinked, expenses, dates) unchanged, and change the export to `module.exports = { loadLedger, loadOrders };`.

- [ ] **Step 5: orderController — shared includes and IST defaults**

In `backend/src/controllers/orderController.js`:
- Add `const { todayIST } = require("../services/dashboard/dateRanges");`
- Add above `createOrder`:

```js
/**
 * Every include is required:false — an archived size, plate or customer must
 * never hide an order or one of its lines (a nested `where` would).
 */
const orderIncludes = () => [
  { model: Customer, as: "customer", required: false },
  { model: PlateType, as: "plateType", required: false },
  {
    model: OrderProductSize, as: "orderProductSizes", required: false,
    include: [{ model: ProductSize, as: "productSize", required: false }],
  },
  { model: Payment, as: "payments", required: false },
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number"], required: false },
];
```

- In `createOrder`: `order_date: order_date || todayIST(),` and in the advance `Payment.create`: `payment_date: order_date || todayIST(),`. Replace the post-commit fetch's `include: [...]` with `include: orderIncludes()`.
- In `getAllOrders`: replace `includeArray` with

```js
    const includeArray = orderIncludes();
    if (customerName) {
      includeArray[0] = { model: Customer, as: "customer", required: true, where: { name: { [Op.iLike]: `%${customerName}%` } } };
    }
```

- In `getOrderById`: replace the `include: [...]` with `include: orderIncludes()`.
- In `updateOrder`: replace the refetch's `include: [...]` with `include: orderIncludes()`.

In `backend/src/controllers/paymentController.js` `createPayment`: add `const { todayIST } = require("../services/dashboard/dateRanges");` at the top and use `payment_date: payment_date || todayIST(),`.

- [ ] **Step 6: Run the suite**

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: all pass, including the two new tests; dashboard suites unchanged.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/orderFacts.js backend/src/services/dashboard/metrics.js backend/src/services/dashboard/ledger.js backend/src/controllers/orderController.js backend/src/controllers/paymentController.js backend/tests/orderController.test.js
git commit -m "fix(orders): archived sizes/plates/customers never hide an order; India-date defaults; shared order facts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Editing an order never changes its advance

**Files:**
- Modify: `backend/src/controllers/orderController.js` (`updateOrder`)
- Modify: `backend/tests/orderController.test.js`

- [ ] **Step 1: Failing test**

Append to `backend/tests/orderController.test.js` (add `updateOrder` is already imported):

```js
describe("editing an order", () => {
  test("never changes its advance payment or advance column", async () => {
    const customer = await createCustomer();
    const plate = await createPlateType("0.00");
    const size = await createSize({ rate_per_kg: "100.00" });
    const created = await call(createOrder, { body: {
      customer_id: customer.id, plate_type_id: plate.id, order_date: "2026-09-10", advance_received: "500",
      product_sizes: [{ product_size_id: size.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "100.00" }],
    } });
    const id = created.body.data.id;
    await db.Payment.create({ order_id: id, customer_id: customer.id, amount: "200.00", payment_type: "PARTIAL", payment_date: "2026-09-12" });

    const res = await call(updateOrder, { params: { id }, body: { advance_received: 800, status: "COMPLETED" } });
    expect(res.status).toBe(200);

    const payments = await db.Payment.findAll({ where: { order_id: id }, order: [["amount", "ASC"]] });
    expect(payments.map((p) => [p.payment_type, p.amount])).toEqual([["PARTIAL", "200.00"], ["ADVANCE", "500.00"]]);
    const order = await db.Order.findByPk(id);
    expect(order.advance_received).toBe("500.00");
    expect(order.status).toBe("COMPLETED");
  });
});
```

Run: `cd backend && npm test -- orderController`
Expected: FAIL — the ADVANCE row became 800.00.

- [ ] **Step 2: Implement**

In `updateOrder`: remove `advance_received` from the destructured body; delete the `originalAdvance`/`newAdvance` lines, remove `advance_received: newAdvance,` from `order.update({...})`, and delete the whole `// Handle changes in advance payment` block. Add a comment above `order.update`:

```js
    // The advance is set only when an order is created. Later advances or
    // corrections are recorded as payments — editing never rewrites them.
```

Run: `cd backend && npm test -- orderController`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/orderController.js backend/tests/orderController.test.js
git commit -m "fix(orders): editing an order no longer rewrites its advance payment

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: History shows the order after the payment (+₹0 bug)

**Files:**
- Modify: `backend/src/services/auditService.js` (`calculateOrderMetrics` takes a transaction)
- Modify: `backend/src/models/payment.js` (hooks pass `options.transaction`)
- Create: `backend/tests/paymentAudit.test.js`

**Interfaces:**
- Produces: `calculateOrderMetrics(models, orderId, transaction?)`.

- [ ] **Step 1: Failing test**

Create `backend/tests/paymentAudit.test.js`:

```js
"use strict";

const db = require("../src/models");
const { createPayment, updatePayment } = require("../src/controllers/paymentController");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const call = async (fn, req) => {
  const res = mockRes();
  await fn({ query: {}, params: {}, body: {}, ...req }, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe("payment history entries", () => {
  let order;
  beforeEach(async () => {
    const customer = await createCustomer("History Co");
    const plate = await createPlateType("0.00");
    const size = await createSize({ rate_per_kg: "100.00" });
    order = await createOrderWithLines({ customer, plateType: plate, lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "100.00" }] });
  });

  test("a new payment's entry shows the order after the payment", async () => {
    const res = await call(createPayment, { body: { order_id: order.id, amount: "400", payment_type: "PARTIAL", payment_date: "2026-09-10" } });
    expect(res.status).toBe(201);
    const log = await db.AuditLog.findOne({ where: { entity_type: "PAYMENT", action: "CREATE" } });
    expect(log.metadata.before_metrics).toMatchObject({ total_received: 0, outstanding: 1000 });
    expect(log.metadata.after_metrics).toMatchObject({ total_received: 400, outstanding: 600 });
  });

  test("an edited payment's entry shows the order after the edit", async () => {
    const created = await call(createPayment, { body: { order_id: order.id, amount: "400", payment_type: "PARTIAL", payment_date: "2026-09-10" } });
    const res = await call(updatePayment, { params: { id: created.body.data.id }, body: { amount: "500" } });
    expect(res.status).toBe(200);
    const log = await db.AuditLog.findOne({ where: { entity_type: "PAYMENT", action: "UPDATE" } });
    expect(log.metadata.before_metrics).toMatchObject({ total_received: 400 });
    expect(log.metadata.after_metrics).toMatchObject({ total_received: 500, outstanding: 500 });
  });
});
```

Run: `cd backend && npm test -- paymentAudit`
Expected: FAIL — `after_metrics.total_received` is 0 (create) and 400 (update): the after-figures are read outside the transaction.

- [ ] **Step 2: Implement**

`backend/src/services/auditService.js` — `calculateOrderMetrics` gets a third parameter and passes it to the read:

```js
const calculateOrderMetrics = async (models, orderId, transaction) => {
  try {
    const { Order, Customer, PlateType, OrderProductSize, ProductSize, Payment } = models;

    // Read inside the caller's transaction so a just-written payment is seen.
    const order = await Order.findByPk(orderId, {
      include: [
        { model: Customer, as: "customer", required: false },
        { model: PlateType, as: "plateType", required: false },
        {
          model: OrderProductSize,
          as: "orderProductSizes",
          required: false,
          include: [{ model: ProductSize, as: "productSize", required: false }],
        },
        { model: Payment, as: "payments", required: false },
      ],
      transaction,
    });
```

(The rest of the function is unchanged.) Update its JSDoc with `@param {Object} [transaction] - Sequelize transaction the payment is being written in`.

`backend/src/models/payment.js` — pass the transaction in all five hook calls:
- `beforeCreate`: `calculateOrderMetrics(sequelize.models, payment.order_id, options.transaction)`
- `afterCreate`: `calculateOrderMetrics(sequelize.models, payment.order_id, options.transaction)`
- `beforeUpdate`: `calculateOrderMetrics(sequelize.models, payment.order_id, options.transaction)`
- `afterUpdate`: `calculateOrderMetrics(sequelize.models, payment.order_id, options.transaction)`
- `beforeDestroy`: `calculateOrderMetrics(sequelize.models, payment.order_id, options.transaction)`

Run: `cd backend && npm test -- paymentAudit`
Expected: PASS (2 tests).

- [ ] **Step 3: Full suite and commit**

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: all pass.

```bash
git add backend/src/services/auditService.js backend/src/models/payment.js backend/tests/paymentAudit.test.js
git commit -m "fix(history): payment history shows the order after the payment, not +₹0

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: `GET /api/orders/list` — the Orders screen's data

**Files:**
- Create: `backend/src/services/lists/orderList.js`
- Create: `backend/tests/orderList.test.js`
- Modify: `backend/src/controllers/orderController.js` (+ `listOrders`)
- Modify: `backend/src/routes/orderRoutes.js`

**Interfaces:**
- Consumes: `orderFacts`, `rupees`, `isCounted` (Task 2); `loadOrders` (Task 2); `monthStart`, `monthEnd`, `todayIST` from `services/dashboard/dateRanges.js`.
- Produces: `buildOrderList(orders, query, today) → { rows, page, hasMore, summary: { count, total, due, cancelled, matched } }`; row = `{ id, orderDate, createdAt, status, cancelled, customer: { id, name, phone }, items: [{ size, unit, quantity }], invoiceId, total, received, due }` (`due` may be negative = extra received).
- Produces: `toOrderRow(order)` (same row shape, used by Task 6), `ListError`, `paging(query, def = 30, max = 100) → { page, limit }`, `pageOf(rows, { page, limit }) → { rows, page, hasMore }`.
- HTTP: `GET /api/orders/list?chip=all|due|in_progress|this_month&search=&status=&from=&to=&page=&limit=` → `{ success, data: <buildOrderList result> }`; unknown chip → 400.

- [ ] **Step 1: Failing unit tests**

Create `backend/tests/orderList.test.js`:

```js
"use strict";

const db = require("../src/models");
const { buildOrderList, ListError } = require("../src/services/lists/orderList");
const { listOrders, getOrderById } = require("../src/controllers/orderController");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const TODAY = "2026-09-30";
const kg = (size, qty, rate) => ({ unit: "KG", quantity_kg: String(qty), rate_per_kg: String(rate), productSize: { rate_per_kg: String(rate), size_label: size } });
const pcs = (size, n) => ({ unit: "PIECES", quantity_pieces: n, price_amount: "1.0000", price_pieces_count: 1, productSize: { size_label: size, rate_per_kg: null } });
const order = (o) => ({
  id: "x", customer_id: "c1", customerName: "Alpha Bags", customerPhone: null, order_date: "2026-09-20",
  created_at: "2026-09-20T10:00:00Z", status: "DELIVERED", custom_plate_charge: null, round_off_amount: "0.00",
  advance_received: "0.00", invoice_id: null, plateType: { charge: "0.00" }, payments: [],
  orderProductSizes: [kg("14x18", 10, 100)], ...o,
});
const pay = (amount, payment_type = "PARTIAL") => ({ amount: String(amount), payment_type, payment_date: "2026-09-21" });

const ORDERS = [
  order({ id: "a", order_date: "2026-09-28", payments: [pay(400)] }),                                            // 1000, due 600
  order({ id: "b", order_date: "2026-09-28", created_at: "2026-09-28T12:00:00Z", customer_id: "c2", customerName: "Beta Stores",
          orderProductSizes: [pcs("16x20", 500)], payments: [pay(500, "FINAL")] }),                               // 500, paid
  order({ id: "c", order_date: "2026-08-15", status: "PENDING", payments: [pay(1200, "FINAL")] }),               // 1000, 200 extra
  order({ id: "d", order_date: "2026-09-02", status: "CANCELLED" }),                                             // cancelled
  order({ id: "e", order_date: "2026-07-01", status: "IN_PROGRESS" }),                                           // due 1000
];
const ids = (out) => out.rows.map((r) => r.id);

describe("buildOrderList", () => {
  test("newest first; same day by time created", () => {
    expect(ids(buildOrderList(ORDERS, {}, TODAY))).toEqual(["b", "a", "d", "c", "e"]);
  });

  test("summary leaves out cancelled orders and never nets extra received against dues", () => {
    expect(buildOrderList(ORDERS, {}, TODAY).summary).toEqual({ count: 4, total: 3500, due: 1600, cancelled: 1, matched: 5 });
  });

  test("row shape", () => {
    const rows = buildOrderList(ORDERS, {}, TODAY).rows;
    expect(rows[1]).toEqual({
      id: "a", orderDate: "2026-09-28", createdAt: "2026-09-20T10:00:00Z", status: "DELIVERED", cancelled: false,
      customer: { id: "c1", name: "Alpha Bags", phone: null }, items: [{ size: "14x18", unit: "KG", quantity: 10 }],
      invoiceId: null, total: 1000, received: 400, due: 600,
    });
    expect(rows[0].items).toEqual([{ size: "16x20", unit: "PIECES", quantity: 500 }]);
    expect(rows.find((r) => r.id === "c").due).toBe(-200);
    expect(rows.find((r) => r.id === "d").cancelled).toBe(true);
  });

  test("chips", () => {
    expect(ids(buildOrderList(ORDERS, { chip: "due" }, TODAY))).toEqual(["a", "e"]);
    expect(ids(buildOrderList(ORDERS, { chip: "in_progress" }, TODAY))).toEqual(["c", "e"]);
    const month = buildOrderList(ORDERS, { chip: "this_month" }, TODAY);
    expect(ids(month)).toEqual(["b", "a", "d"]);
    expect(month.summary.count).toBe(2);
  });

  test("search matches customer name or size, any case", () => {
    expect(ids(buildOrderList(ORDERS, { search: "beta" }, TODAY))).toEqual(["b"]);
    expect(ids(buildOrderList(ORDERS, { search: " 14X18 " }, TODAY))).toEqual(["a", "d", "c", "e"]);
  });

  test("pages of `limit`", () => {
    const p1 = buildOrderList(ORDERS, { limit: "2" }, TODAY);
    expect([ids(p1), p1.page, p1.hasMore]).toEqual([["b", "a"], 1, true]);
    const p3 = buildOrderList(ORDERS, { limit: "2", page: "3" }, TODAY);
    expect([ids(p3), p3.hasMore]).toEqual([["e"], false]);
  });

  test("unknown chip is refused", () => {
    expect(() => buildOrderList(ORDERS, { chip: "late" }, TODAY)).toThrow(ListError);
  });
});

describe("GET /orders/list", () => {
  const call = async (fn, req) => {
    const res = mockRes();
    await fn({ query: {}, params: {}, body: {}, ...req }, res);
    return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
  };

  test("totals match the order page, archived sizes included", async () => {
    const customer = await createCustomer("Gamma");
    const plate = await createPlateType("250.00");
    const size = await createSize({ rate_per_kg: "120.00" });
    const o = await createOrderWithLines({ customer, plateType: plate, lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "12.25", rate_per_kg: "120.00" }] });
    await db.Payment.create({ order_id: o.id, customer_id: customer.id, amount: "1000.00", payment_type: "PARTIAL", payment_date: "2026-09-02" });
    await size.update({ is_archived: true });

    const list = await call(listOrders, { query: {} });
    expect(list.status).toBe(200);
    const row = list.body.data.rows[0];
    const detail = (await call(getOrderById, { params: { id: o.id } })).body.data;
    expect(row.total).toBe(detail.total_amount);
    expect(row.due).toBe(detail.payment_summary.remaining_balance);
    expect(row.total).toBe(1720);
  });

  test("unknown chip → 400", async () => {
    expect((await call(listOrders, { query: { chip: "late" } })).status).toBe(400);
  });
});
```

Run: `cd backend && npm test -- orderList`
Expected: FAIL — `Cannot find module '../src/services/lists/orderList'`.

- [ ] **Step 2: Implement the builder**

Create `backend/src/services/lists/orderList.js`:

```js
"use strict";

/**
 * Orders screen list — pure: filter, sort, summarise and page the orders
 * loaded by loadOrders(). Money comes only from orderFacts, so these figures
 * equal the order page and the dashboard.
 */
const { rupees, isCounted, orderFacts } = require("../orderFacts");
const { monthStart, monthEnd } = require("../dashboard/dateRanges");

class ListError extends Error {}

const CHIPS = ["all", "due", "in_progress", "this_month"];

const paging = ({ page, limit } = {}, def = 30, max = 100) => ({
  page: Math.max(1, parseInt(page, 10) || 1),
  limit: Math.min(max, Math.max(1, parseInt(limit, 10) || def)),
});

const pageOf = (rows, { page, limit }) => ({
  rows: rows.slice((page - 1) * limit, page * limit),
  page,
  hasMore: page * limit < rows.length,
});

const itemsOf = (order) =>
  (order.orderProductSizes || []).map((line) => ({
    size: line.productSize?.size_label || "Unknown size",
    unit: line.unit === "PIECES" ? "PIECES" : "KG",
    quantity: line.unit === "PIECES" ? Number(line.quantity_pieces) : parseFloat(line.quantity_kg),
  }));

const withFacts = (order) => {
  const f = orderFacts(order);
  return {
    row: {
      id: order.id,
      orderDate: order.order_date,
      createdAt: order.created_at,
      status: order.status,
      cancelled: !isCounted(order),
      customer: { id: order.customer_id, name: order.customerName, phone: order.customerPhone },
      items: itemsOf(order),
      invoiceId: order.invoice_id || null,
      total: rupees(f.totalPaise),
      received: rupees(f.receivedPaise),
      due: rupees(f.remainingPaise),
    },
    f,
  };
};

const toOrderRow = (order) => withFacts(order).row;

const newestFirst = (a, b) => b.row.orderDate.localeCompare(a.row.orderDate) || new Date(b.row.createdAt) - new Date(a.row.createdAt);

const buildOrderList = (orders, query, today) => {
  const chip = query.chip || "all";
  if (!CHIPS.includes(chip)) throw new ListError(`Unknown filter "${chip}"`);
  const q = String(query.search || "").trim().toLowerCase();
  const from = chip === "this_month" ? monthStart(today) : query.from;
  const to = chip === "this_month" ? monthEnd(today) : query.to;

  const matches = ({ row, f }) =>
    (!q || row.customer.name.toLowerCase().includes(q) || row.items.some((i) => i.size.toLowerCase().includes(q))) &&
    (!query.status || row.status === query.status) &&
    (!from || row.orderDate >= from) &&
    (!to || row.orderDate <= to) &&
    (chip !== "due" || (!row.cancelled && f.remainingPaise > 0)) &&
    (chip !== "in_progress" || row.status === "PENDING" || row.status === "IN_PROGRESS");

  const all = orders.map(withFacts).filter(matches).sort(newestFirst);
  const counted = all.filter((x) => !x.row.cancelled);
  const summary = {
    count: counted.length,
    total: rupees(counted.reduce((s, x) => s + x.f.totalPaise, 0)),
    due: rupees(counted.reduce((s, x) => s + Math.max(0, x.f.remainingPaise), 0)),
    cancelled: all.length - counted.length,
    matched: all.length,
  };
  return { ...pageOf(all.map((x) => x.row), paging(query)), summary };
};

module.exports = { buildOrderList, toOrderRow, ListError, paging, pageOf };
```

Run: `cd backend && npm test -- orderList`
Expected: `buildOrderList` tests PASS; the two `GET /orders/list` tests FAIL (`listOrders` is not a function).

- [ ] **Step 3: Controller + route**

In `backend/src/controllers/orderController.js` add imports:

```js
const models = require("../models");
const { loadOrders } = require("../services/dashboard/ledger");
const { buildOrderList, ListError } = require("../services/lists/orderList");
```

(`todayIST` is already imported from Task 2.) Add the handler and export it:

```js
/** Orders screen: filtered, summarised, paged — figures from orderFacts. */
const listOrders = async (req, res) => {
  try {
    const orders = await loadOrders(models);
    return success(res, 200, "Orders list", buildOrderList(orders, req.query, todayIST()));
  } catch (err) {
    if (err instanceof ListError) return error(res, 400, err.message);
    console.error("Error listing orders:", err);
    return error(res, 500, "Failed to load orders", err.message);
  }
};
```

`module.exports = { createOrder, getAllOrders, listOrders, getOrderById, updateOrder, deleteOrder };`

In `backend/src/routes/orderRoutes.js`, add before `router.get('/:id', ...)`:

```js
// Orders screen list (paged, with summary) — must come before '/:id'
router.get('/list', orderController.listOrders);
```

Run: `cd backend && npm test -- orderList`
Expected: PASS (9 tests).

- [ ] **Step 4: Full suite and commit**

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: all pass.

```bash
git add backend/src/services/lists/orderList.js backend/tests/orderList.test.js backend/src/controllers/orderController.js backend/src/routes/orderRoutes.js
git commit -m "feat(orders): paged orders list endpoint with summary that leaves out cancelled orders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Customers — directory, customer page summary (by id), similar names, city/GSTIN

**Files:**
- Create: `backend/src/services/lists/customerDirectory.js`
- Create: `backend/src/services/customerSimilar.js`
- Create: `backend/src/services/customerFields.js`
- Create: `backend/tests/customerDirectory.test.js`
- Modify: `backend/src/controllers/customerController.js`
- Modify: `backend/src/routes/customerRoutes.js`
- Modify: `backend/knowledge/schema.md` (customers metadata row)

**Interfaces:**
- Consumes: `orderFacts`, `rupees`, `isCounted`, `hasAdvanceRows` (Task 2), `toOrderRow`, `paging`, `pageOf`, `ListError` (Task 5), `loadOrders` (Task 2), `daysBetween` (dateRanges).
- Produces:
  - `customerStats(orders, today) → Map<customerId, { duePaise, creditPaise, businessPaise, receivedPaise, ordersCount, lastOrderDate, oldestUnpaidDate, oldestUnpaidDays }>`
  - `buildDirectory(customers, orders, query, today) → { rows: [{ id, name, phone, city, due, ordersCount, lastOrderDate, oldestUnpaidDays }], page, hasMore, summary: { count, owingCount, due }, letters: [{ letter, index }] }` — `query.owe = "1"`, `query.sort = "name" | "recent"`, `query.search`, `page`, `limit` (default 100, max 500).
  - `buildCustomerSummary(customer, orders, today) → { customer: { id, name, phone, email, address, city, gstin, createdAt }, owes, credit, oldestUnpaidDays, totalBusiness, received, ordersCount, orders: OrderRow[], payments: [{ id, orderId, orderDate, orderCancelled, amount, type, method, date, reference, notes }], legacyAdvances: [{ orderId, orderDate, amount }] }`
  - `findSimilar(name, customers, excludeId?, limit = 5) → customer[]`
  - `readCustomerBody(body) → { name, patch, remove }`, throws `CustomerFieldError`.
  - HTTP: `GET /api/customers/directory`, `GET /api/customers/similar?name=&excludeId=` → `[{ id, name, phone, due }]`, `GET /api/customers/:id/summary`; `POST/PUT /api/customers` accept `city`, `gstin`.

- [ ] **Step 1: Failing tests**

Create `backend/tests/customerDirectory.test.js`:

```js
"use strict";

const db = require("../src/models");
const { buildDirectory, buildCustomerSummary } = require("../src/services/lists/customerDirectory");
const { findSimilar } = require("../src/services/customerSimilar");
const { readCustomerBody, CustomerFieldError } = require("../src/services/customerFields");
const { getDirectory, getCustomerSummary, getSimilar, createCustomer: createCustomerApi, updateCustomer } = require("../src/controllers/customerController");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const TODAY = "2026-09-30";
const kg = (qty, rate) => ({ unit: "KG", quantity_kg: String(qty), rate_per_kg: String(rate), productSize: { rate_per_kg: String(rate), size_label: "14x18" } });
const order = (o) => ({
  id: "x", customer_id: "c1", customerName: "alpha Bags", customerPhone: null, order_date: "2026-09-20",
  created_at: "2026-09-20T10:00:00Z", status: "DELIVERED", custom_plate_charge: null, round_off_amount: "0.00",
  advance_received: "0.00", invoice_id: null, plateType: { charge: "0.00" }, payments: [], orderProductSizes: [kg(10, 100)], ...o,
});
const pay = (amount, payment_type = "PARTIAL") => ({ id: `p${amount}`, amount: String(amount), payment_type, payment_date: "2026-09-21", payment_method: "CASH", reference_number: null, notes: null });

const CUSTOMERS = [
  { id: "c1", name: "alpha Bags", metadata: { phone: "98765 43210", city: "Bidar" }, created_at: "2025-06-01T00:00:00Z" },
  { id: "c2", name: "Beta Stores", metadata: {} },
  { id: "c3", name: "12 Star Traders", metadata: {} },
  { id: "c4", name: "Zed", metadata: { phone: "08217 453398" } },
];
const ORDERS = [
  order({ id: "a", order_date: "2026-09-28", payments: [pay(400)] }),                                   // c1 due 600
  order({ id: "e", order_date: "2026-07-01", status: "IN_PROGRESS" }),                                  // c1 due 1000, 91 days
  order({ id: "d", order_date: "2026-09-02", status: "CANCELLED" }),                                    // c1 cancelled
  order({ id: "b", customer_id: "c2", order_date: "2026-09-28", payments: [pay(1000, "FINAL")] }),     // c2 paid
  order({ id: "c", customer_id: "c3", order_date: "2026-08-15", payments: [pay(1200, "FINAL")] }),     // c3 200 extra
];
const names = (out) => out.rows.map((r) => r.name);

describe("buildDirectory", () => {
  test("A–Z with a letter index; digits under #", () => {
    const out = buildDirectory(CUSTOMERS, ORDERS, {}, TODAY);
    expect(names(out)).toEqual(["12 Star Traders", "alpha Bags", "Beta Stores", "Zed"]);
    expect(out.letters).toEqual([{ letter: "#", index: 0 }, { letter: "A", index: 1 }, { letter: "B", index: 2 }, { letter: "Z", index: 3 }]);
  });

  test("row figures: dues only from counted orders, extra received never shown as due", () => {
    const rows = buildDirectory(CUSTOMERS, ORDERS, {}, TODAY).rows;
    expect(rows[1]).toEqual({ id: "c1", name: "alpha Bags", phone: "98765 43210", city: "Bidar", due: 1600, ordersCount: 2, lastOrderDate: "2026-09-28", oldestUnpaidDays: 91 });
    expect(rows[0]).toMatchObject({ id: "c3", due: 0, ordersCount: 1 });
    expect(rows[3]).toMatchObject({ id: "c4", due: 0, ordersCount: 0, lastOrderDate: null, oldestUnpaidDays: null });
  });

  test("owe money: only customers who owe, oldest first; summary", () => {
    const out = buildDirectory(CUSTOMERS, ORDERS, { owe: "1" }, TODAY);
    expect(names(out)).toEqual(["alpha Bags"]);
    expect(out.summary).toEqual({ count: 4, owingCount: 1, due: 1600 });
    expect(out.letters).toEqual([]);
  });

  test("search by name or by 3+ phone digits", () => {
    expect(names(buildDirectory(CUSTOMERS, ORDERS, { search: "ALPHA" }, TODAY))).toEqual(["alpha Bags"]);
    expect(names(buildDirectory(CUSTOMERS, ORDERS, { search: "43210" }, TODAY))).toEqual(["alpha Bags"]);
    expect(names(buildDirectory(CUSTOMERS, ORDERS, { search: "453" }, TODAY))).toEqual(["Zed"]);
  });

  test("recent: last order first, then name; never-ordered last", () => {
    expect(names(buildDirectory(CUSTOMERS, ORDERS, { sort: "recent" }, TODAY))).toEqual(["alpha Bags", "Beta Stores", "12 Star Traders", "Zed"]);
  });
});

describe("buildCustomerSummary", () => {
  test("figures, orders and payments for one customer", () => {
    const mine = ORDERS.filter((o) => o.customer_id === "c1");
    const s = buildCustomerSummary(CUSTOMERS[0], mine, TODAY);
    expect(s.customer).toEqual({ id: "c1", name: "alpha Bags", phone: "98765 43210", email: null, address: null, city: "Bidar", gstin: null, createdAt: "2025-06-01T00:00:00Z" });
    expect([s.owes, s.credit, s.oldestUnpaidDays, s.totalBusiness, s.received, s.ordersCount]).toEqual([1600, 0, 91, 2000, 400, 2]);
    expect(s.orders.map((o) => o.id)).toEqual(["a", "d", "e"]);
    expect(s.payments).toEqual([{ id: "p400", orderId: "a", orderDate: "2026-09-28", orderCancelled: false, amount: 400, type: "PARTIAL", method: "CASH", date: "2026-09-21", reference: null, notes: null }]);
    expect(s.legacyAdvances).toEqual([]);
  });

  test("an advance kept only on the order is listed so received adds up", () => {
    const s = buildCustomerSummary(CUSTOMERS[0], [order({ id: "L", advance_received: "300.00" })], TODAY);
    expect(s.received).toBe(300);
    expect(s.legacyAdvances).toEqual([{ orderId: "L", orderDate: "2026-09-20", amount: 300 }]);
  });
});

describe("findSimilar", () => {
  const LIST = ["Sri Veerbhadreshwar", "Veerbhadreshwar Garments", "Om Sai Tailor (Gurunath)", "Anand Packaging", "Laxmi Bags"]
    .map((name, i) => ({ id: `s${i}`, name }));
  const found = (name, excludeId) => findSimilar(name, LIST, excludeId).map((c) => c.name);

  test("shared distinctive word", () => expect(found("Veerbhadreshwar Tex")).toEqual(["Sri Veerbhadreshwar", "Veerbhadreshwar Garments"]));
  test("one name inside the other", () => expect(found("Om Sai Tailor")).toEqual(["Om Sai Tailor (Gurunath)"]));
  test("same name ignoring case and spaces", () => expect(found("laxmi  BAGS")).toEqual(["Laxmi Bags"]));
  test("common trade words alone don't match", () => expect(found("Ganesh Packaging")).toEqual([]));
  test("too short to compare", () => expect(found("La")).toEqual([]));
  test("the customer being edited is not their own duplicate", () => expect(found("Laxmi Bags", "s4")).toEqual([]));
});

describe("readCustomerBody", () => {
  test("trims, uppercases GSTIN, and marks cleared fields for removal", () => {
    expect(readCustomerBody({ name: "  Laxmi  ", phone: "9876543210", city: " Bidar ", gstin: "29abcde1234f1z5", email: "" }))
      .toEqual({ name: "Laxmi", patch: { phone: "9876543210", city: "Bidar", gstin: "29ABCDE1234F1Z5" }, remove: ["email"] });
  });
  test("name is required", () => expect(() => readCustomerBody({ name: "  " })).toThrow("Customer name is required"));
  test("GSTIN must look like one", () => {
    expect(() => readCustomerBody({ name: "X", gstin: "29ABC" })).toThrow(CustomerFieldError);
    expect(() => readCustomerBody({ name: "X", gstin: "29ABC" })).toThrow("GSTIN should be 15 characters, like 29ABCDE1234F1Z5");
  });
});

describe("customer endpoints", () => {
  const call = async (fn, req) => {
    const res = mockRes();
    await fn({ query: {}, params: {}, body: {}, ...req }, res);
    return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
  };
  let plate;
  let size;
  const orderFor = (customer, qty) => createOrderWithLines({ customer, plateType: plate, lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: String(qty), rate_per_kg: "100.00" }] });

  beforeEach(async () => {
    plate = await createPlateType("0.00");
    size = await createSize({ rate_per_kg: "100.00" });
  });

  test("a customer's page shows only their orders, even when another name contains theirs", async () => {
    const mine = await createCustomer("Veerbhadreshwar");
    const other = await createCustomer("Sri Veerbhadreshwar");
    const o = await orderFor(mine, 2);
    await orderFor(other, 5);
    const res = await call(getCustomerSummary, { params: { id: mine.id } });
    expect(res.status).toBe(200);
    expect(res.body.data.orders.map((x) => x.id)).toEqual([o.id]);
    expect(res.body.data.owes).toBe(200);
  });

  test("unknown customer → 404", async () => {
    expect((await call(getCustomerSummary, { params: { id: "00000000-0000-0000-0000-000000000000" } })).status).toBe(404);
  });

  test("directory and similar names come with dues", async () => {
    const c = await createCustomer("Laxmi Bags");
    await orderFor(c, 3);
    const dir = await call(getDirectory, { query: { owe: "1" } });
    expect(dir.body.data.rows).toEqual([expect.objectContaining({ name: "Laxmi Bags", due: 300 })]);
    const sim = await call(getSimilar, { query: { name: "laxmi bags" } });
    expect(sim.body.data).toEqual([{ id: c.id, name: "Laxmi Bags", phone: null, due: 300 }]);
  });

  test("create and edit keep city and GSTIN; a bad GSTIN is refused", async () => {
    const made = await call(createCustomerApi, { body: { name: " Laxmi ", phone: "9876543210", city: "Bidar", gstin: "29abcde1234f1z5" } });
    expect(made.status).toBe(201);
    const row = await db.Customer.findByPk(made.body.data.id);
    expect([row.name, row.metadata]).toEqual(["Laxmi", { phone: "9876543210", city: "Bidar", gstin: "29ABCDE1234F1Z5" }]);

    const edited = await call(updateCustomer, { params: { id: row.id }, body: { name: "Laxmi", city: "", address: "Main road" } });
    expect(edited.status).toBe(200);
    expect((await row.reload()).metadata).toEqual({ phone: "9876543210", gstin: "29ABCDE1234F1Z5", address: "Main road" });

    expect((await call(createCustomerApi, { body: { name: "Y", gstin: "bad" } })).status).toBe(400);
  });
});
```

Run: `cd backend && npm test -- customerDirectory`
Expected: FAIL — `Cannot find module '../src/services/lists/customerDirectory'`.

- [ ] **Step 2: Implement `customerDirectory.js`**

```js
"use strict";

/**
 * Customers screen + customer page — pure builders over live customers and
 * the orders from loadOrders(). Dues count only non-cancelled orders and add
 * only positive remainders (extra received is reported, never netted).
 */
const { rupees, isCounted, hasAdvanceRows, orderFacts } = require("../orderFacts");
const { daysBetween } = require("../dashboard/dateRanges");
const { toOrderRow, paging, pageOf, ListError } = require("./orderList");

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const digitsOf = (s) => String(s || "").replace(/\D/g, "");
const letterOf = (name) => {
  const ch = String(name || "").trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(ch) ? ch : "#";
};
const SORTS = ["name", "recent"];
const EMPTY = { duePaise: 0, creditPaise: 0, businessPaise: 0, receivedPaise: 0, ordersCount: 0, lastOrderDate: null, oldestUnpaidDate: null, oldestUnpaidDays: null };

const customerStats = (orders, today) => {
  const stats = new Map();
  for (const o of orders) {
    const s = stats.get(o.customer_id) || { ...EMPTY };
    if (!s.lastOrderDate || o.order_date > s.lastOrderDate) s.lastOrderDate = o.order_date;
    if (isCounted(o)) {
      const f = orderFacts(o);
      s.ordersCount += 1;
      s.businessPaise += f.totalPaise;
      s.receivedPaise += f.receivedPaise;
      if (f.remainingPaise > 0) {
        s.duePaise += f.remainingPaise;
        if (!s.oldestUnpaidDate || o.order_date < s.oldestUnpaidDate) s.oldestUnpaidDate = o.order_date;
      } else {
        s.creditPaise += -f.remainingPaise;
      }
    }
    stats.set(o.customer_id, s);
  }
  for (const s of stats.values()) s.oldestUnpaidDays = s.oldestUnpaidDate ? Math.max(0, daysBetween(s.oldestUnpaidDate, today)) : null;
  return stats;
};

const buildDirectory = (customers, orders, query, today) => {
  const sort = query.sort || "name";
  if (!SORTS.includes(sort)) throw new ListError(`Unknown sort "${sort}"`);
  const owe = query.owe === "1" || query.owe === "true";
  const stats = customerStats(orders, today);
  const q = String(query.search || "").trim().toLowerCase();
  const qDigits = digitsOf(q);

  let rows = customers
    .map((c) => {
      const s = stats.get(c.id) || EMPTY;
      return {
        row: {
          id: c.id, name: c.name, phone: c.metadata?.phone || null, city: c.metadata?.city || null,
          due: rupees(s.duePaise), ordersCount: s.ordersCount, lastOrderDate: s.lastOrderDate, oldestUnpaidDays: s.oldestUnpaidDays,
        },
        duePaise: s.duePaise,
      };
    })
    .filter(({ row }) => !q || row.name.toLowerCase().includes(q) || (qDigits.length >= 3 && digitsOf(row.phone).includes(qDigits)));

  const owing = rows.filter((x) => x.duePaise > 0);
  const summary = { count: rows.length, owingCount: owing.length, due: rupees(owing.reduce((s, x) => s + x.duePaise, 0)) };

  if (owe) rows = owing.sort((a, b) => b.row.oldestUnpaidDays - a.row.oldestUnpaidDays || b.duePaise - a.duePaise);
  else if (sort === "recent") rows.sort((a, b) => (b.row.lastOrderDate || "").localeCompare(a.row.lastOrderDate || "") || collator.compare(a.row.name, b.row.name));
  else rows.sort((a, b) => collator.compare(a.row.name, b.row.name));

  const letters = [];
  if (!owe && sort === "name") {
    rows.forEach(({ row }, index) => {
      const letter = letterOf(row.name);
      if (!letters.length || letters[letters.length - 1].letter !== letter) letters.push({ letter, index });
    });
  }
  return { ...pageOf(rows.map((x) => x.row), paging(query, 100, 500)), summary, letters };
};

const buildCustomerSummary = (customer, orders, today) => {
  const s = customerStats(orders, today).get(customer.id) || EMPTY;
  const m = customer.metadata || {};
  const payments = orders
    .flatMap((o) => (o.payments || []).map((p) => ({
      id: p.id, orderId: o.id, orderDate: o.order_date, orderCancelled: !isCounted(o),
      amount: Number(p.amount), type: p.payment_type, method: p.payment_method, date: p.payment_date,
      reference: p.reference_number || null, notes: p.notes || null,
    })))
    .sort((a, b) => b.date.localeCompare(a.date));
  const legacyAdvances = orders
    .filter((o) => isCounted(o) && !hasAdvanceRows(o) && Number(o.advance_received || 0) > 0)
    .map((o) => ({ orderId: o.id, orderDate: o.order_date, amount: Number(o.advance_received) }));
  return {
    customer: {
      id: customer.id, name: customer.name, phone: m.phone || null, email: m.email || null, address: m.address || null,
      city: m.city || null, gstin: m.gstin || null, createdAt: customer.created_at || null,
    },
    owes: rupees(s.duePaise),
    credit: rupees(s.creditPaise),
    oldestUnpaidDays: s.oldestUnpaidDays,
    totalBusiness: rupees(s.businessPaise),
    received: rupees(s.receivedPaise),
    ordersCount: s.ordersCount,
    orders: orders.map(toOrderRow).sort((a, b) => b.orderDate.localeCompare(a.orderDate) || new Date(b.createdAt) - new Date(a.createdAt)),
    payments,
    legacyAdvances,
  };
};

module.exports = { customerStats, buildDirectory, buildCustomerSummary, letterOf };
```

- [ ] **Step 3: Implement `customerSimilar.js` and `customerFields.js`**

`backend/src/services/customerSimilar.js`:

```js
"use strict";

/**
 * "Is this shop already a customer?" — a warning, never a block.
 * Similar = same name ignoring case/spaces/punctuation (100), one name inside
 * the other (50), or sharing a distinctive word of 4+ letters (10 each).
 * Trade words every shop uses don't count as distinctive.
 */
const COMMON = new Set([
  "sri", "shri", "shree", "enterprises", "enterprise", "traders", "trading", "textiles", "textile", "garments",
  "stores", "store", "centre", "center", "sarees", "saree", "packaging", "packers", "industries", "general",
  "agency", "agencies", "bags", "company", "brothers", "sons", "mart", "shop", "house", "emporium",
]);
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const words = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
const squash = (s) => words(s).join("");
const distinctive = (s) => words(s).filter((w) => w.length >= 4 && !COMMON.has(w));

const score = (a, b) => {
  const A = squash(a);
  const B = squash(b);
  if (A.length < 3 || B.length < 3) return 0;
  if (A === B) return 100;
  if (A.includes(B) || B.includes(A)) return 50;
  const other = new Set(distinctive(b));
  return distinctive(a).filter((w) => other.has(w)).length * 10;
};

const findSimilar = (name, customers, excludeId, limit = 5) =>
  customers
    .filter((c) => c.id !== excludeId)
    .map((c) => ({ c, s: score(name, c.name) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s || collator.compare(x.c.name, y.c.name))
    .slice(0, limit)
    .map((x) => x.c);

module.exports = { findSimilar };
```

`backend/src/services/customerFields.js`:

```js
"use strict";

class CustomerFieldError extends Error {}

const OPTIONAL = ["email", "phone", "address", "city", "gstin"];
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const clean = (v) => (typeof v === "string" ? v.trim() : v);

/**
 * Request body → { name, patch, remove }. Contact fields live in metadata:
 * a value sets it, "" or null removes it, a missing key leaves it alone.
 */
const readCustomerBody = (body = {}) => {
  const name = clean(body.name);
  if (!name) throw new CustomerFieldError("Customer name is required");
  const patch = {};
  const remove = [];
  for (const key of OPTIONAL) {
    if (body[key] === undefined) continue;
    let value = clean(body[key]);
    if (value === null || value === "") {
      remove.push(key);
      continue;
    }
    if (key === "gstin") {
      value = String(value).toUpperCase();
      if (!GSTIN.test(value)) throw new CustomerFieldError("GSTIN should be 15 characters, like 29ABCDE1234F1Z5");
    }
    patch[key] = value;
  }
  return { name, patch, remove };
};

module.exports = { readCustomerBody, CustomerFieldError };
```

- [ ] **Step 4: Controller and routes**

In `backend/src/controllers/customerController.js`, change the imports to:

```js
const models = require("../models");
const { Customer } = models;
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");
const { loadOrders } = require("../services/dashboard/ledger");
const { todayIST } = require("../services/dashboard/dateRanges");
const { buildDirectory, buildCustomerSummary, customerStats } = require("../services/lists/customerDirectory");
const { ListError } = require("../services/lists/orderList");
const { findSimilar } = require("../services/customerSimilar");
const { readCustomerBody, CustomerFieldError } = require("../services/customerFields");

const liveCustomers = async () =>
  (await Customer.findAll({ where: { is_archived: false }, attributes: ["id", "name", "metadata", "created_at"] })).map((c) => c.toJSON());
```

Replace the bodies of `createCustomer` and `updateCustomer`:

```js
const createCustomer = async (req, res) => {
  try {
    const { name, patch } = readCustomerBody(req.body);
    const customer = await Customer.create({ name, metadata: patch });
    return success(res, 201, "Customer created successfully", customer);
  } catch (err) {
    if (err instanceof CustomerFieldError) return error(res, 400, err.message);
    console.error("Error creating customer:", err);
    return error(res, 500, "Failed to create customer", err.message);
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { name, patch, remove } = readCustomerBody(req.body);
    const customer = await Customer.findOne({ where: { id: req.params.id, is_archived: false } });
    if (!customer) return error(res, 404, "Customer not found");
    const metadata = { ...(customer.metadata || {}), ...patch };
    for (const key of remove) delete metadata[key];
    await customer.update({ name, metadata });
    return success(res, 200, "Customer updated successfully", customer);
  } catch (err) {
    if (err instanceof CustomerFieldError) return error(res, 400, err.message);
    console.error("Error updating customer:", err);
    return error(res, 500, "Failed to update customer", err.message);
  }
};
```

Add the three read handlers:

```js
/** Customers screen: A–Z (or owing / recent), with dues from orderFacts. */
const getDirectory = async (req, res) => {
  try {
    const [customers, orders] = await Promise.all([liveCustomers(), loadOrders(models)]);
    return success(res, 200, "Customer directory", buildDirectory(customers, orders, req.query, todayIST()));
  } catch (err) {
    if (err instanceof ListError) return error(res, 400, err.message);
    console.error("Error loading customer directory:", err);
    return error(res, 500, "Failed to load customers", err.message);
  }
};

/** Customer page: matched by customer_id — never by name. */
const getCustomerSummary = async (req, res) => {
  try {
    const customer = await Customer.findOne({ where: { id: req.params.id, is_archived: false } });
    if (!customer) return error(res, 404, "Customer not found");
    const orders = await loadOrders(models, { is_archived: false, customer_id: customer.id });
    return success(res, 200, "Customer summary", buildCustomerSummary(customer.toJSON(), orders, todayIST()));
  } catch (err) {
    console.error("Error loading customer summary:", err);
    return error(res, 500, "Failed to load customer", err.message);
  }
};

/** "Already a customer?" suggestions while typing a name. */
const getSimilar = async (req, res) => {
  try {
    const matches = findSimilar(String(req.query.name || ""), await liveCustomers(), req.query.excludeId);
    if (!matches.length) return success(res, 200, "Similar customers", []);
    const orders = await loadOrders(models, { is_archived: false, customer_id: { [Op.in]: matches.map((c) => c.id) } });
    const stats = customerStats(orders, todayIST());
    return success(res, 200, "Similar customers", matches.map((c) => ({
      id: c.id, name: c.name, phone: c.metadata?.phone || null, due: (stats.get(c.id)?.duePaise || 0) / 100,
    })));
  } catch (err) {
    console.error("Error finding similar customers:", err);
    return error(res, 500, "Failed to check customer names", err.message);
  }
};
```

Export: `module.exports = { createCustomer, getAllCustomers, getDirectory, getSimilar, getCustomerSummary, getCustomerById, updateCustomer, deleteCustomer };`

In `backend/src/routes/customerRoutes.js`, add before `router.get("/:id", ...)`:

```js
// Screens (must come before "/:id")
router.get("/directory", customerController.getDirectory);
router.get("/similar", customerController.getSimilar);
router.get("/:id/summary", customerController.getCustomerSummary);
```

In `backend/knowledge/schema.md`, change the customers `metadata` row to:

```md
| metadata | JSONB | `{phone, email, address, city, gstin}` — contact details live here, NOT in columns |
```

- [ ] **Step 5: Run and commit**

Run: `cd backend && npm test -- customerDirectory` → Expected: PASS (all).
Run: `cd backend && npm test 2>&1 | tail -5` → Expected: all pass.

```bash
git add backend/src/services/lists/customerDirectory.js backend/src/services/customerSimilar.js backend/src/services/customerFields.js backend/tests/customerDirectory.test.js backend/src/controllers/customerController.js backend/src/routes/customerRoutes.js backend/knowledge/schema.md
git commit -m "feat(customers): directory, customer summary by id, similar-name check, city and GSTIN

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Invoice money from recorded payments (incl. tax); invoices list; PDF; derived status

**Files:**
- Create: `backend/src/services/invoiceMoney.js`
- Create: `backend/src/services/lists/invoiceList.js`
- Create: `backend/tests/invoiceMoney.test.js`
- Modify: `backend/src/controllers/invoiceController.js`
- Modify: `backend/src/controllers/paymentController.js` (stop writing invoice status)
- Modify: `backend/src/routes/invoiceRoutes.js`

**Interfaces:**
- Consumes: `orderFacts`, `toPaise`, `rupees`, `signedPaise` (Task 2); `loadOrders` (Task 2); `paging`, `pageOf`, `ListError` (Task 5); `todayIST`, `addDays`, `daysBetween` (dateRanges).
- Produces:
  - `invoiceMoney(invoice, orders, invoiceOnlyPayments, today) → { amountPaid, amountDue, amountExtra, derivedStatus: "PENDING"|"OVERDUE"|"PAID"|"CANCELLED", overdueDays }`
  - `invoiceMoneyFor(models, invoices, today) → Map<invoiceId, { ...invoiceMoney, orders, invoiceOnlyPayments }>` (orders loaded WITHOUT an is_archived filter)
  - `buildInvoiceList(invoices, moneyById, query) → { rows: [{ id, number, invoiceDate, dueDate, customer: { id, name, phone }, subtotal, taxPercent, taxAmount, finalAmount, ordersCount, amountPaid, amountDue, amountExtra, derivedStatus, overdueDays }], page, hasMore, counts: { all, unpaid, overdue }, summary: { due } }`
  - HTTP: `GET /api/invoices/list?chip=all|unpaid|overdue&search=&page=`; `GET /api/invoices/:id` adds `money`, `orderMoney: [{ id, orderDate, status, deleted, total, received, due }]`, `orderPayments: [{ id, orderId, orderDate, amount, type, method, date, reference, notes }]` and keeps `payment_summary` (now from `money`); `PATCH /:id/status` accepts only `PENDING` and `CANCELLED`.

- [ ] **Step 1: Failing tests**

Create `backend/tests/invoiceMoney.test.js`:

```js
"use strict";

const db = require("../src/models");
const { invoiceMoney } = require("../src/services/invoiceMoney");
const { buildInvoiceList } = require("../src/services/lists/invoiceList");
const { generateInvoice, getInvoiceById, listInvoices, updateInvoiceStatus } = require("../src/controllers/invoiceController");
const { createPayment, updatePayment, deletePayment } = require("../src/controllers/paymentController");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const TODAY = "2026-09-30";
const order = (payments = [], o = {}) => ({
  id: "o1", status: "DELIVERED", custom_plate_charge: null, round_off_amount: "0.00", advance_received: "0.00",
  plateType: { charge: "0.00" }, orderProductSizes: [{ unit: "KG", quantity_kg: "10.00", rate_per_kg: "100.00", productSize: { rate_per_kg: "100.00" } }],
  payments, ...o,
}); // total 1000
const pay = (amount, payment_type = "PARTIAL") => ({ amount: String(amount), payment_type });
const inv = (o) => ({ final_amount: "1180.00", status: "PENDING", payment_due_date: "2026-10-30", ...o }); // 1000 + 18% GST

describe("invoiceMoney", () => {
  test("due includes tax and counts payments on the invoice's orders", () => {
    expect(invoiceMoney(inv(), [order([pay(1000, "FINAL")])], [], TODAY))
      .toEqual({ amountPaid: 1000, amountDue: 180, amountExtra: 0, derivedStatus: "PENDING", overdueDays: 0 });
  });
  test("paid in full incl. tax → PAID", () => {
    expect(invoiceMoney(inv(), [order([pay(1000), pay(180)])], [], TODAY).derivedStatus).toBe("PAID");
  });
  test("past the due date and unpaid → OVERDUE with days", () => {
    expect(invoiceMoney(inv({ payment_due_date: "2026-09-10" }), [order()], [], TODAY)).toMatchObject({ derivedStatus: "OVERDUE", overdueDays: 20, amountDue: 1180 });
  });
  test("cancelled stays cancelled", () => {
    expect(invoiceMoney(inv({ status: "CANCELLED" }), [order()], [], TODAY).derivedStatus).toBe("CANCELLED");
  });
  test("a stored PAID without payments is not trusted", () => {
    expect(invoiceMoney(inv({ status: "PAID" }), [order()], [], TODAY).derivedStatus).toBe("PENDING");
  });
  test("more received than billed shows as extra, due 0", () => {
    expect(invoiceMoney(inv(), [order([pay(1300, "FINAL")])], [], TODAY)).toMatchObject({ amountDue: 0, amountExtra: 120, derivedStatus: "PAID" });
  });
  test("refunds reduce paid; invoice-only payments count; legacy advance column counts", () => {
    const m = invoiceMoney(inv(), [order([pay(600), pay(100, "REFUND")]), order([], { id: "o2", advance_received: "200.00" })], [pay(80)], TODAY);
    expect(m.amountPaid).toBe(780);
  });
});

describe("buildInvoiceList", () => {
  const invoices = [
    { id: "i1", invoice_number: "00000031", invoice_date: "2026-07-14", payment_due_date: "2026-08-13", customer_id: "c1", customer: { name: "Sri V", metadata: { phone: "9876543210" } }, total_amount: "18000.00", tax_percent: "0.00", tax_amount: "0.00", final_amount: "18000.00" },
    { id: "i2", invoice_number: "00000033", invoice_date: "2026-09-20", payment_due_date: "2026-10-20", customer_id: "c2", customer: { name: "Bombay Saree", metadata: {} }, total_amount: "12600.00", tax_percent: "0.00", tax_amount: "0.00", final_amount: "12600.00" },
    { id: "i3", invoice_number: "00000034", invoice_date: "2026-09-28", payment_due_date: "2026-10-28", customer_id: "c3", customer: { name: "Festival Bags", metadata: {} }, total_amount: "9050.00", tax_percent: "0.00", tax_amount: "0.00", final_amount: "9050.00" },
  ];
  const money = new Map([
    ["i1", { amountPaid: 0, amountDue: 18000, amountExtra: 0, derivedStatus: "OVERDUE", overdueDays: 48, orders: [{}] }],
    ["i2", { amountPaid: 12600, amountDue: 0, amountExtra: 0, derivedStatus: "PAID", overdueDays: 0, orders: [{}, {}] }],
    ["i3", { amountPaid: 5000, amountDue: 4050, amountExtra: 0, derivedStatus: "PENDING", overdueDays: 0, orders: [{}, {}] }],
  ]);

  test("newest first, counts and total due", () => {
    const out = buildInvoiceList(invoices, money, {});
    expect(out.rows.map((r) => r.number)).toEqual(["00000034", "00000033", "00000031"]);
    expect(out.counts).toEqual({ all: 3, unpaid: 2, overdue: 1 });
    expect(out.summary).toEqual({ due: 22050 });
    expect(out.rows[0]).toEqual({
      id: "i3", number: "00000034", invoiceDate: "2026-09-28", dueDate: "2026-10-28", customer: { id: "c3", name: "Festival Bags", phone: null },
      subtotal: 9050, taxPercent: 0, taxAmount: 0, finalAmount: 9050, ordersCount: 2, amountPaid: 5000, amountDue: 4050, amountExtra: 0, derivedStatus: "PENDING", overdueDays: 0,
    });
  });
  test("chips and search", () => {
    expect(buildInvoiceList(invoices, money, { chip: "unpaid" }).rows.map((r) => r.id)).toEqual(["i3", "i1"]);
    expect(buildInvoiceList(invoices, money, { chip: "overdue" }).rows.map((r) => r.id)).toEqual(["i1"]);
    expect(buildInvoiceList(invoices, money, { search: "saree" }).rows.map((r) => r.id)).toEqual(["i2"]);
    expect(buildInvoiceList(invoices, money, { search: "031" }).rows.map((r) => r.id)).toEqual(["i1"]);
  });
});

describe("invoice endpoints", () => {
  const call = async (fn, req) => {
    const res = mockRes();
    await fn({ query: {}, params: {}, body: {}, ...req }, res);
    return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
  };
  afterEach(() => jest.useRealTimers());

  const setup = async () => {
    const customer = await createCustomer("Festival Bags");
    const plate = await createPlateType("0.00");
    const size = await createSize({ rate_per_kg: "100.00" });
    const line = { product_size_id: size.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "100.00" };
    const o1 = await createOrderWithLines({ customer, plateType: plate, order_date: "2026-09-10", lines: [line] });
    const o2 = await createOrderWithLines({ customer, plateType: plate, order_date: "2026-09-12", lines: [line] });
    return { customer, o1, o2 };
  };

  test("detail and list show due incl. tax from payments on the orders; paying never rewrites the stored status", async () => {
    const { customer, o1, o2 } = await setup();
    await db.Payment.create({ order_id: o1.id, customer_id: customer.id, amount: "1000.00", payment_type: "FINAL", payment_date: "2026-09-11" });
    const made = await call(generateInvoice, { body: { customer_id: customer.id, order_ids: [o1.id, o2.id], tax_percent: 10, payment_due_date: "2099-01-01" } });
    expect(made.status).toBe(201);
    const id = made.body.data.id;

    let detail = (await call(getInvoiceById, { params: { id } })).body.data;
    expect(detail.money).toEqual({ amountPaid: 1000, amountDue: 1200, amountExtra: 0, derivedStatus: "PENDING", overdueDays: 0 });
    expect(detail.orderMoney.map((o) => [o.orderDate, o.due])).toEqual([["2026-09-10", 0], ["2026-09-12", 1000]]);
    expect(detail.payment_summary).toEqual({ total_paid: 1000, remaining_balance: 1200, is_fully_paid: false });

    const paid = await call(createPayment, { body: { invoice_id: id, order_id: o2.id, amount: "1200", payment_type: "FINAL", payment_date: "2026-09-20" } });
    expect(paid.status).toBe(201);
    detail = (await call(getInvoiceById, { params: { id } })).body.data;
    expect(detail.money.derivedStatus).toBe("PAID");
    expect(detail.status).toBe("PENDING");
    expect(detail.orderPayments).toHaveLength(2);

    const list = (await call(listInvoices, { query: { chip: "all" } })).body.data;
    expect(list.rows[0]).toMatchObject({ id, derivedStatus: "PAID", amountDue: 0, ordersCount: 2 });
  });

  test("a deleted order's payments still count toward its invoice", async () => {
    const { customer, o1 } = await setup();
    const id = (await call(generateInvoice, { body: { customer_id: customer.id, order_ids: [o1.id] } })).body.data.id;
    await db.Payment.create({ order_id: o1.id, customer_id: customer.id, amount: "400.00", payment_type: "PARTIAL", payment_date: "2026-09-11" });
    await o1.update({ is_archived: true });
    expect((await call(getInvoiceById, { params: { id } })).body.data.money.amountPaid).toBe(400);
  });

  test("editing or deleting a payment never overwrites a cancelled invoice", async () => {
    const { customer, o1 } = await setup();
    const id = (await call(generateInvoice, { body: { customer_id: customer.id, order_ids: [o1.id] } })).body.data.id;
    const paid = await call(createPayment, { body: { invoice_id: id, order_id: o1.id, amount: "500", payment_type: "PARTIAL", payment_date: "2026-09-20" } });
    await call(updateInvoiceStatus, { params: { id }, body: { status: "CANCELLED" } });
    expect((await call(updatePayment, { params: { id: paid.body.data.id }, body: { amount: "1000" } })).status).toBe(200);
    expect((await db.Invoice.findByPk(id)).status).toBe("CANCELLED");
    expect((await call(deletePayment, { params: { id: paid.body.data.id } })).status).toBe(200);
    expect((await db.Invoice.findByPk(id)).status).toBe("CANCELLED");
  });

  test("only Pending and Cancelled can be set by hand", async () => {
    const { customer, o1 } = await setup();
    const id = (await call(generateInvoice, { body: { customer_id: customer.id, order_ids: [o1.id] } })).body.data.id;
    const res = await call(updateInvoiceStatus, { params: { id }, body: { status: "PAID" } });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Paid is worked out from recorded payments");
    expect((await call(updateInvoiceStatus, { params: { id }, body: { status: "CANCELLED" } })).status).toBe(200);
  });

  test("invoice dates default to India's today", async () => {
    const { customer, o1 } = await setup();
    jest.useFakeTimers({ now: new Date("2026-09-30T20:00:00Z"), doNotFake: ["nextTick", "setImmediate", "clearImmediate", "setTimeout", "setInterval", "clearTimeout", "clearInterval", "queueMicrotask", "performance", "hrtime"] }); // only Date is faked
    const made = (await call(generateInvoice, { body: { customer_id: customer.id, order_ids: [o1.id] } })).body.data;
    expect([made.invoice_date, made.billing_period_end, made.payment_due_date]).toEqual(["2026-10-01", "2026-10-01", "2026-10-31"]);
  });
});
```

Run: `cd backend && npm test -- invoiceMoney`
Expected: FAIL — `Cannot find module '../src/services/invoiceMoney'`. (Once the module exists, "editing or deleting a payment never overwrites a cancelled invoice" fails until Step 4 removes the status writes — the update sets it to PAID.)

- [ ] **Step 2: Implement `invoiceMoney.js`**

```js
"use strict";

/**
 * Invoice money (spec Decision 10). Due = final amount (incl. tax) − what was
 * received on the invoice's orders (orderFacts: refunds subtracted, advance
 * either/or rule) − invoice-only payments. Status is derived; only CANCELLED
 * is ever set by hand, so a stale stored PAID/PENDING is never trusted.
 */
const { Op } = require("sequelize");
const { toPaise, rupees, signedPaise, orderFacts } = require("./orderFacts");
const { loadOrders } = require("./dashboard/ledger");
const { daysBetween } = require("./dashboard/dateRanges");

const invoiceMoney = (invoice, orders, invoiceOnlyPayments, today) => {
  const paidPaise =
    orders.reduce((s, o) => s + orderFacts(o).receivedPaise, 0) + invoiceOnlyPayments.reduce((s, p) => s + signedPaise(p), 0);
  const duePaise = toPaise(invoice.final_amount) - paidPaise;
  const late = invoice.payment_due_date && invoice.payment_due_date < today ? daysBetween(invoice.payment_due_date, today) : 0;
  let derivedStatus = "PENDING";
  if (invoice.status === "CANCELLED") derivedStatus = "CANCELLED";
  else if (duePaise <= 0) derivedStatus = "PAID";
  else if (late > 0) derivedStatus = "OVERDUE";
  return {
    amountPaid: rupees(paidPaise),
    amountDue: rupees(Math.max(0, duePaise)),
    amountExtra: rupees(Math.max(0, -duePaise)),
    derivedStatus,
    overdueDays: derivedStatus === "OVERDUE" ? late : 0,
  };
};

const PAYMENT_FIELDS = ["id", "amount", "payment_type", "payment_date", "payment_method", "reference_number", "notes", "invoice_id"];

/**
 * Money for many invoices with two queries. Orders are loaded WITHOUT an
 * is_archived filter: an order deleted after invoicing was still billed, and
 * what it received still counts toward the bill.
 */
const invoiceMoneyFor = async (models, invoices, today) => {
  const ids = invoices.map((i) => i.id);
  const groups = new Map(ids.map((id) => [id, { orders: [], only: [] }]));
  if (ids.length) {
    for (const o of await loadOrders(models, { invoice_id: { [Op.in]: ids } })) groups.get(o.invoice_id).orders.push(o);
    const only = await models.Payment.findAll({ where: { invoice_id: { [Op.in]: ids }, order_id: null }, attributes: PAYMENT_FIELDS, raw: true });
    for (const p of only) groups.get(p.invoice_id).only.push(p);
  }
  return new Map(invoices.map((inv) => {
    const g = groups.get(inv.id);
    return [inv.id, { ...invoiceMoney(inv, g.orders, g.only, today), orders: g.orders, invoiceOnlyPayments: g.only }];
  }));
};

module.exports = { invoiceMoney, invoiceMoneyFor };
```

- [ ] **Step 3: Implement `invoiceList.js`**

```js
"use strict";

/** Invoices screen list — pure, over invoices + invoiceMoneyFor() results. */
const { toPaise, rupees } = require("../orderFacts");
const { paging, pageOf, ListError } = require("./orderList");

const CHIPS = ["all", "unpaid", "overdue"];
const isUnpaid = (r) => r.derivedStatus === "PENDING" || r.derivedStatus === "OVERDUE";

const buildInvoiceList = (invoices, moneyById, query) => {
  const chip = query.chip || "all";
  if (!CHIPS.includes(chip)) throw new ListError(`Unknown filter "${chip}"`);
  const q = String(query.search || "").trim().toLowerCase();

  const all = invoices
    .map((inv) => {
      const m = moneyById.get(inv.id);
      return {
        id: inv.id,
        number: inv.invoice_number,
        invoiceDate: inv.invoice_date,
        dueDate: inv.payment_due_date || null,
        customer: { id: inv.customer_id, name: inv.customer?.name || "Unknown customer", phone: inv.customer?.metadata?.phone || null },
        subtotal: Number(inv.total_amount),
        taxPercent: Number(inv.tax_percent),
        taxAmount: Number(inv.tax_amount),
        finalAmount: Number(inv.final_amount),
        ordersCount: m.orders.length,
        amountPaid: m.amountPaid,
        amountDue: m.amountDue,
        amountExtra: m.amountExtra,
        derivedStatus: m.derivedStatus,
        overdueDays: m.overdueDays,
      };
    })
    .filter((r) => !q || r.customer.name.toLowerCase().includes(q) || r.number.includes(q));

  const counts = { all: all.length, unpaid: all.filter(isUnpaid).length, overdue: all.filter((r) => r.derivedStatus === "OVERDUE").length };
  const summary = { due: rupees(all.filter(isUnpaid).reduce((s, r) => s + toPaise(r.amountDue), 0)) };
  const rows = all
    .filter((r) => chip === "all" || (chip === "unpaid" ? isUnpaid(r) : r.derivedStatus === "OVERDUE"))
    .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate) || b.number.localeCompare(a.number));
  return { ...pageOf(rows, paging(query)), counts, summary };
};

module.exports = { buildInvoiceList };
```

- [ ] **Step 4: Controller changes**

In `backend/src/controllers/invoiceController.js`:

1. Imports — add:

```js
const models = require("../models");
const { invoiceMoneyFor } = require("../services/invoiceMoney");
const { buildInvoiceList } = require("../services/lists/invoiceList");
const { ListError } = require("../services/lists/orderList");
const { rupees, orderFacts } = require("../services/orderFacts");
const { todayIST, addDays } = require("../services/dashboard/dateRanges");
```

2. `generateInvoice` — India dates. Replace `const today = new Date();` with `const today = todayIST();`, and in `Invoice.create` use:

```js
        invoice_date: today,
        billing_period_start: billing_period_start || orders[0].order_date,
        billing_period_end: billing_period_end || today,
        payment_due_date: payment_due_date || addDays(today, 30),
```

(delete the old IIFE that built the due date).

3. Add a helper and the list handler:

```js
/** money + per-order figures + every payment that counts toward the invoice. */
const moneyDetail = (m) => ({
  money: { amountPaid: m.amountPaid, amountDue: m.amountDue, amountExtra: m.amountExtra, derivedStatus: m.derivedStatus, overdueDays: m.overdueDays },
  orderMoney: m.orders
    .map((o) => {
      const f = orderFacts(o);
      return { id: o.id, orderDate: o.order_date, status: o.status, deleted: Boolean(o.is_archived), total: rupees(f.totalPaise), received: rupees(f.receivedPaise), due: rupees(f.remainingPaise) };
    })
    .sort((a, b) => a.orderDate.localeCompare(b.orderDate)),
  orderPayments: [
    ...m.orders.flatMap((o) => (o.payments || []).map((p) => ({ ...p, order_id: o.id, orderDate: o.order_date }))),
    ...m.invoiceOnlyPayments.map((p) => ({ ...p, orderDate: null })),
  ]
    .map((p) => ({ id: p.id, orderId: p.order_id || null, orderDate: p.orderDate, amount: Number(p.amount), type: p.payment_type, method: p.payment_method, date: p.payment_date, reference: p.reference_number || null, notes: p.notes || null }))
    .sort((a, b) => b.date.localeCompare(a.date)),
  payment_summary: { total_paid: m.amountPaid, remaining_balance: m.amountDue, is_fully_paid: m.derivedStatus === "PAID" },
});

const listInvoices = async (req, res) => {
  try {
    const invoices = (
      await Invoice.findAll({ where: { is_archived: false }, include: [{ model: Customer, as: "customer", attributes: ["id", "name", "metadata"], required: false }] })
    ).map((i) => i.toJSON());
    const money = await invoiceMoneyFor(models, invoices, todayIST());
    return success(res, 200, "Invoices list", buildInvoiceList(invoices, money, req.query));
  } catch (err) {
    if (err instanceof ListError) return error(res, 400, err.message);
    console.error("Error listing invoices:", err);
    return error(res, 500, "Failed to load invoices", err.message);
  }
};
```

4. `getAllInvoices` — replace the `invoicesWithPaymentInfo` mapping with:

```js
    const plain = invoices.map((i) => i.toJSON());
    const money = await invoiceMoneyFor(models, plain, todayIST());
    const invoicesWithPaymentInfo = plain.map((inv) => ({ ...inv, payment_summary: moneyDetail(money.get(inv.id)).payment_summary }));
```

5. `getInvoiceById` — replace the `totalPaid`/`remainingBalance`/`invoiceWithPaymentInfo` block with:

```js
    const plain = invoice.toJSON();
    const m = (await invoiceMoneyFor(models, [plain], todayIST())).get(plain.id);
    return success(res, 200, "Invoice retrieved successfully", { ...plain, ...moneyDetail(m) });
```

6. `updateInvoiceStatus` — replace the validation with:

```js
    if (status === "PAID") {
      await transaction.rollback();
      return error(res, 400, "Paid is worked out from recorded payments");
    }
    if (!["PENDING", "CANCELLED"].includes(status)) {
      await transaction.rollback();
      return error(res, 400, "Invalid status value");
    }
```

7. `generatePDF` — right after the `if (!invoice) { ... }` check add:

```js
    const money = (await invoiceMoneyFor(models, [invoice.toJSON()], todayIST())).get(invoice.id);
```

   In the items loop, make the first line of the loop body:

```js
      // Advance lines (negative) are not items — what was received is in the totals.
      if (parseFloat(item.total_price) < 0) continue;
```

   Replace everything from `// Calculate advance payment total from invoice items` down to and including the `doc.text(\`Rs. ${remainingAmount.toFixed(2)}\`, ...)` line with:

```js
    const totals = [
      ["Subtotal", parseFloat(invoice.total_amount)],
      [`Tax (${parseFloat(invoice.tax_percent).toFixed(2)}%)`, parseFloat(invoice.tax_amount)],
      ["Total", parseFloat(invoice.final_amount)],
      ["Received", money.amountPaid],
    ];
    doc.fontSize(12).font("Helvetica-Bold");
    for (const [label, value] of totals) {
      doc.text(label, 350, y);
      doc.text(`Rs. ${value.toFixed(2)}`, 450, y, { align: "right", width: 100 });
      y += 20;
    }
    doc.moveTo(350, y).lineTo(550, y).stroke();
    y += 20;
    // The same "Due" as the invoice page and list.
    doc.fontSize(14).text(money.amountDue > 0 ? "Due" : "Paid in full", 350, y);
    doc.text(`Rs. ${money.amountDue.toFixed(2)}`, 450, y, { align: "right", width: 100 });
```

8. Export `listInvoices` in `module.exports`.

In `backend/src/routes/invoiceRoutes.js` add before `router.get("/:id", ...)`:

```js
router.get("/list", invoiceController.listInvoices); // Invoices screen (before "/:id")
```

In `backend/src/controllers/paymentController.js`: the invoice status is derived now, so payments never write it —
- `createPayment`: delete the whole `// If this is an invoice payment, update the invoice status` block;
- `updatePayment`: delete the whole `// If this payment is associated with an invoice, update the invoice status` block;
- `deletePayment`: delete the whole `// If this payment was associated with an invoice, update the invoice status` block and the now-unused `invoiceId` variable.
(Keep the `include: [{ model: Invoice, as: "invoice" }]` lookups — the responses still return them.)

- [ ] **Step 5: Run and commit**

Run: `cd backend && npm test -- invoiceMoney invoicePieces` → Expected: PASS.
Run: `cd backend && npm test 2>&1 | tail -5` → Expected: all pass.

```bash
git add backend/src/services/invoiceMoney.js backend/src/services/lists/invoiceList.js backend/tests/invoiceMoney.test.js backend/src/controllers/invoiceController.js backend/src/controllers/paymentController.js backend/src/routes/invoiceRoutes.js
git commit -m "feat(invoices): due and status from recorded payments incl. tax; invoices list; PDF shows the same due

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Read-only cross-check covers lists, customers and invoices

**Files:**
- Modify: `backend/scripts/dashboard-verify.js`
- Modify: `backend/tests/dashboardVerify.test.js`

**Interfaces:**
- Consumes: `loadOrders`, `buildOrderList`, `buildDirectory`, `invoiceMoneyFor`.
- Produces: `verifyDashboard(...)` summary gains `lists: { ordersDue, ordersTotal, directoryDue, archivedCustomersDue }` and `invoices: { count, derived: { PENDING, OVERDUE, PAID, CANCELLED }, storedPendingNowPaid, taxed: [{ number, finalAmount, amountDue }], doubleInvoicedOrders: [] }`.

- [ ] **Step 1: Failing test**

Append to `backend/tests/dashboardVerify.test.js`:

```js
test("verification covers the orders list, customer directory and invoices", async () => {
  const { generateInvoice } = require("../src/controllers/invoiceController");
  const { mockRes } = require("./helpers/http");
  const today = todayIST();
  const c = await createCustomer("Epsilon");
  const plate = await createPlateType("0.00");
  const size = await createSize({ rate_per_kg: "100.00" });
  const line = { product_size_id: size.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "100.00" };
  const o = await createOrderWithLines({ customer: c, plateType: plate, order_date: addDays(today, -5), lines: [line] });
  await db.Payment.create({ order_id: o.id, customer_id: c.id, amount: "1000.00", payment_type: "FINAL", payment_date: today });
  const res = mockRes();
  await generateInvoice({ body: { customer_id: c.id, order_ids: [o.id], tax_percent: 10 } }, res);
  expect(res.status.mock.calls[0][0]).toBe(201);

  const result = await verifyDashboard(db.sequelize, db, today);
  expect(result.problems).toEqual([]);
  expect(result.summary.lists).toEqual({ ordersDue: 0, ordersTotal: 1000, directoryDue: 0, archivedCustomersDue: 0 });
  expect(result.summary.invoices).toEqual({
    count: 1, derived: { PENDING: 1, OVERDUE: 0, PAID: 0, CANCELLED: 0 }, storedPendingNowPaid: 0,
    taxed: [{ number: "00000001", finalAmount: 1100, amountDue: 100 }], doubleInvoicedOrders: [],
  });
});
```

Run: `cd backend && npm test -- dashboardVerify`
Expected: FAIL — `summary.lists` is undefined.

- [ ] **Step 2: Implement**

In `backend/scripts/dashboard-verify.js` add imports:

```js
const { loadOrders } = require("../src/services/dashboard/ledger");
const { buildOrderList } = require("../src/services/lists/orderList");
const { buildDirectory } = require("../src/services/lists/customerDirectory");
const { invoiceMoneyFor } = require("../src/services/invoiceMoney");
```

Before the `return {` of `verifyDashboard`, add:

```js
  // Orders screen and Customers screen must show the dashboard's money.
  const orders = await loadOrders(models);
  const list = buildOrderList(orders, { limit: 1 }, today);
  if (paise(list.summary.due) !== paise(overview.toCollect)) problems.push(`orders list due ₹${list.summary.due} vs dashboard ₹${overview.toCollect}`);
  if (paise(list.summary.total) !== paise(all.sales.value)) problems.push(`orders list total ₹${list.summary.total} vs dashboard sales ₹${all.sales.value}`);

  const customers = (await models.Customer.findAll({ attributes: ["id", "name", "metadata", "is_archived"] })).map((x) => x.toJSON());
  const live = customers.filter((x) => !x.is_archived);
  const liveIds = new Set(live.map((x) => x.id));
  const directory = buildDirectory(live, orders, { limit: 1 }, today);
  // Dues of archived customers are on the dashboard but not in the directory — reported, and they must close the gap.
  const archivedDue = overview.customers.filter((x) => !liveIds.has(x.id)).reduce((s, x) => s + paise(x.amount), 0);
  if (paise(directory.summary.due) + archivedDue !== paise(overview.toCollect)) problems.push(`directory due ₹${directory.summary.due} + archived ₹${archivedDue / 100} vs dashboard ₹${overview.toCollect}`);

  // Invoices: app figures against independent SQL.
  const invoices = (await models.Invoice.findAll({ where: { is_archived: false } })).map((x) => x.toJSON());
  const money = await invoiceMoneyFor(models, invoices, today);
  const sqlPaid = Object.fromEntries((await q(`
    SELECT i.id,
      COALESCE((SELECT SUM(CASE WHEN p.payment_type = 'REFUND' THEN -p.amount ELSE p.amount END)
                FROM payments p JOIN orders o ON o.id = p.order_id
                WHERE o.invoice_id = i.id AND p.payment_type <> 'ADVANCE'), 0)
      + COALESCE((SELECT SUM(CASE WHEN adv.amount > 0 THEN adv.amount ELSE COALESCE(o.advance_received, 0) END)
                  FROM orders o CROSS JOIN LATERAL (SELECT COALESCE(SUM(p.amount), 0) AS amount FROM payments p
                                                    WHERE p.order_id = o.id AND p.payment_type = 'ADVANCE') adv
                  WHERE o.invoice_id = i.id), 0)
      + COALESCE((SELECT SUM(CASE WHEN p.payment_type = 'REFUND' THEN -p.amount ELSE p.amount END)
                  FROM payments p WHERE p.invoice_id = i.id AND p.order_id IS NULL), 0) AS paid
    FROM invoices i WHERE NOT i.is_archived`)).map((r) => [r.id, paise(r.paid)]));
  const derived = { PENDING: 0, OVERDUE: 0, PAID: 0, CANCELLED: 0 };
  let storedPendingNowPaid = 0;
  const taxed = [];
  for (const inv of invoices) {
    const m = money.get(inv.id);
    derived[m.derivedStatus] += 1;
    if (inv.status === "PENDING" && m.derivedStatus === "PAID") storedPendingNowPaid += 1;
    if (Number(inv.tax_amount) > 0) taxed.push({ number: inv.invoice_number, finalAmount: Number(inv.final_amount), amountDue: m.amountDue });
    if (paise(m.amountPaid) !== sqlPaid[inv.id]) problems.push(`invoice ${inv.invoice_number}: paid ₹${m.amountPaid} vs SQL ₹${sqlPaid[inv.id] / 100}`);
  }
  const doubleInvoicedOrders = (await q(`
    SELECT ii.order_id FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
    WHERE NOT i.is_archived AND i.status <> 'CANCELLED' AND ii.order_id IS NOT NULL
    GROUP BY ii.order_id HAVING COUNT(DISTINCT ii.invoice_id) > 1`)).map((r) => r.order_id);
  if (doubleInvoicedOrders.length) problems.push(`${doubleInvoicedOrders.length} order(s) on more than one active invoice — their payments would count twice`);
```

In the returned `summary` object add:

```js
               lists: { ordersDue: list.summary.due, ordersTotal: list.summary.total, directoryDue: directory.summary.due, archivedCustomersDue: archivedDue / 100 },
               invoices: { count: invoices.length, derived, storedPendingNowPaid, taxed, doubleInvoicedOrders },
```

Run: `cd backend && npm test -- dashboardVerify` → Expected: PASS (3 tests).

- [ ] **Step 3: Run the cross-check against the local copy of production**

The UX copy runs in Docker `yars-uxcopy` on port 5434.

Run: `cd backend && NODE_ENV=test DB_HOSTNAME=localhost DB_PORT=5434 DB_NAME=yars_uxcopy DB_USERNAME=yars DB_PASSWORD=yars node scripts/dashboard-verify.js`
Expected: `✅ Dashboard figures agree with independent SQL.` The summary shows `invoices.count` 31, `storedPendingNowPaid` around 24, one taxed invoice, `doubleInvoicedOrders: []`. Record the printed `lists` and `invoices` blocks in the ledger. If `problems` is not empty, stop and apply superpowers:systematic-debugging — never adjust the check to pass.

- [ ] **Step 4: Full suite and commit**

Run: `cd backend && npm test 2>&1 | tail -5` → Expected: all pass.

```bash
git add backend/scripts/dashboard-verify.js backend/tests/dashboardVerify.test.js
git commit -m "chore(verify): cross-check orders list, customer directory and invoice dues against SQL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: Frontend helpers (pure, tested) — dates, numbers, payment type, mobile, grouping, labels

**Files (all under `frontend/src/`):**
- Create: `utils/istDate.js`, `utils/istDate.test.js`
- Create: `utils/numberInput.js`, `utils/numberInput.test.js`
- Create: `utils/paymentType.js`, `utils/paymentType.test.js`
- Modify: `utils/phone.js`; Create: `utils/mobile.test.js`
- Create: `utils/dayGroups.js`, `utils/alphaIndex.js`, `utils/itemsText.js`, `utils/grouping.test.js`
- Create: `utils/statusMeta.js`
- Create: `lib/errors.js`, `lib/errors.test.js`

**Interfaces (Produces):**
- `istDate.js`: `todayIST(now?) → "YYYY-MM-DD"`, `addDays(d, n)`, `daysBetween(a, b)`, `isISODate(s)`
- `numberInput.js`: `parseNumber(text, { dp = 2, whole = false, allowZero = false, signed = false }) → { value: number|null, error: string|null }` (empty text → `{ value: null, error: null }`)
- `paymentType.js`: `paymentTypeFor(amount, due) → "FINAL"|"PARTIAL"`, `overpayment(amount, due) → number`, `PAYMENT_TYPE_LABEL`, `PAYMENT_METHODS` (`[[value, label]]`)
- `phone.js` (added): `mobileDigits(typed) → string`, `mobileStatus(typed) → "empty"|"valid"|"invalid"`, `formatMobile(digits) → "98765 43210"`
- `dayGroups.js`: `dayLabel(date, today)`, `groupByDay(rows, today, dateOf = (r) => r.orderDate) → [{ date, label, rows }]`
- `alphaIndex.js`: `letterOf(name)` (same rule as the backend: A–Z or "#"), `groupByLetter(rows) → [{ letter, rows }]`
- `itemsText.js`: `qtyText(item)`, `itemsText(items)`, `itemsFromLines(orderProductSizes) → [{ size, unit, quantity }]`
- `statusMeta.js`: `ORDER_STATUS`, `ORDER_FLOW`, `INVOICE_STATUS`, `TONE_CLASS`
- `lib/errors.js`: `errorText(err, fallback) → string`

- [ ] **Step 1: Write the failing tests**

`frontend/src/utils/istDate.test.js`:

```js
import { describe, expect, test } from "vitest";
import { todayIST, addDays, daysBetween, isISODate } from "./istDate";

describe("istDate", () => {
  test("today is India's date, not UTC's", () => {
    expect(todayIST(new Date("2026-09-30T19:00:00Z"))).toBe("2026-10-01");
    expect(todayIST(new Date("2026-09-30T18:00:00Z"))).toBe("2026-09-30");
  });
  test("day arithmetic across months", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-07-01", "2026-09-30")).toBe(91);
  });
  test("only real calendar dates are dates", () => {
    expect(isISODate("2026-02-28")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("30/09/2026")).toBe(false);
  });
});
```

`frontend/src/utils/numberInput.test.js`:

```js
import { describe, expect, test } from "vitest";
import { parseNumber } from "./numberInput";

const ok = (value) => ({ value, error: null });
const bad = (error) => ({ value: null, error });

describe("parseNumber", () => {
  test("money / kg: up to 2 decimals", () => {
    expect(parseNumber("12.25")).toEqual(ok(12.25));
    expect(parseNumber("12.255")).toEqual(bad("Use at most 2 decimals"));
    expect(parseNumber("1,250.5")).toEqual(ok(1250.5));
    expect(parseNumber(" 12. ")).toEqual(ok(12));
    expect(parseNumber(".5")).toEqual(ok(0.5));
  });
  test("empty is not an error — the caller decides if it's required", () => {
    expect(parseNumber("")).toEqual(ok(null));
    expect(parseNumber(null)).toEqual(ok(null));
  });
  test("zero, text, too large", () => {
    expect(parseNumber("0")).toEqual(bad("Must be more than 0"));
    expect(parseNumber("0", { allowZero: true })).toEqual(ok(0));
    expect(parseNumber("12kg")).toEqual(bad("Enter a number"));
    expect(parseNumber("100000000")).toEqual(bad("That number is too large"));
  });
  test("whole numbers for pieces", () => {
    expect(parseNumber("10000", { whole: true })).toEqual(ok(10000));
    expect(parseNumber("10.5", { whole: true })).toEqual(bad("Whole numbers only"));
    expect(parseNumber("0", { whole: true })).toEqual(bad("Must be at least 1"));
  });
  test("piece price up to 4 decimals, weight up to 3", () => {
    expect(parseNumber("0.3750", { dp: 4 })).toEqual(ok(0.375));
    expect(parseNumber("0.37501", { dp: 4 })).toEqual(bad("Use at most 4 decimals"));
    expect(parseNumber("1.2345", { dp: 3 })).toEqual(bad("Use at most 3 decimals"));
  });
  test("round off may be negative", () => {
    expect(parseNumber("-5", { signed: true, allowZero: true })).toEqual(ok(-5));
    expect(parseNumber("-5")).toEqual(bad("Enter a number"));
  });
});
```

`frontend/src/utils/paymentType.test.js`:

```js
import { describe, expect, test } from "vitest";
import { paymentTypeFor, overpayment } from "./paymentType";

describe("payment type follows the amount", () => {
  test("paying the whole due is final, less is part", () => {
    expect(paymentTypeFor(1000, 1000)).toBe("FINAL");
    expect(paymentTypeFor(999.99, 1000)).toBe("PARTIAL");
    expect(paymentTypeFor(500, 0)).toBe("FINAL");
  });
  test("overpayment in exact paise", () => {
    expect(overpayment(1200, 1000)).toBe(200);
    expect(overpayment(900, 1000)).toBe(0);
    expect(overpayment(0.3, 0.1)).toBe(0.2);
  });
});
```

`frontend/src/utils/mobile.test.js`:

```js
import { describe, expect, test } from "vitest";
import { mobileDigits, mobileStatus, formatMobile } from "./phone";

describe("mobile field", () => {
  test("strips +91, a leading 0 and spaces", () => {
    expect(mobileDigits("+91 98765 43210")).toBe("9876543210");
    expect(mobileDigits("098765-43210")).toBe("9876543210");
  });
  test("status", () => {
    expect(mobileStatus("")).toBe("empty");
    expect(mobileStatus("98765")).toBe("invalid");
    expect(mobileStatus("5876543210")).toBe("invalid");
    expect(mobileStatus("98765 43210")).toBe("valid");
  });
  test("display", () => expect(formatMobile("9876543210")).toBe("98765 43210"));
});
```

`frontend/src/utils/grouping.test.js`:

```js
import { describe, expect, test } from "vitest";
import { groupByDay } from "./dayGroups";
import { letterOf, groupByLetter } from "./alphaIndex";
import { itemsText, itemsFromLines } from "./itemsText";
import { shortDate } from "./dashboardFormat";

describe("groupByDay", () => {
  test("keeps order; Today / Yesterday / date labels", () => {
    const rows = [{ id: 1, orderDate: "2026-09-30" }, { id: 2, orderDate: "2026-09-30" }, { id: 3, orderDate: "2026-09-29" }, { id: 4, orderDate: "2026-09-01" }];
    expect(groupByDay(rows, "2026-09-30")).toEqual([
      { date: "2026-09-30", label: "Today", rows: [rows[0], rows[1]] },
      { date: "2026-09-29", label: "Yesterday", rows: [rows[2]] },
      { date: "2026-09-01", label: shortDate("2026-09-01"), rows: [rows[3]] },
    ]);
  });
});

describe("letters", () => {
  test("A–Z or # (same rule as the server)", () => {
    expect([letterOf("alpha"), letterOf("  zed"), letterOf("12 Star"), letterOf("")]).toEqual(["A", "Z", "#", "#"]);
  });
  test("groups consecutive names", () => {
    const rows = [{ name: "12 Star" }, { name: "Alpha" }, { name: "anand" }, { name: "Beta" }];
    expect(groupByLetter(rows).map((g) => [g.letter, g.rows.length])).toEqual([["#", 1], ["A", 2], ["B", 1]]);
  });
});

describe("itemsText", () => {
  test("first item and how many more", () => {
    expect(itemsText([{ size: "14x18", unit: "KG", quantity: 30 }])).toBe("14x18 · 30 kg");
    expect(itemsText([{ size: "14x18", unit: "KG", quantity: 12.25 }, { size: "16x20", unit: "PIECES", quantity: 10000 }])).toBe("14x18 · 12.25 kg +1 more");
    expect(itemsText([{ size: "16x20", unit: "PIECES", quantity: 10000 }])).toBe("16x20 · 10,000 pcs");
    expect(itemsText([])).toBe("No items");
  });
  test("from saved order lines", () => {
    expect(itemsFromLines([
      { unit: "KG", quantity_kg: "12.25", productSize: { size_label: "14x18" } },
      { unit: "PIECES", quantity_pieces: 500, productSize: null },
    ])).toEqual([{ size: "14x18", unit: "KG", quantity: 12.25 }, { size: "Unknown size", unit: "PIECES", quantity: 500 }]);
  });
});
```

`frontend/src/lib/errors.test.js`:

```js
import { describe, expect, test } from "vitest";
import { errorText } from "./errors";

describe("errorText", () => {
  test("server message first, then the fallback", () => {
    expect(errorText({ response: { data: { message: "Customer name is required" } } }, "Couldn't save")).toBe("Customer name is required");
    expect(errorText(new Error("Network Error"), "Couldn't save")).toBe("Couldn't save");
  });
});
```

Run: `cd frontend && npx vitest run src/utils src/lib`
Expected: FAIL — the new modules don't exist (the 67 existing tests still pass).

- [ ] **Step 2: Implement**

`frontend/src/utils/istDate.js`:

```js
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
const DAY = 86400000;
const toMs = (d) => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};

/** Today's date in India as "YYYY-MM-DD". Never use toISOString() for a date — that is UTC. */
export const todayIST = (now = new Date()) => fmt.format(now);
export const addDays = (d, n) => new Date(toMs(d) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((toMs(b) - toMs(a)) / DAY);
export const isISODate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;
```

`frontend/src/utils/numberInput.js`:

```js
const MAX = 99999999.99; // DECIMAL(10,2)

/**
 * Text typed in a number box → { value, error }. Never NaN. Empty → { null, null }:
 * the caller decides whether the field is required. Commas are ignored ("1,250").
 */
export const parseNumber = (text, { dp = 2, whole = false, allowZero = false, signed = false } = {}) => {
  const t = String(text ?? "").trim().replace(/,/g, "");
  if (t === "") return { value: null, error: null };
  const sign = signed ? "-?" : "";
  if (whole) {
    if (!new RegExp(`^${sign}\\d+$`).test(t)) return { value: null, error: "Whole numbers only" };
  } else {
    if (!new RegExp(`^${sign}(\\d+(\\.\\d*)?|\\.\\d+)$`).test(t)) return { value: null, error: "Enter a number" };
    if ((t.split(".")[1] || "").length > dp) return { value: null, error: `Use at most ${dp} decimals` };
  }
  const value = Number(t);
  if (Math.abs(value) > MAX) return { value: null, error: "That number is too large" };
  if (value === 0 && !allowZero) return { value: null, error: whole ? "Must be at least 1" : "Must be more than 0" };
  return { value, error: null };
};
```

`frontend/src/utils/paymentType.js`:

```js
/** Spec Decision 4: the type follows the amount — the whole due is final, less is a part payment. */
export const paymentTypeFor = (amount, due) => (Number(amount) >= Number(due) ? "FINAL" : "PARTIAL");

/** How much more than the due is being paid, exact to the paisa. */
export const overpayment = (amount, due) => Math.max(0, Math.round(Number(amount) * 100) - Math.round(Number(due) * 100)) / 100;

export const PAYMENT_TYPE_LABEL = { ADVANCE: "Advance", PARTIAL: "Part payment", FINAL: "Final payment", REFUND: "Refund" };

export const PAYMENT_METHODS = [["CASH", "Cash"], ["UPI", "UPI"], ["BANK_TRANSFER", "Bank"], ["CHECK", "Cheque"], ["OTHER", "Other"]];
```

Append to `frontend/src/utils/phone.js`:

```js
/** What was typed in the +91 box → just the 10 digits (drops +91 / leading 0 / spaces). */
export const mobileDigits = (typed) => {
  let d = String(typed || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
};
export const mobileStatus = (typed) => {
  const d = mobileDigits(typed);
  if (!d) return "empty";
  return /^[6-9]\d{9}$/.test(d) ? "valid" : "invalid";
};
export const formatMobile = (d) => (d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d);
```

`frontend/src/utils/dayGroups.js`:

```js
import { addDays } from "./istDate";
import { shortDate } from "./dashboardFormat";

export const dayLabel = (date, today) => (date === today ? "Today" : date === addDays(today, -1) ? "Yesterday" : shortDate(date));

/** Rows already sorted newest first → consecutive day groups, order kept. */
export const groupByDay = (rows, today, dateOf = (r) => r.orderDate) => {
  const groups = [];
  for (const row of rows) {
    const date = dateOf(row);
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.rows.push(row);
    else groups.push({ date, label: dayLabel(date, today), rows: [row] });
  }
  return groups;
};
```

`frontend/src/utils/alphaIndex.js`:

```js
/** Must match backend services/lists/customerDirectory.js letterOf. */
export const letterOf = (name) => {
  const ch = String(name || "").trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(ch) ? ch : "#";
};

export const groupByLetter = (rows) => {
  const groups = [];
  for (const row of rows) {
    const letter = letterOf(row.name);
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) last.rows.push(row);
    else groups.push({ letter, rows: [row] });
  }
  return groups;
};
```

`frontend/src/utils/itemsText.js`:

```js
import { formatNumber } from "./formatters";

export const qtyText = (item) => (item.unit === "PIECES" ? `${formatNumber(item.quantity, 0)} pcs` : `${formatNumber(item.quantity, 2)} kg`);

/** "14x18 · 30 kg +1 more" — one line for list rows. */
export const itemsText = (items) => {
  if (!items.length) return "No items";
  const first = `${items[0].size} · ${qtyText(items[0])}`;
  return items.length === 1 ? first : `${first} +${items.length - 1} more`;
};

/** Saved order lines (API shape) → list items. */
export const itemsFromLines = (lines = []) =>
  lines.map((l) => ({
    size: l.productSize?.size_label || "Unknown size",
    unit: l.unit === "PIECES" ? "PIECES" : "KG",
    quantity: l.unit === "PIECES" ? Number(l.quantity_pieces) : parseFloat(l.quantity_kg),
  }));
```

`frontend/src/utils/statusMeta.js`:

```js
/** The one place status names and colours are decided. */
export const ORDER_STATUS = {
  PENDING: { label: "Pending", tone: "warn" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  COMPLETED: { label: "Completed", tone: "good" },
  DELIVERED: { label: "Delivered", tone: "good" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
};
export const ORDER_FLOW = ["PENDING", "IN_PROGRESS", "COMPLETED", "DELIVERED"];
export const INVOICE_STATUS = {
  PENDING: { label: "Unpaid", tone: "warn" },
  OVERDUE: { label: "Overdue", tone: "critical" },
  PAID: { label: "Paid", tone: "good" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
};
export const TONE_CLASS = {
  good: "bg-status-good/15 text-status-good",
  warn: "bg-status-warn/15 text-status-warn",
  critical: "bg-status-critical/15 text-status-critical",
  info: "bg-brass/15 text-brass",
  muted: "bg-raised text-ink-2",
};
```

`frontend/src/lib/errors.js`:

```js
/** The server's message when it sent one (they are written for people), else the fallback. */
export const errorText = (err, fallback) => err?.response?.data?.message || fallback;
```

- [ ] **Step 3: Run the tests**

Run: `cd frontend && npx vitest run 2>&1 | tail -4`
Expected: PASS — 67 existing + the new ones.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/istDate.js frontend/src/utils/istDate.test.js frontend/src/utils/numberInput.js frontend/src/utils/numberInput.test.js frontend/src/utils/paymentType.js frontend/src/utils/paymentType.test.js frontend/src/utils/phone.js frontend/src/utils/mobile.test.js frontend/src/utils/dayGroups.js frontend/src/utils/alphaIndex.js frontend/src/utils/itemsText.js frontend/src/utils/grouping.test.js frontend/src/utils/statusMeta.js frontend/src/lib/errors.js frontend/src/lib/errors.test.js
git commit -m "feat(ui): India-date, number, payment-type, mobile and grouping helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The component kit (`frontend/src/ui/`)

Components are verified visually in Task 21 (no DOM test runner in this repo; their logic lives in the Task 9 helpers). Every file uses theme tokens only.

The spec's kit items "GroupedList" and "Row" are realised as the `groupByDay` / `groupByLetter` helpers + `useInfiniteSentinel` plus one memoised row component per feature (`OrderRow`, `CustomerRow`, `InvoiceRow`) — each list's row differs too much for one generic Row. Replaced legacy files are deleted together in Task 20, after the last screen that used them is gone.

**Files:** Create `frontend/src/ui/` — `styles.js`, `Button.jsx`, `IconButton.jsx`, `Chips.jsx`, `Field.jsx`, `TextInput.jsx`, `NumberInput.jsx`, `PhoneInput.jsx`, `DateField.jsx`, `Switch.jsx`, `Tabs.jsx`, `Sheet.jsx`, `ConfirmDialog.jsx`, `ActionSheet.jsx`, `SearchPicker.jsx`, `StickyFooter.jsx`, `Stepper.jsx`, `PageHeader.jsx`, `Money.jsx`, `StatusBadge.jsx`, `States.jsx`, `useDebounced.js`, `useInfiniteSentinel.js`.

**Interfaces (Produces)** — props:
- `buttonClass({ variant: "primary"|"secondary"|"ghost"|"danger", size: "sm"|"md"|"lg", block })`, `INPUT`, `INPUT_INVALID` (styles.js)
- `<Button variant size block loading type ...>`; `<IconButton label ...>` (label required → aria-label)
- `<Chips label options=[{ value, label, count? }] value onChange>`
- `<Field label htmlFor hint? error? optional?>{single input}</Field>` — gives the child `id`, `aria-invalid`, `aria-describedby`
- `<TextInput ...input props>`; `<NumberInput value onChange(text) prefix? suffix? whole? signed?>`; `<PhoneInput value onChange(text)>`; `<DateField value onChange(date) quick?>`; `<Switch checked onChange label description?>`
- `<Tabs label tabs=[{ value, label }] value onChange>`, `<TabPanel value>{children}</TabPanel>`
- `<Sheet open title onClose footer?>`; `<ConfirmDialog open title message confirmLabel cancelLabel? tone? busy? onConfirm onClose>`; `<ActionSheet open title actions=[{ label, onSelect, tone?, icon? }] onClose>`
- `<SearchPicker open title query onQuery placeholder loading error items getKey renderItem onPick onClose empty footer?>`
- `<StickyFooter>`, `<Stepper steps current reached onGo>`, `<PageHeader title subtitle? actions?>`
- `<Money value className?>`, `<DueText due className?>`, `<StatusBadge kind="order"|"invoice" status>`
- `<EmptyState title body? action?>`, `<ErrorState title? onRetry>`, `<ListSkeleton rows?>`, `<PageSkeleton>`
- `useDebounced(value, ms = 250)`, `useInfiniteSentinel({ hasNextPage, isFetchingNextPage, fetchNextPage }) → ref`

- [ ] **Step 1: styles, buttons, chips, fields and inputs**

`frontend/src/ui/styles.js`:

```js
/** Shared class strings for the kit (kept out of component files). */
const BUTTON = {
  base: "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass",
  primary: "bg-brass text-brass-on hover:brightness-110",
  secondary: "bg-raised text-ink hover:bg-line",
  ghost: "text-ink-2 hover:bg-raised hover:text-ink",
  danger: "bg-status-critical/15 text-status-critical hover:bg-status-critical/25",
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-[0.95rem]",
};

export const buttonClass = ({ variant = "primary", size = "md", block = false } = {}) =>
  `${BUTTON.base} ${BUTTON[variant]} ${BUTTON[size]}${block ? " w-full" : ""}`;

export const INPUT =
  "h-12 w-full rounded-2xl border border-line bg-surface px-3.5 text-[0.95rem] text-ink placeholder:text-ink-2/60 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/25 disabled:opacity-60";
export const INPUT_INVALID = "border-status-critical focus:border-status-critical focus:ring-status-critical/25";
```

`frontend/src/ui/Button.jsx`:

```jsx
import PropTypes from "prop-types";
import { buttonClass } from "./styles";

export default function Button({ variant = "primary", size = "md", block = false, loading = false, type = "button", className = "", disabled, children, ...rest }) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={`${buttonClass({ variant, size, block })} ${className}`} {...rest}>
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
      {children}
    </button>
  );
}

Button.propTypes = {
  variant: PropTypes.oneOf(["primary", "secondary", "ghost", "danger"]),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  block: PropTypes.bool,
  loading: PropTypes.bool,
  type: PropTypes.oneOf(["button", "submit"]),
  className: PropTypes.string,
  disabled: PropTypes.bool,
  children: PropTypes.node,
};
```

`frontend/src/ui/IconButton.jsx`:

```jsx
import PropTypes from "prop-types";

/** Icon-only button: `label` is required and becomes its accessible name. */
export default function IconButton({ label, className = "", children, ...rest }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-raised text-ink transition hover:bg-line active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass ${className}`} {...rest}>
      {children}
    </button>
  );
}

IconButton.propTypes = { label: PropTypes.string.isRequired, className: PropTypes.string, children: PropTypes.node };
```

`frontend/src/ui/Chips.jsx`:

```jsx
import PropTypes from "prop-types";

export default function Chips({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)}
            className={`h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass ${
              on ? "border-brass bg-brass text-brass-on" : "border-line bg-surface text-ink-2 hover:text-ink"}`}>
            {o.label}
            {o.count !== undefined && o.count !== null && <span className="ml-1.5 font-num tabular-nums opacity-80">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

Chips.propTypes = {
  label: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string.isRequired, label: PropTypes.string.isRequired, count: PropTypes.number })).isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};
```

`frontend/src/ui/Field.jsx`:

```jsx
import { cloneElement, isValidElement } from "react";
import PropTypes from "prop-types";

/** Label + one input + error (or hint). Wires id / aria-invalid / aria-describedby onto the input. */
export default function Field({ label, htmlFor, hint, error, optional = false, children }) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  const input = isValidElement(children)
    ? cloneElement(children, { id: htmlFor, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })
    : children;
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[0.8rem] font-semibold text-ink-2">
        {label}
        {optional && <span className="font-normal"> (optional)</span>}
      </label>
      {input}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-status-critical">{error}</p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-ink-2">{hint}</p>
      ) : null}
    </div>
  );
}

Field.propTypes = { label: PropTypes.node.isRequired, htmlFor: PropTypes.string.isRequired, hint: PropTypes.node, error: PropTypes.string, optional: PropTypes.bool, children: PropTypes.node.isRequired };
```

`frontend/src/ui/TextInput.jsx`:

```jsx
import PropTypes from "prop-types";
import { INPUT, INPUT_INVALID } from "./styles";

export default function TextInput({ className = "", ...rest }) {
  return <input className={`${INPUT} ${rest["aria-invalid"] ? INPUT_INVALID : ""} ${className}`} {...rest} />;
}

TextInput.propTypes = { className: PropTypes.string };
```

`frontend/src/ui/NumberInput.jsx`:

```jsx
import PropTypes from "prop-types";
import { INPUT, INPUT_INVALID } from "./styles";

/**
 * Keeps exactly what was typed (text) — parse it with parseNumber. A text box
 * with a number keypad: no spinner and no browser `step` rules, so 12.25 kg
 * is never refused.
 */
export default function NumberInput({ value, onChange, prefix, suffix, whole = false, signed = false, className = "", ...rest }) {
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-2">{prefix}</span>}
      <input type="text" inputMode={signed ? "text" : whole ? "numeric" : "decimal"} autoComplete="off" value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT} font-num tabular-nums ${prefix ? "pl-8" : ""} ${suffix ? "pr-14" : ""} ${rest["aria-invalid"] ? INPUT_INVALID : ""} ${className}`} {...rest} />
      {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-2">{suffix}</span>}
    </div>
  );
}

NumberInput.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  prefix: PropTypes.node,
  suffix: PropTypes.node,
  whole: PropTypes.bool,
  signed: PropTypes.bool,
  className: PropTypes.string,
};
```

`frontend/src/ui/PhoneInput.jsx`:

```jsx
import PropTypes from "prop-types";
import { INPUT } from "./styles";
import { mobileStatus } from "../utils/phone";

export default function PhoneInput({ value, onChange, ...rest }) {
  const status = mobileStatus(value);
  return (
    <div>
      <div className="flex gap-2">
        <span className="grid h-12 place-items-center rounded-2xl bg-raised px-3.5 font-num text-ink-2" aria-hidden="true">+91</span>
        <input type="tel" inputMode="tel" autoComplete="tel-national" value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} font-num tabular-nums`} {...rest} />
      </div>
      {status === "valid" && <p className="mt-1.5 text-xs font-medium text-status-good">✓ Valid mobile — Call and WhatsApp will work</p>}
      {status === "invalid" && <p className="mt-1.5 text-xs text-status-warn">Not a 10-digit mobile — Call and WhatsApp won&apos;t work</p>}
    </div>
  );
}

PhoneInput.propTypes = { value: PropTypes.string.isRequired, onChange: PropTypes.func.isRequired };
```

`frontend/src/ui/DateField.jsx`:

```jsx
import PropTypes from "prop-types";
import { INPUT } from "./styles";
import { todayIST, addDays } from "../utils/istDate";

/** Native date picker (value "YYYY-MM-DD", India dates) with Today / Yesterday shortcuts. */
export default function DateField({ value, onChange, quick = true, ...rest }) {
  const today = todayIST();
  const chips = [["Today", today], ["Yesterday", addDays(today, -1)]];
  return (
    <div className="space-y-2">
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} font-num [color-scheme:light] dark:[color-scheme:dark]`} {...rest} />
      {quick && (
        <div className="flex gap-2">
          {chips.map(([label, d]) => (
            <button key={label} type="button" aria-pressed={value === d} onClick={() => onChange(d)}
              className={`h-8 rounded-full border px-3 text-xs font-semibold ${value === d ? "border-brass text-brass" : "border-line text-ink-2"}`}>{label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

DateField.propTypes = { value: PropTypes.string.isRequired, onChange: PropTypes.func.isRequired, quick: PropTypes.bool };
```

`frontend/src/ui/Switch.jsx`:

```jsx
import PropTypes from "prop-types";

export default function Switch({ checked, onChange, label, description }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-2">{description}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brass" : "bg-line"}`} aria-hidden="true">
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-canvas transition-all ${checked ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}

Switch.propTypes = { checked: PropTypes.bool.isRequired, onChange: PropTypes.func.isRequired, label: PropTypes.string.isRequired, description: PropTypes.node };
```

`frontend/src/ui/Tabs.jsx`:

```jsx
import PropTypes from "prop-types";

export default function Tabs({ label, tabs, value, onChange }) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-2xl bg-surface p-1">
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" id={`tab-${t.value}`} aria-selected={t.value === value} aria-controls={`panel-${t.value}`}
          onClick={() => onChange(t.value)}
          className={`h-9 flex-1 rounded-xl text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass ${
            t.value === value ? "bg-raised text-ink" : "text-ink-2 hover:text-ink"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

Tabs.propTypes = {
  label: PropTypes.string.isRequired,
  tabs: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string.isRequired, label: PropTypes.node.isRequired })).isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

export function TabPanel({ value, children }) {
  return <div role="tabpanel" id={`panel-${value}`} aria-labelledby={`tab-${value}`} className="mt-3">{children}</div>;
}

TabPanel.propTypes = { value: PropTypes.string.isRequired, children: PropTypes.node };
```

- [ ] **Step 2: Overlays — Sheet, ConfirmDialog, ActionSheet, SearchPicker**

`frontend/src/ui/Sheet.jsx`:

```jsx
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { AnimatePresence, motion } from "motion/react";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet on phones, dialog on wider screens. Portalled to <body> (the
 * page wrapper is transformed). Traps Tab, closes on Escape, locks page scroll,
 * and returns focus to what opened it.
 */
export default function Sheet({ open, title, onClose, footer, children }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const returnTo = document.activeElement;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.querySelector(FOCUSABLE)?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      returnTo?.focus?.();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
          <motion.button type="button" tabIndex={-1} aria-label="Close" className="absolute inset-0 bg-black/55" onClick={() => onCloseRef.current()}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div ref={panelRef} className="relative flex max-h-[88vh] w-full max-w-md flex-col rounded-t-3xl bg-surface text-ink shadow-2xl sm:rounded-3xl"
            initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 48, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}>
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
            <div className="flex items-center justify-between gap-4 px-5 pt-3">
              <h2 className="font-num text-lg font-semibold">{title}</h2>
              <button type="button" onClick={() => onCloseRef.current()} className="rounded-full px-3 py-1.5 text-sm text-ink-2 hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">Close</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">{children}</div>
            {footer && <div className="border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

Sheet.propTypes = { open: PropTypes.bool.isRequired, title: PropTypes.string.isRequired, onClose: PropTypes.func.isRequired, footer: PropTypes.node, children: PropTypes.node };
```

`frontend/src/ui/ConfirmDialog.jsx`:

```jsx
import PropTypes from "prop-types";
import Sheet from "./Sheet";
import Button from "./Button";

export default function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel = "Go back", tone = "danger", busy = false, onConfirm, onClose }) {
  const close = () => { if (!busy) onClose(); };
  return (
    <Sheet open={open} title={title} onClose={close}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" block onClick={close} disabled={busy}>{cancelLabel}</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} block loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      }>
      <p className="text-sm leading-relaxed text-ink-2">{message}</p>
    </Sheet>
  );
}

ConfirmDialog.propTypes = {
  open: PropTypes.bool.isRequired, title: PropTypes.string.isRequired, message: PropTypes.node.isRequired,
  confirmLabel: PropTypes.string.isRequired, cancelLabel: PropTypes.string, tone: PropTypes.oneOf(["danger", "primary"]),
  busy: PropTypes.bool, onConfirm: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired,
};
```

`frontend/src/ui/ActionSheet.jsx`:

```jsx
import PropTypes from "prop-types";
import Sheet from "./Sheet";

/** The ⋯ menu: a short list of actions. Destructive ones use tone "danger" and open their own confirm. */
export default function ActionSheet({ open, title, actions, onClose }) {
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <ul className="-mx-2 space-y-1">
        {actions.filter(Boolean).map((a) => (
          <li key={a.label}>
            <button type="button" onClick={() => { onClose(); a.onSelect(); }}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[0.95rem] font-medium hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass ${a.tone === "danger" ? "text-status-critical" : "text-ink"}`}>
              {a.icon}
              {a.label}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

ActionSheet.propTypes = {
  open: PropTypes.bool.isRequired, title: PropTypes.string.isRequired, onClose: PropTypes.func.isRequired,
  actions: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.bool, PropTypes.shape({ label: PropTypes.string.isRequired, onSelect: PropTypes.func.isRequired, tone: PropTypes.string, icon: PropTypes.node })])).isRequired,
};
```

`frontend/src/ui/SearchPicker.jsx`:

```jsx
import PropTypes from "prop-types";
import Sheet from "./Sheet";
import TextInput from "./TextInput";
import { ListSkeleton } from "./States";

/** A searchable list in a sheet — customer and size pickers. */
export default function SearchPicker({ open, title, query, onQuery, placeholder, loading, error, items, getKey, renderItem, onPick, onClose, empty, footer }) {
  return (
    <Sheet open={open} title={title} onClose={onClose} footer={footer}>
      <div className="sticky -top-3 z-10 -mx-5 bg-surface px-5 pb-3 pt-1">
        <TextInput autoFocus type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder} enterKeyHint="search" />
      </div>
      {error ? (
        <p role="alert" className="py-6 text-center text-sm text-status-critical">{error}</p>
      ) : loading ? (
        <ListSkeleton rows={5} />
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-2">{empty}</p>
      ) : (
        <ul className="-mx-2">
          {items.map((item) => (
            <li key={getKey(item)}>
              <button type="button" onClick={() => onPick(item)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">
                {renderItem(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

SearchPicker.propTypes = {
  open: PropTypes.bool.isRequired, title: PropTypes.string.isRequired, query: PropTypes.string.isRequired, onQuery: PropTypes.func.isRequired,
  placeholder: PropTypes.string.isRequired, loading: PropTypes.bool, error: PropTypes.string, items: PropTypes.array.isRequired,
  getKey: PropTypes.func.isRequired, renderItem: PropTypes.func.isRequired, onPick: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired,
  empty: PropTypes.node.isRequired, footer: PropTypes.node,
};
```

- [ ] **Step 3: Layout, money, states and hooks**

`frontend/src/ui/StickyFooter.jsx`:

```jsx
import PropTypes from "prop-types";

/** Sticks to the bottom of the scrolling page. In-flow (`sticky`), so it works inside the transformed page wrapper. */
export default function StickyFooter({ children }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6">
      {children}
    </div>
  );
}

StickyFooter.propTypes = { children: PropTypes.node };
```

`frontend/src/ui/Stepper.jsx`:

```jsx
import PropTypes from "prop-types";

/** Progress bar for multi-step forms. Reached steps are tappable (go back and fix). */
export default function Stepper({ steps, current, reached, onGo }) {
  return (
    <nav aria-label="Form steps">
      <ol className="flex gap-1.5">
        {steps.map((name, i) => (
          <li key={name} className="flex-1">
            <button type="button" disabled={i > reached} onClick={() => onGo(i)} aria-current={i === current ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${name}`} className="block w-full py-2.5 disabled:cursor-default">
              <span className={`block h-1.5 rounded-full transition-colors ${i <= current ? "bg-brass" : i <= reached ? "bg-brass/40" : "bg-line"}`} />
            </button>
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-2">Step {current + 1} of {steps.length} · {steps[current]}</p>
    </nav>
  );
}

Stepper.propTypes = { steps: PropTypes.arrayOf(PropTypes.string).isRequired, current: PropTypes.number.isRequired, reached: PropTypes.number.isRequired, onGo: PropTypes.func.isRequired };
```

`frontend/src/ui/PageHeader.jsx`:

```jsx
import PropTypes from "prop-types";

/** Desktop page title + actions. On phones the app header shows the title, so only the actions show here. */
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="hidden font-num text-2xl font-semibold text-ink sm:block">{title}</h1>
        {subtitle && <p className="text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

PageHeader.propTypes = { title: PropTypes.string.isRequired, subtitle: PropTypes.node, actions: PropTypes.node };
```

`frontend/src/ui/Money.jsx`:

```jsx
import PropTypes from "prop-types";
import { inr } from "../utils/dashboardFormat";

/** The only way a ₹ figure is printed: exact, Indian grouping, tabular digits. */
export function Money({ value, className = "" }) {
  return <span className={`font-num tabular-nums ${className}`}>{inr(value)}</span>;
}

Money.propTypes = { value: PropTypes.number.isRequired, className: PropTypes.string };

/** A row's due: red "Due ₹X", green "Paid ✓", or "Paid ✓ +₹X extra" when more was received than billed. */
export function DueText({ due, className = "" }) {
  const d = Number(due);
  if (d > 0) return <span className={`text-xs font-semibold text-status-critical ${className}`}>Due <Money value={d} /></span>;
  return (
    <span className={`text-xs font-semibold text-status-good ${className}`}>
      Paid ✓{d < 0 && <span className="font-normal text-ink-2"> +<Money value={-d} /> extra</span>}
    </span>
  );
}

DueText.propTypes = { due: PropTypes.number.isRequired, className: PropTypes.string };
```

`frontend/src/ui/StatusBadge.jsx`:

```jsx
import PropTypes from "prop-types";
import { ORDER_STATUS, INVOICE_STATUS, TONE_CLASS } from "../utils/statusMeta";

export default function StatusBadge({ kind = "order", status }) {
  const meta = (kind === "invoice" ? INVOICE_STATUS : ORDER_STATUS)[status] || { label: status, tone: "muted" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[meta.tone]}`}>{meta.label}</span>;
}

StatusBadge.propTypes = { kind: PropTypes.oneOf(["order", "invoice"]), status: PropTypes.string.isRequired };
```

`frontend/src/ui/States.jsx`:

```jsx
import PropTypes from "prop-types";
import Button from "./Button";

export function EmptyState({ title, body, action }) {
  return (
    <div className="rounded-3xl bg-surface px-5 py-8 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 text-sm text-ink-2">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

EmptyState.propTypes = { title: PropTypes.string.isRequired, body: PropTypes.node, action: PropTypes.node };

export function ErrorState({ title = "Couldn't load this.", onRetry }) {
  return (
    <div className="rounded-3xl bg-surface p-5 text-sm" role="alert">
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1 text-ink-2">Check your connection and try again.</p>
      <Button className="mt-3" onClick={onRetry}>Try again</Button>
    </div>
  );
}

ErrorState.propTypes = { title: PropTypes.string, onRetry: PropTypes.func.isRequired };

export function ListSkeleton({ rows = 6 }) {
  return (
    <div className="animate-pulse space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="h-14 rounded-2xl bg-surface" />)}
    </div>
  );
}

ListSkeleton.propTypes = { rows: PropTypes.number };

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 py-4 sm:px-6">
      <div className="h-32 animate-pulse rounded-3xl bg-surface" />
      <ListSkeleton rows={5} />
    </div>
  );
}
```

`frontend/src/ui/useDebounced.js`:

```js
import { useEffect, useState } from "react";

/** The value, once it has stopped changing for `ms` — for search boxes. */
export default function useDebounced(value, ms = 250) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
```

`frontend/src/ui/useInfiniteSentinel.js`:

```js
import { useEffect, useRef } from "react";

/** Put the returned ref on an element after the list; the next page loads as it nears the screen. */
export default function useInfiniteSentinel({ hasNextPage, isFetchingNextPage, fetchNextPage }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasNextPage) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  return ref;
}
```

- [ ] **Step 4: Lint and build**

Run: `cd frontend && npx eslint src/ui && npx vite build >/dev/null && echo BUILD_OK`
Expected: no lint output for `src/ui`, then `BUILD_OK` (`dist/` is git-ignored).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/ui
git commit -m "feat(ui): component kit on the Midnight Forest & Brass tokens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Foundation — TanStack Query, lazy routes, route meta, legacy CSS scoping

**Files:**
- Modify: `frontend/package.json` (+ `@tanstack/react-query`)
- Create: `frontend/src/lib/queryClient.js`, `frontend/src/lib/queryKeys.js`, `frontend/src/lib/queryKeys.test.js`
- Create: `frontend/src/app/routeMeta.js`, `frontend/src/app/routeMeta.test.js`, `frontend/src/app/Legacy.jsx`
- Modify: `frontend/src/App.jsx` (full rewrite below)
- Modify: `frontend/src/components/layout/MainLayout.jsx` (Suspense around the outlet)
- Modify: `frontend/vite.config.js`
- Modify: `frontend/src/styles/dark-theme.css`, `frontend/src/styles/select-override.css`, `frontend/src/styles/button-override.css`

**Interfaces (Produces):**
- `queryClient`; `keys` (`keys.orders.{all,list(p),detail(id),unbilled(customerId)}`, `keys.customers.{all,directory(p),summary(id),detail(id),similar(name, excludeId)}`, `keys.invoices.{all,list(p),detail(id)}`, `keys.catalog.{sizes,plates}`); `invalidateMoney(queryClient) → Promise` (refreshes orders, customers, invoices).
- `routeMeta(pathname) → { title, back: string|null, hideNav: boolean }`.
- `<Legacy>` wrapper: old pages render inside `.legacy`; legacy CSS only applies there.

- [ ] **Step 1: Install**

Run: `cd frontend && npm install @tanstack/react-query@^5`
Expected: added to `dependencies`.

- [ ] **Step 2: Failing tests**

`frontend/src/lib/queryKeys.test.js`:

```js
import { describe, expect, test, vi } from "vitest";
import { invalidateMoney, keys } from "./queryKeys";

describe("invalidateMoney", () => {
  test("after any money change, every list and page with money refreshes", async () => {
    const qc = { invalidateQueries: vi.fn().mockResolvedValue() };
    await invalidateMoney(qc);
    expect(qc.invalidateQueries.mock.calls.map((c) => c[0].queryKey)).toEqual([keys.orders.all, keys.customers.all, keys.invoices.all]);
  });
  test("list keys include their params", () => {
    expect(keys.orders.list({ chip: "due" })).toEqual(["orders", "list", { chip: "due" }]);
  });
});
```

`frontend/src/app/routeMeta.test.js`:

```js
import { describe, expect, test } from "vitest";
import { routeMeta } from "./routeMeta";

describe("routeMeta", () => {
  test.each([
    ["/", { title: "Dashboard", back: null, hideNav: false }],
    ["/orders", { title: "Orders", back: null, hideNav: false }],
    ["/orders/new", { title: "New order", back: null, hideNav: true }],
    ["/orders/edit/abc", { title: "Edit order", back: null, hideNav: true }],
    ["/orders/abc", { title: "Order", back: "/orders", hideNav: false }],
    ["/customers/new", { title: "New customer", back: null, hideNav: true }],
    ["/customers/edit/c1", { title: "Edit customer", back: null, hideNav: true }],
    ["/customers/c1", { title: "Customer", back: "/customers", hideNav: false }],
    ["/invoices/new", { title: "New invoice", back: null, hideNav: true }],
    ["/invoices/i1", { title: "Invoice", back: "/invoices", hideNav: false }],
    ["/dues", { title: "Dues", back: null, hideNav: false }],
    ["/stock-issues/new", { title: "New Stock Issue", back: null, hideNav: false }],
    ["/stock", { title: "Stock", back: null, hideNav: false }],
    ["/nowhere", { title: "YARS", back: null, hideNav: false }],
  ])("%s", (path, meta) => expect(routeMeta(path)).toEqual(meta));
});
```

Run: `cd frontend && npx vitest run src/lib src/app`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement query client, keys, route meta, Legacy**

`frontend/src/lib/queryClient.js`:

```js
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: 0 },
  },
});
```

`frontend/src/lib/queryKeys.js`:

```js
export const keys = {
  orders: {
    all: ["orders"],
    list: (params) => ["orders", "list", params],
    detail: (id) => ["orders", "detail", id],
    unbilled: (customerId) => ["orders", "unbilled", customerId],
  },
  customers: {
    all: ["customers"],
    directory: (params) => ["customers", "directory", params],
    summary: (id) => ["customers", "summary", id],
    detail: (id) => ["customers", "detail", id],
    similar: (name, excludeId) => ["customers", "similar", name, excludeId || null],
  },
  invoices: { all: ["invoices"], list: (params) => ["invoices", "list", params], detail: (id) => ["invoices", "detail", id] },
  catalog: { sizes: ["catalog", "sizes"], plates: ["catalog", "plates"] },
};

/** After any change to an order, payment, customer or invoice, every screen showing money refreshes. */
export const invalidateMoney = (queryClient) =>
  Promise.all([keys.orders.all, keys.customers.all, keys.invoices.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
```

`frontend/src/app/routeMeta.js`:

```js
/**
 * Header title, where Back goes, and whether the bottom bar hides. Forms have
 * no header Back: their own footer Back asks before discarding what was typed.
 * Most specific first.
 */
const ROUTES = [
  [/^\/$/, { title: "Dashboard" }],
  [/^\/orders\/new$/, { title: "New order", hideNav: true }],
  [/^\/orders\/edit\/[^/]+$/, { title: "Edit order", hideNav: true }],
  [/^\/orders\/[^/]+$/, { title: "Order", back: "/orders" }],
  [/^\/orders$/, { title: "Orders" }],
  [/^\/customers\/new$/, { title: "New customer", hideNav: true }],
  [/^\/customers\/edit\/[^/]+$/, { title: "Edit customer", hideNav: true }],
  [/^\/customers\/[^/]+$/, { title: "Customer", back: "/customers" }],
  [/^\/customers$/, { title: "Customers" }],
  [/^\/invoices\/new$/, { title: "New invoice", hideNav: true }],
  [/^\/invoices\/[^/]+$/, { title: "Invoice", back: "/invoices" }],
  [/^\/invoices$/, { title: "Invoices" }],
  [/^\/dues/, { title: "Dues" }],
  [/^\/assistant/, { title: "Jarvis" }],
  // Not redesigned yet — titles as before.
  [/^\/plate-types\/new/, { title: "New Plate Type" }],
  [/^\/plate-types\/edit/, { title: "Edit Plate Type" }],
  [/^\/plate-types/, { title: "Plate Types" }],
  [/^\/product-sizes\/new/, { title: "New Product Size" }],
  [/^\/product-sizes\/edit/, { title: "Edit Product Size" }],
  [/^\/product-sizes/, { title: "Product Sizes" }],
  [/^\/expense-categories/, { title: "Expense Categories" }],
  [/^\/expenses\/new/, { title: "New Expense" }],
  [/^\/expenses\/edit/, { title: "Edit Expense" }],
  [/^\/expenses/, { title: "Expenses" }],
  [/^\/history/, { title: "History" }],
  [/^\/stock-issues\/new/, { title: "New Stock Issue" }],
  [/^\/stock-issues/, { title: "Stock Issues" }],
  [/^\/stock/, { title: "Stock" }],
  [/^\/inventory-items\/new/, { title: "New Inventory Item" }],
  [/^\/inventory-items\/edit/, { title: "Edit Inventory Item" }],
  [/^\/inventory-items/, { title: "Inventory Items" }],
  [/^\/purchase-orders\/new/, { title: "New Purchase Order" }],
  [/^\/purchase-orders/, { title: "Purchase Orders" }],
  [/^\/suppliers\/new/, { title: "New Supplier" }],
  [/^\/suppliers\/edit/, { title: "Edit Supplier" }],
  [/^\/suppliers/, { title: "Suppliers" }],
  [/^\/inventory-categories/, { title: "Inventory Categories" }],
  [/^\/item-attributes/, { title: "Item Attributes" }],
];

export const routeMeta = (pathname) => {
  for (const [re, meta] of ROUTES) {
    const m = pathname.match(re);
    if (m) return { title: meta.title, back: typeof meta.back === "function" ? meta.back(m) : meta.back || null, hideNav: Boolean(meta.hideNav) };
  }
  return { title: "YARS", back: null, hideNav: false };
};
```

`frontend/src/app/Legacy.jsx`:

```jsx
import PropTypes from "prop-types";

/** Pages not redesigned yet: the old stylesheet rules only apply inside `.legacy`, so they can't leak onto new screens. */
export default function Legacy({ children }) {
  return <div className="legacy">{children}</div>;
}

Legacy.propTypes = { children: PropTypes.node };
```

Run: `cd frontend && npx vitest run src/lib src/app` → Expected: PASS.

- [ ] **Step 4: Scope the legacy stylesheets under `.legacy`**

Run from `frontend/src/styles`:

```bash
perl -pi -e 's/^\.dark (?!body\b|::-webkit-scrollbar)/.dark .legacy /' dark-theme.css
perl -pi -e 's/^(\s*)select/$1.legacy select/; s/^\.dark select/.dark .legacy select/' select-override.css
perl -pi -e 's/^\.dark \[/.dark .legacy [/' button-override.css
grep -c "^\.dark \.legacy " dark-theme.css; grep -c "\.legacy select" select-override.css; grep -c "\.legacy" button-override.css
```

Expected: `60`, `6`, `2`. (`.dark {`, `.dark body` and the scrollbar rules stay global.)

- [ ] **Step 5: Lazy routes — rewrite `frontend/src/App.jsx`**

```jsx
import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { queryClient } from "./lib/queryClient";
import MainLayout from "./components/layout/MainLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import Legacy from "./app/Legacy";
import { PageSkeleton } from "./ui/States";
import "./assets/styles/index.css";
import "./styles/button-override.css";
import "./styles/datepicker-override.css";
import "./styles/datepicker-dark.css";
import "./styles/select-override.css";
import "./styles/history-animations.css";
import "./styles/page-animations.css";
import "./styles/dark-theme.css";

// Each page is its own chunk: opening the app only downloads what it shows.
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Dues = lazy(() => import("./pages/Dues"));
const Assistant = lazy(() => import("./pages/Assistant"));
const Orders = lazy(() => import("./pages/Orders"));
const CreateOrder = lazy(() => import("./pages/CreateOrder"));
const EditOrder = lazy(() => import("./pages/EditOrder"));
const OrderDetails = lazy(() => import("./pages/OrderDetails"));
const Customers = lazy(() => import("./pages/Customers"));
const CreateCustomer = lazy(() => import("./pages/CreateCustomer"));
const CustomerDetails = lazy(() => import("./pages/CustomerDetails"));
const EditCustomer = lazy(() => import("./pages/EditCustomer"));
const PlateTypes = lazy(() => import("./pages/PlateTypes"));
const CreatePlateType = lazy(() => import("./pages/CreatePlateType"));
const EditPlateType = lazy(() => import("./pages/EditPlateType"));
const ProductSizes = lazy(() => import("./pages/ProductSizes"));
const CreateProductSize = lazy(() => import("./pages/CreateProductSize"));
const EditProductSize = lazy(() => import("./pages/EditProductSize"));
const Expenses = lazy(() => import("./pages/Expenses"));
const CreateExpense = lazy(() => import("./pages/CreateExpense"));
const EditExpense = lazy(() => import("./pages/EditExpense"));
const ExpenseCategories = lazy(() => import("./pages/ExpenseCategories"));
const CreateExpenseCategory = lazy(() => import("./pages/CreateExpenseCategory"));
const EditExpenseCategory = lazy(() => import("./pages/EditExpenseCategory"));
const Invoices = lazy(() => import("./pages/Invoices"));
const GenerateInvoice = lazy(() => import("./pages/GenerateInvoice"));
const InvoiceDetails = lazy(() => import("./pages/InvoiceDetails"));
const History = lazy(() => import("./pages/History"));
const Stock = lazy(() => import("./pages/Stock"));
const StockItemDetail = lazy(() => import("./pages/StockItemDetail"));
const InventoryItems = lazy(() => import("./pages/InventoryItems"));
const CreateInventoryItem = lazy(() => import("./pages/CreateInventoryItem"));
const EditInventoryItem = lazy(() => import("./pages/EditInventoryItem"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const CreatePurchaseOrder = lazy(() => import("./pages/CreatePurchaseOrder"));
const PurchaseOrderDetail = lazy(() => import("./pages/PurchaseOrderDetail"));
const ReceivePurchaseOrder = lazy(() => import("./pages/ReceivePurchaseOrder"));
const StockIssues = lazy(() => import("./pages/StockIssues"));
const CreateStockIssue = lazy(() => import("./pages/CreateStockIssue"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const CreateSupplier = lazy(() => import("./pages/CreateSupplier"));
const EditSupplier = lazy(() => import("./pages/EditSupplier"));
const SupplierDetail = lazy(() => import("./pages/SupplierDetail"));
const InventoryCategories = lazy(() => import("./pages/InventoryCategories"));
const ItemAttributes = lazy(() => import("./pages/ItemAttributes"));
const NotFound = lazy(() => import("./pages/NotFound"));

/** A page that hasn't been redesigned yet keeps its old look. */
const old = (Page) => <Legacy><Page /></Legacy>;

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <ToastProvider>
            <AuthProvider>
              <Router>
                <Suspense fallback={<PageSkeleton />}>
                  <Routes>
                    <Route path="/login" element={old(Login)} />

                    <Route element={<ProtectedRoute />}>
                      <Route path="/" element={<MainLayout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="assistant" element={old(Assistant)} />
                        <Route path="dues" element={<Dues />} />

                        <Route path="orders">
                          <Route index element={old(Orders)} />
                          <Route path="new" element={old(CreateOrder)} />
                          <Route path="edit/:id" element={old(EditOrder)} />
                          <Route path=":id" element={old(OrderDetails)} />
                        </Route>

                        <Route path="customers">
                          <Route index element={old(Customers)} />
                          <Route path="new" element={old(CreateCustomer)} />
                          <Route path="edit/:id" element={old(EditCustomer)} />
                          <Route path=":id" element={old(CustomerDetails)} />
                        </Route>

                        <Route path="plate-types">
                          <Route index element={old(PlateTypes)} />
                          <Route path="new" element={old(CreatePlateType)} />
                          <Route path="edit/:id" element={old(EditPlateType)} />
                        </Route>

                        <Route path="product-sizes">
                          <Route index element={old(ProductSizes)} />
                          <Route path="new" element={old(CreateProductSize)} />
                          <Route path="edit/:id" element={old(EditProductSize)} />
                        </Route>

                        <Route path="expenses">
                          <Route index element={old(Expenses)} />
                          <Route path="new" element={old(CreateExpense)} />
                          <Route path="edit/:id" element={old(EditExpense)} />
                        </Route>

                        <Route path="expense-categories">
                          <Route index element={old(ExpenseCategories)} />
                          <Route path="new" element={old(CreateExpenseCategory)} />
                          <Route path="edit/:id" element={old(EditExpenseCategory)} />
                        </Route>

                        <Route path="invoices">
                          <Route index element={old(Invoices)} />
                          <Route path="generate" element={old(GenerateInvoice)} />
                          <Route path=":id" element={old(InvoiceDetails)} />
                        </Route>

                        <Route path="history" element={old(History)} />

                        <Route path="stock">
                          <Route index element={old(Stock)} />
                          <Route path=":itemId" element={old(StockItemDetail)} />
                        </Route>

                        <Route path="inventory-items">
                          <Route index element={old(InventoryItems)} />
                          <Route path="new" element={old(CreateInventoryItem)} />
                          <Route path="edit/:id" element={old(EditInventoryItem)} />
                        </Route>

                        <Route path="purchase-orders">
                          <Route index element={old(PurchaseOrders)} />
                          <Route path="new" element={old(CreatePurchaseOrder)} />
                          <Route path=":id" element={old(PurchaseOrderDetail)} />
                          <Route path=":id/receive" element={old(ReceivePurchaseOrder)} />
                        </Route>

                        <Route path="stock-issues">
                          <Route index element={old(StockIssues)} />
                          <Route path="new" element={old(CreateStockIssue)} />
                        </Route>

                        <Route path="suppliers">
                          <Route index element={old(Suppliers)} />
                          <Route path="new" element={old(CreateSupplier)} />
                          <Route path="edit/:id" element={old(EditSupplier)} />
                          <Route path=":id" element={old(SupplierDetail)} />
                        </Route>

                        <Route path="inventory-categories" element={old(InventoryCategories)} />
                        <Route path="item-attributes" element={old(ItemAttributes)} />

                        <Route path="*" element={old(NotFound)} />
                      </Route>
                    </Route>
                  </Routes>
                </Suspense>
              </Router>
            </AuthProvider>
          </ToastProvider>
        </MotionConfig>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
```

In `frontend/src/components/layout/MainLayout.jsx`, import `{ useState, Suspense }` from "react" and `{ PageSkeleton }` from `"../../ui/States"`, and wrap the outlet so the header and nav stay while a page chunk loads:

```jsx
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
```

- [ ] **Step 6: Vendor chunk split**

`frontend/vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 8080,
  },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: app deploys don't re-download React.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query', 'axios'],
        },
      },
    },
  },
})
```

- [ ] **Step 7: Build, measure, look**

Run: `cd frontend && npx vite build 2>&1 | grep -E "index-|react-|query-|kB" | sort -t'│' -k2 | tail -15`
Expected: no "chunks are larger than 500 kB" warning; the entry `index-*.js` is far below the 1,271 kB baseline. Record the entry, `react` and `query` chunk sizes in the ledger.

Run: `cd frontend && npx vitest run 2>&1 | tail -3 && npx eslint src/App.jsx src/app src/lib`
Expected: tests pass; no lint errors.

Visual check (dev server on 5173 against the UX copy, see Task 21 for how it runs): open `/`, `/stock` and `/orders` at 390px in dark and light. The dashboard looks unchanged; legacy pages keep their old styling (inputs, tables, cards).

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/queryClient.js frontend/src/lib/queryKeys.js frontend/src/lib/queryKeys.test.js frontend/src/app/routeMeta.js frontend/src/app/routeMeta.test.js frontend/src/app/Legacy.jsx frontend/src/App.jsx frontend/src/components/layout/MainLayout.jsx frontend/vite.config.js frontend/src/styles/dark-theme.css frontend/src/styles/select-override.css frontend/src/styles/button-override.css
git commit -m "perf(app): lazy routes, vendor chunks, TanStack Query; legacy CSS scoped to old pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Navigation — bottom bar, grouped sidebar, header with Back

**Files:**
- Create: `frontend/src/app/navItems.js`, `frontend/src/app/navItems.test.js`
- Modify (full rewrite): `frontend/src/components/layout/BottomNav.jsx`, `Sidebar.jsx`, `Header.jsx`, `MainLayout.jsx`
- Modify: `backend/knowledge/routes.md`

**Interfaces:**
- Consumes: `routeMeta` (Task 11), kit (`IconButton`, `ConfirmDialog`, `Sheet`, `PageSkeleton`).
- Produces: `NAV_GROUPS` (`[{ title, items: [{ to, label, icon }] }]`), `TABS` (`[{ to, label, icon }]`), `MORE_ITEMS`, `isPathActive(pathname, to)`.

- [ ] **Step 1: Failing test**

`frontend/src/app/navItems.test.js`:

```js
import { describe, expect, test } from "vitest";
import { isPathActive, TABS, MORE_ITEMS, NAV_GROUPS } from "./navItems";

describe("navigation", () => {
  test("a section stays highlighted on its sub-pages, but /stock-issues is not /stock", () => {
    expect(isPathActive("/orders/abc", "/orders")).toBe(true);
    expect(isPathActive("/stock-issues", "/stock")).toBe(false);
    expect(isPathActive("/orders", "/")).toBe(false);
    expect(isPathActive("/", "/")).toBe(true);
  });
  test("phone tabs: Home, Orders, Customers, Expenses (+ More)", () => {
    expect(TABS.map((t) => t.label)).toEqual(["Home", "Orders", "Customers", "Expenses"]);
    expect(MORE_ITEMS.map((t) => t.to)).toEqual(expect.arrayContaining(["/dues", "/invoices", "/stock"]));
  });
  test("every screen is reachable from the sidebar", () => {
    expect(NAV_GROUPS.map((g) => g.title)).toEqual(["Sales", "Money", "Stock", "Setup"]);
  });
});
```

Run: `cd frontend && npx vitest run src/app/navItems.test.js` → Expected: FAIL (module missing).

- [ ] **Step 2: `navItems.js`**

```js
import {
  LayoutDashboard, ClipboardList, Users, FileText, HandCoins, Wallet, History, Warehouse, PackageMinus,
  ShoppingCart, Tags, Truck, Ruler, Layers, Sparkles, House,
} from "lucide-react";

export const NAV_GROUPS = [
  { title: "Sales", items: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/orders", label: "Orders", icon: ClipboardList },
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/invoices", label: "Invoices", icon: FileText },
  ] },
  { title: "Money", items: [
    { to: "/dues", label: "Dues", icon: HandCoins },
    { to: "/expenses", label: "Expenses", icon: Wallet },
    { to: "/history", label: "History", icon: History },
  ] },
  { title: "Stock", items: [
    { to: "/stock", label: "Stock", icon: Warehouse },
    { to: "/stock-issues", label: "Stock issues", icon: PackageMinus },
    { to: "/purchase-orders", label: "Purchase orders", icon: ShoppingCart },
    { to: "/inventory-items", label: "Items", icon: Tags },
    { to: "/suppliers", label: "Suppliers", icon: Truck },
  ] },
  { title: "Setup", items: [
    { to: "/product-sizes", label: "Sizes", icon: Ruler },
    { to: "/plate-types", label: "Plate types", icon: Layers },
    { to: "/assistant", label: "Jarvis", icon: Sparkles },
  ] },
];

/** The four daily places on the phone tab bar; everything else is under More. */
export const TABS = [
  { to: "/", label: "Home", icon: House },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/expenses", label: "Expenses", icon: Wallet },
];

const tabPaths = new Set(TABS.map((t) => t.to));
export const MORE_ITEMS = NAV_GROUPS.flatMap((g) => g.items).filter((i) => !tabPaths.has(i.to) && i.to !== "/");

export const isPathActive = (pathname, to) => (to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`));
```

Run: `cd frontend && npx vitest run src/app/navItems.test.js` → Expected: PASS.

- [ ] **Step 3: Rewrite the layout components**

`frontend/src/components/layout/BottomNav.jsx`:

```jsx
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Ellipsis } from "lucide-react";
import Sheet from "../../ui/Sheet";
import { TABS, MORE_ITEMS, isPathActive } from "../../app/navItems";

/** Phone tab bar: four daily places + More (a sheet with every other screen). Hidden on lg+. */
const BottomNav = () => {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [pathname]);
  const moreActive = MORE_ITEMS.some((i) => isPathActive(pathname, i.to));

  const tabClass = (active) => `flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-brass/15 text-brass" : "text-ink-2"}`;

  return (
    <>
      <Sheet open={moreOpen} title="More" onClose={() => setMoreOpen(false)}>
        <div className="grid grid-cols-3 gap-2">
          {MORE_ITEMS.map((item) => {
            const active = isPathActive(pathname, item.to);
            return (
              <NavLink key={item.to} to={item.to} className={`flex flex-col items-center gap-2 rounded-2xl px-2 py-4 text-center ${active ? "bg-brass/15 text-brass" : "text-ink hover:bg-raised"}`}>
                <item.icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-xs font-medium leading-tight">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </Sheet>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="grid h-16 grid-cols-5">
          {TABS.map((tab) => {
            const active = isPathActive(pathname, tab.to);
            return (
              <NavLink key={tab.to} to={tab.to} aria-current={active ? "page" : undefined} className="flex flex-col items-center justify-center gap-1">
                <span className={tabClass(active)}><tab.icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                <span className={`text-[10px] font-semibold ${active ? "text-brass" : "text-ink-2"}`}>{tab.label}</span>
              </NavLink>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} aria-expanded={moreOpen} className="flex flex-col items-center justify-center gap-1">
            <span className={tabClass(moreActive || moreOpen)}><Ellipsis className="h-[18px] w-[18px]" aria-hidden="true" /></span>
            <span className={`text-[10px] font-semibold ${moreActive || moreOpen ? "text-brass" : "text-ink-2"}`}>More</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
```

`frontend/src/components/layout/Sidebar.jsx`:

```jsx
import { NavLink } from "react-router-dom";
import PropTypes from "prop-types";
import { NAV_GROUPS } from "../../app/navItems";

/** Desktop navigation, grouped by what the work is about. */
const Sidebar = ({ isCollapsed = false }) => {
  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive ? "bg-brass/15 text-brass" : "text-ink-2 hover:bg-raised hover:text-ink"}`;
  return (
    <aside className={`${isCollapsed ? "w-20" : "w-64"} flex h-full flex-col border-r border-line bg-surface transition-[width] duration-300`}>
      <div className={`flex items-center gap-3 border-b border-line ${isCollapsed ? "justify-center px-3 py-5" : "px-5 py-5"}`}>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brass font-num text-lg font-bold text-brass-on">Y</span>
        {!isCollapsed && <div><p className="font-num text-lg font-semibold text-ink">YARS</p><p className="text-xs text-ink-2">Non-woven bags</p></div>}
      </div>
      <nav aria-label="Main" className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            {!isCollapsed && <p className="px-3 pb-1 text-xs font-semibold text-ink-2">{group.title}</p>}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.to === "/"} className={linkClass} title={isCollapsed ? item.label : undefined}>
                    <item.icon className={`h-[18px] w-[18px] shrink-0 ${isCollapsed ? "mx-auto" : ""}`} aria-hidden="true" />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
};

Sidebar.propTypes = { isCollapsed: PropTypes.bool };

export default Sidebar;
```

`frontend/src/components/layout/Header.jsx`:

```jsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { ChevronLeft, PanelLeft, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ThemeToggle } from "../theme/ThemeToggle";
import IconButton from "../../ui/IconButton";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { routeMeta } from "../../app/routeMeta";

const Header = ({ onSidebarToggle }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { title, back } = routeMeta(location.pathname);

  // Back returns to wherever you came from inside the app; opened from a link, it goes to the parent screen.
  const goBack = () => (location.key !== "default" ? navigate(-1) : navigate(back));

  return (
    <header className="sticky top-0 z-10 border-b border-line/70 bg-canvas/85 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:h-16 sm:px-6">
        <div className="flex min-w-0 items-center gap-1.5">
          <IconButton label="Collapse or expand the menu" onClick={onSidebarToggle} className="hidden bg-transparent lg:grid"><PanelLeft className="h-4 w-4" /></IconButton>
          {back && <IconButton label="Back" onClick={goBack} className="bg-transparent lg:hidden"><ChevronLeft className="h-5 w-5" /></IconButton>}
          <h1 className="truncate font-num text-lg font-semibold text-ink sm:hidden">{title}</h1>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="hidden max-w-[8rem] truncate rounded-xl bg-surface px-3 py-1.5 text-sm text-ink-2 sm:inline">{user.username}</span>
            <IconButton label="Log out" onClick={() => setConfirmLogout(true)} className="bg-transparent"><LogOut className="h-4 w-4" /></IconButton>
          </div>
        )}
      </div>
      <ConfirmDialog open={confirmLogout} title="Log out?" message="You will need to sign in again to use the app." confirmLabel="Log out" cancelLabel="Stay" tone="primary"
        onConfirm={logout} onClose={() => setConfirmLogout(false)} />
    </header>
  );
};

Header.propTypes = { onSidebarToggle: PropTypes.func };

export default Header;
```

`frontend/src/components/layout/MainLayout.jsx`:

```jsx
import { Suspense, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import BottomNav from "./BottomNav";
import { PageSkeleton } from "../../ui/States";
import { routeMeta } from "../../app/routeMeta";

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Forms have their own sticky save bar: no tab bar or floating button over it.
  const { hideNav } = routeMeta(pathname);

  return (
    <div className="main-layout flex h-screen overflow-hidden bg-canvas text-ink">
      <div className="hidden flex-shrink-0 lg:block">
        <Sidebar isCollapsed={collapsed} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onSidebarToggle={() => setCollapsed((v) => !v)} />
        <main className="flex-1 overflow-y-auto">
          <div className={`page-enter ${hideNav ? "" : "pb-24"} lg:pb-0`}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {!hideNav && !pathname.startsWith("/assistant") && (
        <button type="button" aria-label="Ask Jarvis" onClick={() => navigate("/assistant")}
          className="fixed bottom-24 right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-brass text-brass-on shadow-lg shadow-black/30 transition active:scale-95 lg:bottom-6">
          <span aria-hidden="true" className="jarvis-ring absolute inset-0 rounded-full bg-brass/50" />
          <Sparkles className="jarvis-wiggle relative h-5 w-5" aria-hidden="true" />
        </button>
      )}

      {!hideNav && <BottomNav />}
    </div>
  );
};

export default MainLayout;
```

- [ ] **Step 4: Routes knowledge**

In `backend/knowledge/routes.md`, update these rows (others unchanged):

```md
| `/orders` | Orders | Orders by day with Due/Paid on each row; search customer or size; chips All · Due · In progress · This month; Excel download under ⋯ |
| `/orders/new` | New order | Three steps: customer & date → items → plate, extras & review |
| `/orders/edit/:id` | Edit order | Same three steps, pre-filled |
| `/orders/:id` | Order | Money card (total, received, due, ＋ Record payment); tabs Items · Payments · Details; Edit/Invoice/Advance/Refund/Delete under ⋯ |
| `/customers` | Customers | A–Z directory with dues; chip "Owe money"; search by name or phone |
| `/customers/new` | New customer | Name (with similar-name check), mobile, city; more details: email, address, GSTIN |
| `/customers/edit/:id` | Edit customer | Same form, pre-filled |
| `/customers/:id` | Customer | What they owe, total business, New order / Call / WhatsApp; tabs Orders · Payments · Details |
| `/invoices` | Invoices | Rows with Due or Paid ✓; chips All · Unpaid · Overdue |
| `/invoices/new` | New invoice | Three steps: customer → orders (+GST) → review |
| `/invoices/:id` | Invoice | Money card (total incl. tax, received, due), Share PDF, ＋ Payment, WhatsApp reminder; tabs Items · Payments · Details |
```

Delete the `/invoices/generate` row and add under the table: `` `/invoices/generate` redirects to `/invoices/new`. ``

- [ ] **Step 5: Verify and commit**

Run: `cd frontend && npx vitest run 2>&1 | tail -3 && npx eslint src/components/layout src/app`
Expected: pass; no lint errors.

Visual check at 390px and desktop, dark and light: tab bar shows Home · Orders · Customers · Expenses · More; More opens a sheet listing Dues, Invoices, Stock…; the header shows the page title; on `/orders/<id>` a Back arrow appears; the sidebar shows the four groups; logout asks first.

```bash
git add frontend/src/app/navItems.js frontend/src/app/navItems.test.js frontend/src/components/layout/BottomNav.jsx frontend/src/components/layout/Sidebar.jsx frontend/src/components/layout/Header.jsx frontend/src/components/layout/MainLayout.jsx backend/knowledge/routes.md
git commit -m "feat(nav): Home/Orders/Customers/Expenses tabs + More, grouped sidebar, header Back

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13: Orders screen — compact rows grouped by day

**Files:**
- Modify: `frontend/src/services/api.js` (`orderAPI.list`)
- Create: `frontend/src/features/orders/api.js`, `OrdersPage.jsx`, `OrderRow.jsx`
- Modify: `frontend/src/App.jsx` (orders index route)

**Interfaces:**
- Consumes: `GET /api/orders/list` (Task 5), kit (Task 10), `groupByDay`, `itemsText`, `ORDER_STATUS`, `todayIST` (Task 9), `keys` (Task 11).
- Produces: `useOrderList(params)`; `<OrderRow row showCustomer?>` (memoised; used again on the customer page).

- [ ] **Step 1: API client + query hook**

In `frontend/src/services/api.js`, add to `orderAPI`: `list: (params) => api.get("/orders/list", { params }),`

Create `frontend/src/features/orders/api.js`:

```js
import { useInfiniteQuery } from "@tanstack/react-query";
import { orderAPI } from "../../services/api";
import { keys } from "../../lib/queryKeys";

export const body = (res) => res.data.data;

/** Orders screen, 30 per page. While a new filter loads, the previous list stays (dimmed). */
export const useOrderList = (params) =>
  useInfiniteQuery({
    queryKey: keys.orders.list(params),
    queryFn: ({ pageParam }) => orderAPI.list({ ...params, page: pageParam, limit: 30 }).then(body),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: (previous) => previous,
  });
```

- [ ] **Step 2: Row and page**

`frontend/src/features/orders/OrderRow.jsx`:

```jsx
import { memo } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { DueText } from "../../ui/Money";
import { inr, shortDate } from "../../utils/dashboardFormat";
import { itemsText } from "../../utils/itemsText";
import { ORDER_STATUS } from "../../utils/statusMeta";

function OrderRow({ row, showCustomer = true }) {
  const title = showCustomer ? row.customer.name : shortDate(row.orderDate);
  return (
    <li className="border-b border-line/60 last:border-0">
      <Link to={`/orders/${row.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{title}</p>
          <p className="truncate text-xs text-ink-2">{itemsText(row.items)} · {ORDER_STATUS[row.status]?.label || row.status}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-num text-sm font-bold tabular-nums ${row.cancelled ? "text-ink-2 line-through" : "text-ink"}`}>{inr(row.total)}</p>
          {row.cancelled ? <span className="text-xs text-ink-2">Not counted</span> : <DueText due={row.due} />}
        </div>
      </Link>
    </li>
  );
}

OrderRow.propTypes = {
  row: PropTypes.shape({
    id: PropTypes.string.isRequired, orderDate: PropTypes.string.isRequired, status: PropTypes.string.isRequired, cancelled: PropTypes.bool.isRequired,
    customer: PropTypes.shape({ name: PropTypes.string.isRequired }).isRequired, items: PropTypes.array.isRequired,
    total: PropTypes.number.isRequired, due: PropTypes.number.isRequired,
  }).isRequired,
  showCustomer: PropTypes.bool,
};

export default memo(OrderRow);
```

`frontend/src/features/orders/OrdersPage.jsx`:

```jsx
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Ellipsis } from "lucide-react";
import { useOrderList } from "./api";
import OrderRow from "./OrderRow";
import Chips from "../../ui/Chips";
import TextInput from "../../ui/TextInput";
import PageHeader from "../../ui/PageHeader";
import IconButton from "../../ui/IconButton";
import ActionSheet from "../../ui/ActionSheet";
import Button from "../../ui/Button";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { groupByDay } from "../../utils/dayGroups";
import { todayIST } from "../../utils/istDate";
import { inr } from "../../utils/dashboardFormat";
import { exportAPI } from "../../services/api";
import { useToast } from "../../context/ToastContext";

const CHIPS = [
  { value: "all", label: "All" },
  { value: "due", label: "Due" },
  { value: "in_progress", label: "In progress" },
  { value: "this_month", label: "This month" },
];

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const chip = params.get("chip") || "all";
  const search = params.get("q") || "";
  const term = useDebounced(search.trim());
  const [menuOpen, setMenuOpen] = useState(false);
  const toast = useToast();

  const list = useOrderList({ chip, search: term || undefined });
  const sentinel = useInfiniteSentinel(list);
  const pages = list.data?.pages;
  const rows = useMemo(() => (pages || []).flatMap((p) => p.rows), [pages]);
  const groups = useMemo(() => groupByDay(rows, todayIST()), [rows]);
  const summary = pages?.[0]?.summary;
  const filtered = chip !== "all" || term !== "";

  // Filters live in the URL, so Back from an order returns to the same list.
  const setParam = (key, value) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });

  const downloadExcel = async () => {
    const today = todayIST();
    try {
      await exportAPI.downloadDashboardData({ search: term || undefined, ...(chip === "this_month" ? { from_date: `${today.slice(0, 7)}-01`, to_date: today } : {}) });
    } catch {
      toast.error("Couldn't download the Excel file. Try again.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Orders" actions={<>
        <IconButton label="More order actions" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>
        <Link to="/orders/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>
      </>} />

      <div className="mt-3 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setParam("q", e.target.value)} placeholder="Search customer or size" aria-label="Search orders" enterKeyHint="search" />
        <Chips label="Filter orders" options={CHIPS} value={chip} onChange={(v) => setParam("chip", v)} />
        {summary && (
          <p className="text-sm text-ink-2" aria-live="polite">
            {plural(summary.count, "order")} · <span className="font-num tabular-nums">{inr(summary.total)}</span>
            {summary.due > 0 && <> · <span className="font-semibold text-status-critical">Due <span className="font-num tabular-nums">{inr(summary.due)}</span></span></>}
            {summary.cancelled > 0 && <> · {summary.cancelled} cancelled not counted</>}
          </p>
        )}
      </div>

      <div className={`mt-3 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? (
          <ListSkeleton />
        ) : list.isError && rows.length === 0 ? (
          <ErrorState title="Couldn't load orders." onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          filtered ? (
            <EmptyState title="No orders match" body="Try another name, size or filter."
              action={<Button variant="secondary" onClick={() => setParams({}, { replace: true })}>Clear search and filters</Button>} />
          ) : (
            <EmptyState title="No orders yet" body="Orders you take show up here, newest first."
              action={<Link to="/orders/new" className={buttonClass()}>New order</Link>} />
          )
        ) : (
          groups.map((g) => (
            <section key={g.date} aria-labelledby={`day-${g.date}`} className="mb-3">
              <h2 id={`day-${g.date}`} className="sticky top-0 z-[1] bg-canvas/95 px-1 py-2 text-xs font-semibold text-ink-2 backdrop-blur">{g.label}</h2>
              <ul className="overflow-hidden rounded-2xl bg-surface">{g.rows.map((r) => <OrderRow key={r.id} row={r} />)}</ul>
            </section>
          ))
        )}
        <div ref={sentinel} aria-hidden="true" />
        {list.isFetchingNextPage && <ListSkeleton rows={2} />}
      </div>

      <ActionSheet open={menuOpen} title="Orders" onClose={() => setMenuOpen(false)}
        actions={[{ label: chip === "this_month" ? "Download this month as Excel" : "Download Excel", onSelect: downloadExcel }]} />
    </div>
  );
}
```

- [ ] **Step 3: Route**

In `frontend/src/App.jsx`: replace `const Orders = lazy(() => import("./pages/Orders"));` with `const OrdersPage = lazy(() => import("./features/orders/OrdersPage"));` and the orders index route with `<Route index element={<OrdersPage />} />`.

- [ ] **Step 4: Verify**

Run: `cd frontend && npx eslint src/features/orders src/services/api.js src/App.jsx && npx vitest run 2>&1 | tail -3`
Expected: no lint errors; tests pass.

Visual check on the UX copy (390px, dark then light): `/orders` shows day groups with sticky day labels; ~8 rows per screen; summary "N orders · ₹… · Due ₹…" and the Due figure equals the dashboard's "To collect"; chip Due shows only owing orders; searching a size (e.g. "14") filters; scrolling to the end loads more (246 orders → 9 pages) with no duplicate rows; cancelled rows show struck-through total + "Not counted"; Back from an order keeps the chip and search.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/api.js frontend/src/features/orders/api.js frontend/src/features/orders/OrdersPage.jsx frontend/src/features/orders/OrderRow.jsx frontend/src/App.jsx
git commit -m "feat(orders): orders screen — rows grouped by day, due on every row, paged

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Order page and the payment sheet

**Files:**
- Modify: `backend/src/controllers/orderController.js` (`withComputedFields` adds `money` from orderFacts)
- Modify: `backend/tests/orderList.test.js`
- Create: `frontend/src/features/payments/paymentForm.js`, `paymentForm.test.js`, `api.js`, `PaymentSheet.jsx`, `PaymentList.jsx`
- Modify: `frontend/src/features/orders/api.js` (+ `useOrder`, `useOrderStatus`, `useDeleteOrder`)
- Create: `frontend/src/features/orders/OrderPage.jsx`
- Modify: `frontend/src/App.jsx`, `backend/knowledge/payments.md`

**Interfaces:**
- Produces (backend): `GET /api/orders/:id` now also returns `money: { total, received, due }` — the same numbers as the list row.
- Produces (frontend): `validatePayment({ mode, form, due, received }) → { errors, overpay, payload|null }`; `initialPaymentForm(paymentRow|null)`; `toPaymentRow(apiPayment)`; `SHEET_TEXT`; `useSavePayment()`, `useDeletePayment()`; `<PaymentSheet open onClose mode="payment"|"advance"|"refund"|"edit" orderId invoiceId? due received payment? orderChoices?>`; `<PaymentList payments legacyAdvances? onEdit? onDelete? showOrder?>` (payments are `toPaymentRow` shape plus optional `orderDate`, `orderCancelled`).

- [ ] **Step 1: Backend — the order page shows the list's exact figures (failing test)**

Append inside `describe("GET /orders/list", ...)` in `backend/tests/orderList.test.js`:

```js
  test("the order page's money block equals its list row", async () => {
    const customer = await createCustomer("Delta");
    const plate = await createPlateType("0.00");
    const size = await createSize({ rate_per_kg: "181.25" });
    const o = await createOrderWithLines({ customer, plateType: plate, lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "12.35", rate_per_kg: "181.25" }] }); // 2238.4375
    await db.Payment.create({ order_id: o.id, customer_id: customer.id, amount: "1000.10", payment_type: "PARTIAL", payment_date: "2026-09-02" });
    const row = (await call(listOrders, { query: {} })).body.data.rows[0];
    const detail = (await call(getOrderById, { params: { id: o.id } })).body.data;
    expect(detail.money).toEqual({ total: row.total, received: row.received, due: row.due });
    expect(detail.money).toEqual({ total: 2238.44, received: 1000.1, due: 1238.34 });
  });
```

Run: `cd backend && npm test -- orderList` → Expected: FAIL (`detail.money` undefined).

In `backend/src/controllers/orderController.js`, import `const { orderFacts, rupees } = require("../services/orderFacts");` and add to the object returned by `withComputedFields` (keep every existing field):

```js
    // The figures every new screen shows — identical to the list row and the dashboard.
    money: (() => {
      const f = orderFacts(orderData);
      return { total: rupees(f.totalPaise), received: rupees(f.receivedPaise), due: rupees(f.remainingPaise) };
    })(),
```

Run: `cd backend && npm test -- orderList orderController` → Expected: PASS.

- [ ] **Step 2: Payment rules — failing tests**

`frontend/src/features/payments/paymentForm.test.js`:

```js
import { describe, expect, test } from "vitest";
import { validatePayment, initialPaymentForm, toPaymentRow } from "./paymentForm";

const form = (o) => ({ amount: "", method: "UPI", date: "2026-09-30", reference: "", notes: "", type: "PARTIAL", ...o });

describe("validatePayment", () => {
  test("the whole due is a final payment; less is a part payment", () => {
    expect(validatePayment({ mode: "payment", form: form({ amount: "1000" }), due: 1000, received: 0 }).payload)
      .toEqual({ amount: 1000, payment_type: "FINAL", payment_date: "2026-09-30", payment_method: "UPI", reference_number: null, notes: null });
    expect(validatePayment({ mode: "payment", form: form({ amount: "400" }), due: 1000, received: 0 }).payload.payment_type).toBe("PARTIAL");
  });
  test("more than the due is flagged (the sheet asks before saving)", () => {
    const r = validatePayment({ mode: "payment", form: form({ amount: "1,200" }), due: 1000, received: 0 });
    expect([r.overpay, r.payload.payment_type]).toEqual([200, "FINAL"]);
  });
  test("amount problems are shown, nothing is sent", () => {
    expect(validatePayment({ mode: "payment", form: form(), due: 1000, received: 0 })).toEqual({ errors: { amount: "Enter the amount" }, overpay: 0, payload: null });
    expect(validatePayment({ mode: "payment", form: form({ amount: "12.345" }), due: 1000, received: 0 }).errors.amount).toBe("Use at most 2 decimals");
  });
  test("a refund can't exceed what was received", () => {
    expect(validatePayment({ mode: "refund", form: form({ amount: "600.01" }), due: 400, received: 600 }).errors.amount).toBe("A refund can't be more than received (₹600)");
    expect(validatePayment({ mode: "refund", form: form({ amount: "600" }), due: 400, received: 600 }).payload.payment_type).toBe("REFUND");
  });
  test("advance and edit keep their type; reference and note are trimmed", () => {
    expect(validatePayment({ mode: "advance", form: form({ amount: "500" }), due: 1000, received: 0 }).payload.payment_type).toBe("ADVANCE");
    const edit = validatePayment({ mode: "edit", form: form({ amount: "500", type: "FINAL", reference: " UTR9 ", notes: "  " }), due: 1000, received: 0 });
    expect([edit.payload.payment_type, edit.payload.reference_number, edit.payload.notes]).toEqual(["FINAL", "UTR9", null]);
  });
});

describe("rows and defaults", () => {
  test("API payment → row", () => {
    expect(toPaymentRow({ id: "p1", amount: "250.50", payment_type: "REFUND", payment_method: "UPI", payment_date: "2026-09-02", reference_number: null, notes: "" }))
      .toEqual({ id: "p1", amount: 250.5, type: "REFUND", method: "UPI", date: "2026-09-02", reference: null, notes: null });
  });
  test("editing starts from the saved values", () => {
    expect(initialPaymentForm({ amount: 250.5, type: "FINAL", method: "BANK_TRANSFER", date: "2026-09-02", reference: "R1", notes: null }))
      .toEqual({ amount: "250.5", type: "FINAL", method: "BANK_TRANSFER", date: "2026-09-02", reference: "R1", notes: "" });
  });
});
```

Run: `cd frontend && npx vitest run src/features/payments` → Expected: FAIL (module missing).

- [ ] **Step 3: `paymentForm.js`**

```js
import { parseNumber } from "../../utils/numberInput";
import { paymentTypeFor, overpayment } from "../../utils/paymentType";
import { isISODate, todayIST } from "../../utils/istDate";
import { inr } from "../../utils/dashboardFormat";

export const SHEET_TEXT = {
  payment: { title: "Record payment", save: "Save payment", done: "Payment saved" },
  advance: { title: "Record advance", save: "Save advance", done: "Advance saved" },
  refund: { title: "Record refund", save: "Save refund", done: "Refund saved" },
  edit: { title: "Edit payment", save: "Save changes", done: "Payment updated" },
};

export const initialPaymentForm = (payment) => ({
  amount: payment ? String(payment.amount) : "",
  type: payment?.type || "PARTIAL",
  method: payment?.method || "CASH",
  date: payment?.date || todayIST(),
  reference: payment?.reference || "",
  notes: payment?.notes || "",
});

/** API payment → the row shape every payment list uses. */
export const toPaymentRow = (p) => ({
  id: p.id,
  amount: Number(p.amount),
  type: p.payment_type,
  method: p.payment_method,
  date: p.payment_date,
  reference: p.reference_number || null,
  notes: p.notes || null,
});

/**
 * Check the sheet and build the API body. mode "payment": the type follows the
 * amount; "advance" / "refund": fixed; "edit": the chosen type. overpay > 0
 * means the amount is above the due — the sheet asks once before saving.
 */
export const validatePayment = ({ mode, form, due, received }) => {
  const errors = {};
  const { value: amount, error } = parseNumber(form.amount);
  if (error || amount === null) errors.amount = error || "Enter the amount";
  if (!isISODate(form.date)) errors.date = "Choose the date";
  if (!errors.amount && mode === "refund" && Math.round(amount * 100) > Math.round(received * 100)) {
    errors.amount = `A refund can't be more than received (${inr(received)})`;
  }
  if (Object.keys(errors).length) return { errors, overpay: 0, payload: null };

  const type = { payment: paymentTypeFor(amount, due), advance: "ADVANCE", refund: "REFUND", edit: form.type }[mode];
  return {
    errors,
    overpay: type === "REFUND" ? 0 : overpayment(amount, due),
    payload: {
      amount,
      payment_type: type,
      payment_date: form.date,
      payment_method: form.method,
      reference_number: form.reference.trim() || null,
      notes: form.notes.trim() || null,
    },
  };
};
```

Run: `cd frontend && npx vitest run src/features/payments` → Expected: PASS.

- [ ] **Step 4: Payment hooks, sheet and list**

`frontend/src/features/payments/api.js`:

```js
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentAPI } from "../../services/api";
import { invalidateMoney } from "../../lib/queryKeys";

export const useSavePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => (id ? paymentAPI.update(id, body) : paymentAPI.create(body)).then((r) => r.data.data),
    onSuccess: () => invalidateMoney(qc),
  });
};

export const useDeletePayment = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => paymentAPI.delete(id), onSuccess: () => invalidateMoney(qc) });
};
```

`frontend/src/features/payments/PaymentSheet.jsx`:

```jsx
import { useState } from "react";
import PropTypes from "prop-types";
import Sheet from "../../ui/Sheet";
import Field from "../../ui/Field";
import NumberInput from "../../ui/NumberInput";
import TextInput from "../../ui/TextInput";
import DateField from "../../ui/DateField";
import Chips from "../../ui/Chips";
import Button from "../../ui/Button";
import { Money } from "../../ui/Money";
import { useSavePayment } from "./api";
import { validatePayment, initialPaymentForm, SHEET_TEXT } from "./paymentForm";
import { PAYMENT_METHODS, PAYMENT_TYPE_LABEL } from "../../utils/paymentType";
import { inr, shortDate } from "../../utils/dashboardFormat";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

const METHOD_OPTIONS = PAYMENT_METHODS.map(([value, label]) => ({ value, label }));
const TYPE_OPTIONS = Object.entries(PAYMENT_TYPE_LABEL).map(([value, label]) => ({ value, label }));

/**
 * Record or edit one payment. Give it a new `key` each time it opens so it starts
 * fresh. `orderChoices` (invoice page): which of the invoice's orders it is for.
 */
export default function PaymentSheet({ open, onClose, mode, orderId, invoiceId, due = 0, received = 0, payment = null, orderChoices = null }) {
  const toast = useToast();
  const save = useSavePayment();
  const [form, setForm] = useState(() => initialPaymentForm(payment));
  const [choice, setChoice] = useState(() => orderChoices?.[0]?.id || orderId);
  const [errors, setErrors] = useState({});
  const [overpay, setOverpay] = useState(0);
  const [more, setMore] = useState(Boolean(payment?.reference || payment?.notes));

  const picked = orderChoices?.find((o) => o.id === choice);
  const currentDue = picked ? picked.due : due;
  const currentReceived = picked ? picked.received : received;
  const text = SHEET_TEXT[mode];
  const check = () => validatePayment({ mode, form, due: currentDue, received: currentReceived });
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setOverpay(0);
  };

  const submit = () => {
    const result = check();
    setErrors(result.errors);
    if (!result.payload) return;
    if (result.overpay > 0 && overpay === 0) {
      setOverpay(result.overpay);
      return;
    }
    const body = { ...result.payload, order_id: choice, ...(invoiceId ? { invoice_id: invoiceId } : {}) };
    save.mutate({ id: payment?.id, body }, {
      onSuccess: () => {
        toast.success(text.done);
        onClose();
      },
    });
  };

  const preview = mode === "payment" ? check().payload : null;

  return (
    <Sheet open={open} title={text.title} onClose={onClose}
      footer={
        <div className="space-y-2">
          {overpay > 0 && <p role="alert" className="rounded-2xl bg-status-warn/10 px-3 py-2 text-sm text-status-warn">That&apos;s {inr(overpay)} more than the due. It will show as extra received.</p>}
          {save.isError && <p role="alert" className="text-sm text-status-critical">{errorText(save.error, "Couldn't save. Check your connection and try again.")}</p>}
          <Button block size="lg" loading={save.isPending} onClick={submit}>{overpay > 0 ? "Save anyway" : text.save}</Button>
        </div>
      }>
      <div className="space-y-4">
        {orderChoices && (
          <fieldset>
            <legend className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">For order</legend>
            <div role="radiogroup" className="space-y-1.5">
              {orderChoices.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={o.id === choice} onClick={() => { setChoice(o.id); setOverpay(0); }}
                  className={`flex w-full justify-between rounded-2xl border px-3 py-2.5 text-sm ${o.id === choice ? "border-brass bg-brass/10 text-ink" : "border-line text-ink-2"}`}>
                  <span>{shortDate(o.orderDate)}</span>
                  <span>due <Money value={o.due} /></span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <Field label="Amount" htmlFor="pay-amount" error={errors.amount} hint={mode === "refund" ? `Received so far ${inr(currentReceived)}` : undefined}>
          <NumberInput autoFocus value={form.amount} onChange={(amount) => set({ amount })} prefix="₹" />
        </Field>
        {mode === "payment" && currentDue > 0 && (
          <button type="button" onClick={() => set({ amount: String(currentDue) })}
            className="-mt-2 h-8 rounded-full border border-line px-3 text-xs font-semibold text-ink-2 hover:text-ink">
            Full due {inr(currentDue)}
          </button>
        )}
        {preview && <p className="text-xs text-ink-2">Saved as <span className="font-semibold text-ink">{PAYMENT_TYPE_LABEL[preview.payment_type]}</span></p>}

        {mode === "edit" && (
          <div>
            <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">Type</p>
            <Chips label="Payment type" options={TYPE_OPTIONS} value={form.type} onChange={(type) => set({ type })} />
          </div>
        )}
        <div>
          <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">Paid by</p>
          <Chips label="Payment method" options={METHOD_OPTIONS} value={form.method} onChange={(method) => set({ method })} />
        </div>
        <Field label="Date" htmlFor="pay-date" error={errors.date}>
          <DateField value={form.date} onChange={(date) => set({ date })} />
        </Field>
        {more ? (
          <>
            <Field label="Reference" htmlFor="pay-ref" optional><TextInput value={form.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="UPI ref, cheque no." /></Field>
            <Field label="Note" htmlFor="pay-note" optional><TextInput value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
          </>
        ) : (
          <button type="button" onClick={() => setMore(true)} className="text-sm font-semibold text-brass">＋ Add reference or note</button>
        )}
      </div>
    </Sheet>
  );
}

PaymentSheet.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  mode: PropTypes.oneOf(["payment", "advance", "refund", "edit"]).isRequired,
  orderId: PropTypes.string,
  invoiceId: PropTypes.string,
  due: PropTypes.number,
  received: PropTypes.number,
  payment: PropTypes.object,
  orderChoices: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, orderDate: PropTypes.string.isRequired, due: PropTypes.number.isRequired, received: PropTypes.number.isRequired })),
};
```

`frontend/src/features/payments/PaymentList.jsx`:

```jsx
import { useState } from "react";
import PropTypes from "prop-types";
import { Ellipsis } from "lucide-react";
import IconButton from "../../ui/IconButton";
import ActionSheet from "../../ui/ActionSheet";
import { Money } from "../../ui/Money";
import { EmptyState } from "../../ui/States";
import { PAYMENT_METHODS, PAYMENT_TYPE_LABEL } from "../../utils/paymentType";
import { inr, shortDate } from "../../utils/dashboardFormat";

const METHOD_LABEL = Object.fromEntries(PAYMENT_METHODS);

export default function PaymentList({ payments, legacyAdvances = [], onEdit, onDelete, showOrder = false }) {
  const [menu, setMenu] = useState(null);
  if (!payments.length && !legacyAdvances.length) return <EmptyState title="No payments yet" body="Payments you record show here." />;
  return (
    <>
      <ul className="divide-y divide-line/60 rounded-2xl bg-surface px-4">
        {payments.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{PAYMENT_TYPE_LABEL[p.type] || p.type} · {METHOD_LABEL[p.method] || p.method}</p>
              <p className="truncate text-xs text-ink-2">
                {shortDate(p.date)}
                {showOrder && p.orderDate && ` · order of ${shortDate(p.orderDate)}`}
                {p.orderCancelled && " · cancelled order"}
                {p.reference && ` · Ref ${p.reference}`}
                {p.notes && ` · ${p.notes}`}
              </p>
            </div>
            <span className={`font-num text-sm font-semibold tabular-nums ${p.type === "REFUND" ? "text-ink-2" : "text-ink"}`}>{p.type === "REFUND" ? "−" : ""}{inr(p.amount)}</span>
            {onEdit && (
              <IconButton label={`Actions for the ${inr(p.amount)} payment of ${shortDate(p.date)}`} className="h-9 w-9 bg-transparent" onClick={() => setMenu(p)}>
                <Ellipsis className="h-4 w-4" />
              </IconButton>
            )}
          </li>
        ))}
        {legacyAdvances.map((a) => (
          <li key={`adv-${a.orderId}`} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">Advance</p>
              <p className="text-xs text-ink-2">Noted on the order{showOrder ? ` of ${shortDate(a.orderDate)}` : ""}</p>
            </div>
            <Money value={a.amount} className="text-sm font-semibold" />
          </li>
        ))}
      </ul>
      {onEdit && (
        <ActionSheet open={Boolean(menu)} title="Payment" onClose={() => setMenu(null)}
          actions={menu ? [{ label: "Edit payment", onSelect: () => onEdit(menu) }, { label: "Delete payment", tone: "danger", onSelect: () => onDelete(menu) }] : []} />
      )}
    </>
  );
}

PaymentList.propTypes = {
  payments: PropTypes.array.isRequired,
  legacyAdvances: PropTypes.arrayOf(PropTypes.shape({ orderId: PropTypes.string.isRequired, orderDate: PropTypes.string, amount: PropTypes.number.isRequired })),
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  showOrder: PropTypes.bool,
};
```

- [ ] **Step 5: Order hooks and the order page**

Append to `frontend/src/features/orders/api.js` (and extend its imports to `import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";` and `import { keys, invalidateMoney } from "../../lib/queryKeys";`):

```js
const notFound = (err) => err?.response?.status === 404;

export const useOrder = (id) =>
  useQuery({
    queryKey: keys.orders.detail(id),
    queryFn: () => orderAPI.getById(id).then(body),
    enabled: Boolean(id),
    retry: (count, err) => !notFound(err) && count < 1,
  });

export const useOrderStatus = (id) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (status) => orderAPI.update(id, { status }).then(body), onSuccess: () => invalidateMoney(qc) });
};

export const useDeleteOrder = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => orderAPI.delete(id), onSuccess: () => invalidateMoney(qc) });
};
```

`frontend/src/features/orders/OrderPage.jsx`:

```jsx
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ellipsis, Phone, MessageCircle } from "lucide-react";
import { useOrder, useOrderStatus, useDeleteOrder } from "./api";
import PaymentSheet from "../payments/PaymentSheet";
import PaymentList from "../payments/PaymentList";
import { useDeletePayment } from "../payments/api";
import { toPaymentRow } from "../payments/paymentForm";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Chips from "../../ui/Chips";
import Tabs, { TabPanel } from "../../ui/Tabs";
import ActionSheet from "../../ui/ActionSheet";
import ConfirmDialog from "../../ui/ConfirmDialog";
import StatusBadge from "../../ui/StatusBadge";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import { ORDER_FLOW, ORDER_STATUS } from "../../utils/statusMeta";
import { plateCharge } from "../../utils/orderMath";
import { formatLineQuantity, formatLineRate, formatLineKg } from "../../utils/formatters";
import { inr, shortDate } from "../../utils/dashboardFormat";
import { todayIST } from "../../utils/istDate";
import { telHref, whatsappHref, toIndianMobile, formatMobile } from "../../utils/phone";
import { buildReminder } from "../../utils/whatsappReminder";
import { PAYMENT_TYPE_LABEL } from "../../utils/paymentType";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

const STATUS_OPTIONS = ORDER_FLOW.map((s) => ({ value: s, label: ORDER_STATUS[s].label }));
const signed = (p) => (p.type === "REFUND" ? -p.amount : p.amount);

export default function OrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: order, isPending, isError, error, refetch } = useOrder(id);
  const setStatus = useOrderStatus(id);
  const deleteOrder = useDeleteOrder();
  const deletePayment = useDeletePayment();
  const [tab, setTab] = useState("items");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheet, setSheet] = useState({ open: false, mode: "payment", payment: null, key: 0 });
  const [confirm, setConfirm] = useState(null);

  if (isPending) return <PageSkeleton />;
  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {error?.response?.status === 404 ? (
          <EmptyState title="This order doesn't exist" body="It may have been deleted." action={<Link to="/orders" className={buttonClass({ variant: "secondary" })}>All orders</Link>} />
        ) : (
          <ErrorState title="Couldn't load this order." onRetry={() => refetch()} />
        )}
      </div>
    );
  }

  const { total, received, due } = order.money;
  const cancelled = order.status === "CANCELLED";
  const name = order.customer?.name || "Unknown customer";
  const phone = order.customer?.metadata?.phone || null;
  const mobile = toIndianMobile(phone);
  const call = telHref(phone);
  const remind = due > 0 ? whatsappHref(phone, buildReminder({ name, amount: due, unpaidOrders: [{ orderDate: order.order_date, remaining: due }] })) : null;
  const payments = (order.payments || []).map(toPaymentRow).sort((a, b) => b.date.localeCompare(a.date));
  const hasAdvanceRows = payments.some((p) => p.type === "ADVANCE" && p.amount > 0);
  const legacyAdvances = !hasAdvanceRows && Number(order.advance_received) > 0 ? [{ orderId: order.id, orderDate: order.order_date, amount: Number(order.advance_received) }] : [];
  const roundOff = parseFloat(order.round_off_amount || 0);
  const openSheet = (mode, payment = null) => setSheet({ open: true, mode, payment, key: Date.now() });
  const fail = (err) => toast.error(errorText(err, "That didn't work. Try again."));
  const busy = setStatus.isPending || deleteOrder.isPending || deletePayment.isPending;

  const runConfirm = () => {
    if (confirm.kind === "cancel-order") {
      setStatus.mutate("CANCELLED", { onSuccess: () => { setConfirm(null); toast.success("Order cancelled"); }, onError: fail });
    } else if (confirm.kind === "delete-order") {
      deleteOrder.mutate(id, { onSuccess: () => { toast.success("Order deleted"); navigate("/orders", { replace: true }); }, onError: fail });
    } else if (confirm.kind === "delete-payment") {
      deletePayment.mutate(confirm.payment.id, { onSuccess: () => { setConfirm(null); toast.success("Payment deleted"); }, onError: fail });
    }
  };

  const CONFIRM_TEXT = {
    "cancel-order": { title: "Cancel this order?", message: "It stays in the list marked Cancelled, and stops counting in totals and dues. You can restore it later.", confirmLabel: "Cancel order", cancelLabel: "Keep order" },
    "delete-order": { title: "Delete this order?", message: `The order${payments.length ? ` and its ${payments.length} payment${payments.length === 1 ? "" : "s"}` : ""} will no longer count anywhere. This can't be undone in the app.`, confirmLabel: "Delete order", cancelLabel: "Keep order" },
    "delete-payment": confirm?.payment && { title: "Delete this payment?", message: `${PAYMENT_TYPE_LABEL[confirm.payment.type]} of ${inr(confirm.payment.amount)} on ${shortDate(confirm.payment.date)}. The order's due changes by this amount.`, confirmLabel: "Delete payment", cancelLabel: "Keep payment" },
  };
  const confirmText = confirm ? CONFIRM_TEXT[confirm.kind] : null;

  const actions = [
    { label: "Edit order", onSelect: () => navigate(`/orders/edit/${id}`) },
    !order.invoice_id && !cancelled && { label: "Create invoice", onSelect: () => navigate(`/invoices/new?customer=${order.customer_id}`) },
    !cancelled && { label: "Record advance", onSelect: () => openSheet("advance") },
    received > 0 && { label: "Record refund", onSelect: () => openSheet("refund") },
    !cancelled && { label: "Cancel order", tone: "danger", onSelect: () => setConfirm({ kind: "cancel-order" }) },
    { label: "Delete order", tone: "danger", onSelect: () => setConfirm({ kind: "delete-order" }) },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-num text-xl font-semibold text-ink">{name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">{shortDate(order.order_date)} <StatusBadge status={order.status} /></p>
        </div>
        <IconButton label="More actions for this order" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>
      </div>

      {cancelled && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-raised px-4 py-3 text-sm text-ink-2">
          <span>Cancelled — not counted in totals or dues.</span>
          <Button size="sm" variant="secondary" loading={setStatus.isPending} onClick={() => setStatus.mutate("PENDING", { onSuccess: () => toast.success("Order restored"), onError: fail })}>Restore</Button>
        </div>
      )}
      {order.invoice && (
        <Link to={`/invoices/${order.invoice.id}`} className="block rounded-2xl bg-surface px-4 py-3 text-sm text-ink hover:bg-raised">On invoice #{order.invoice.invoice_number} →</Link>
      )}

      <section aria-label="Money" className="rounded-3xl bg-gradient-to-b from-raised to-surface p-4 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-ink-2"><dt>Total</dt><dd><Money value={total} className="font-semibold text-ink" /></dd></div>
          <div className="flex justify-between text-ink-2"><dt>Received</dt><dd><Money value={received} className="font-semibold text-ink" /></dd></div>
        </dl>
        <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3">
          {cancelled ? (
            <span className="text-sm text-ink-2">Not counted</span>
          ) : due > 0 ? (
            <><span className="text-sm font-semibold text-ink-2">Due</span><Money value={due} className="text-3xl font-bold text-status-critical" /></>
          ) : (
            <><span className="text-sm font-semibold text-status-good">Paid in full ✓</span>{due < 0 && <span className="text-sm text-ink-2"><Money value={-due} /> extra received</span>}</>
          )}
        </div>
        {total > 0 && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className="h-full rounded-full bg-status-good" style={{ width: `${Math.min(100, Math.max(0, (received / total) * 100))}%` }} />
          </div>
        )}
        {!cancelled && <Button block size="lg" className="mt-4" variant={due > 0 ? "primary" : "secondary"} onClick={() => openSheet("payment")}>＋ Record payment</Button>}
      </section>

      <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
        <div className="min-w-0 flex-1">
          <Link to={`/customers/${order.customer_id}`} className="block truncate font-semibold text-ink hover:underline">{name}</Link>
          <p className="text-xs text-ink-2">{mobile ? formatMobile(mobile) : phone || "No mobile number"}</p>
        </div>
        {call && <a href={call} aria-label={`Call ${name}`} className="grid h-10 w-10 place-items-center rounded-full bg-raised text-brass"><Phone className="h-4 w-4" /></a>}
        {remind && <a href={remind} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp reminder to ${name}`} className="grid h-10 w-10 place-items-center rounded-full bg-raised text-status-good"><MessageCircle className="h-4 w-4" /></a>}
      </div>

      {!cancelled && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-2">Status</p>
          <Chips label="Order status" options={STATUS_OPTIONS} value={order.status} onChange={(s) => s !== order.status && setStatus.mutate(s, { onError: fail })} />
        </div>
      )}

      <Tabs label="Order sections" value={tab} onChange={setTab}
        tabs={[{ value: "items", label: "Items" }, { value: "payments", label: `Payments (${payments.length + legacyAdvances.length})` }, { value: "details", label: "Details" }]} />

      {tab === "items" && (
        <TabPanel value="items">
          <ul className="divide-y divide-line/60 rounded-2xl bg-surface px-4">
            {order.orderProductSizes.map((line) => (
              <li key={line.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{line.productSize?.size_label || "Unknown size"} · {formatLineQuantity(line)}</p>
                  <p className="text-xs text-ink-2">{formatLineRate(line)}{formatLineKg(line) ? ` · ${formatLineKg(line)}` : ""}</p>
                </div>
                <Money value={line.line_amount} className="text-sm font-semibold" />
              </li>
            ))}
            <li className="flex justify-between gap-3 py-3 text-sm">
              <span className="text-ink-2">Plate · {order.plateType?.type_name || "—"}{order.custom_plate_charge ? " (custom)" : ""}</span>
              <Money value={plateCharge(order)} className="font-semibold" />
            </li>
            {roundOff !== 0 && (
              <li className="flex justify-between gap-3 py-3 text-sm">
                <span className="text-ink-2">Round off</span>
                <span className="font-num font-semibold tabular-nums">{roundOff > 0 ? "−" : "+"}{inr(Math.abs(roundOff))}</span>
              </li>
            )}
            <li className="flex justify-between gap-3 py-3"><span className="font-semibold text-ink">Total</span><Money value={total} className="font-bold" /></li>
          </ul>
        </TabPanel>
      )}

      {tab === "payments" && (
        <TabPanel value="payments">
          <PaymentList payments={payments} legacyAdvances={legacyAdvances}
            onEdit={(p) => openSheet("edit", p)} onDelete={(p) => setConfirm({ kind: "delete-payment", payment: p })} />
        </TabPanel>
      )}

      {tab === "details" && (
        <TabPanel value="details">
          <dl className="divide-y divide-line/60 rounded-2xl bg-surface px-4 text-sm">
            {[
              ["Order date", shortDate(order.order_date)],
              ["Status", ORDER_STATUS[order.status]?.label || order.status],
              ["Plate type", order.plateType?.type_name || "—"],
              ["Invoice", order.invoice ? `#${order.invoice.invoice_number}` : "Not invoiced yet"],
              ["Entered on", shortDate(todayIST(new Date(order.created_at)))],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 py-3"><dt className="text-ink-2">{label}</dt><dd className="text-right text-ink">{value}</dd></div>
            ))}
          </dl>
        </TabPanel>
      )}

      <ActionSheet open={menuOpen} title="Order" onClose={() => setMenuOpen(false)} actions={actions} />
      {confirmText && <ConfirmDialog open title={confirmText.title} message={confirmText.message} confirmLabel={confirmText.confirmLabel} cancelLabel={confirmText.cancelLabel} busy={busy} onConfirm={runConfirm} onClose={() => setConfirm(null)} />}
      <PaymentSheet key={sheet.key} open={sheet.open} mode={sheet.mode} payment={sheet.payment} orderId={id} received={received}
        due={sheet.payment ? due + signed(sheet.payment) : due} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
    </div>
  );
}
```

- [ ] **Step 6: Route + payments knowledge**

In `frontend/src/App.jsx`: replace the `OrderDetails` lazy import with `const OrderPage = lazy(() => import("./features/orders/OrderPage"));` and the route with `<Route path=":id" element={<OrderPage />} />`.

Replace the sections "## Recording a payment against an order", "## Recording a payment against an invoice" and "## Editing or deleting a payment" in `backend/knowledge/payments.md` with:

```md
## Recording a payment against an order
1. Open the order ([Orders](/orders) → tap it, `/orders/:id`). The money card at
   the top shows **Total**, **Received** and **Due** (or "Paid in full ✓").
2. Tap **＋ Record payment**. A sheet opens: type the **Amount** (or tap
   **Full due ₹…**), pick how it was paid (**Cash / UPI / Bank / Cheque /
   Other**), check the **Date** (today by default; Today / Yesterday
   shortcuts), and optionally **＋ Add reference or note**.
3. The type is worked out from the amount: the whole due (or more) is saved as
   a **Final payment**, less as a **Part payment**. If the amount is more than
   the due, the sheet says by how much and the button becomes **Save anyway**.
4. **Advance** and **Refund** are separate: the order's **⋯** menu has
   **Record advance** and **Record refund** (a refund can't be more than what
   was received).

## Recording a payment against an invoice
1. Open the invoice (`/invoices/:id`) and tap **＋ Payment**. Choose **which
   order** the money is for (orders with a due are listed, oldest first), then
   the same sheet as above. The payment is saved on that order and linked to
   the invoice.

## Editing or deleting a payment
1. On the order page, open the **Payments** tab. Each payment has a **⋯**
   button: **Edit payment** (same sheet, where the type can also be changed)
   or **Delete payment** (asks first).
2. Invoice and customer pages list payments read-only.
```

- [ ] **Step 7: Verify and commit**

Run: `cd frontend && npx eslint src/features && npx vitest run 2>&1 | tail -3` → Expected: clean; pass.
Run: `cd backend && npm test 2>&1 | tail -4` → Expected: pass.

Visual check on the UX copy: an order's money card equals its list row; record a part payment (type preview "Part payment"), then "Full due" (preview "Final payment"); enter more than the due → warning + "Save anyway"; a refund above received shows the error; edit and delete a payment (confirm first); status chips change status; Cancel order → banner + Restore; Delete order returns to Orders; Call/WhatsApp only appear for a valid mobile; 404 id shows "This order doesn't exist".

```bash
git add backend/src/controllers/orderController.js backend/tests/orderList.test.js frontend/src/features/payments frontend/src/features/orders/api.js frontend/src/features/orders/OrderPage.jsx frontend/src/App.jsx backend/knowledge/payments.md
git commit -m "feat(orders): order page with money card, tabs and a payment sheet whose type follows the amount

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Customers — A–Z directory and the customer page

**Files:**
- Modify: `frontend/src/services/api.js` (`customerAPI.directory`, `.summary`, `.similar`)
- Modify: `frontend/src/utils/alphaIndex.js` (+ `initials`), `frontend/src/utils/grouping.test.js`
- Create: `frontend/src/features/customers/api.js`, `CustomersPage.jsx`, `CustomerRow.jsx`, `CustomerPage.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `/api/customers/directory`, `/:id/summary`, `/similar` (Task 6); `OrderRow` (Task 13); `PaymentList` (Task 14).
- Produces: `useDirectory(params)`, `useCustomerSummary(id)`, `useCustomer(id)`, `useSimilar(name, excludeId)`, `useSaveCustomer(id?)`, `useDeleteCustomer()`; `initials(name)`.

- [ ] **Step 1: `initials` — failing test, then implement**

Append to `frontend/src/utils/grouping.test.js`:

```js
import { initials } from "./alphaIndex";

describe("initials", () => {
  test("first letters of the first two words", () => {
    expect([initials("Sri Veerbhadreshwar"), initials("zed"), initials("12 Star Traders"), initials("  ")]).toEqual(["SV", "Z", "1S", "?"]);
  });
});
```

Run: `cd frontend && npx vitest run src/utils/grouping.test.js` → Expected: FAIL.

Append to `frontend/src/utils/alphaIndex.js`:

```js
export const initials = (name) => {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  return words.length ? words.slice(0, 2).map((w) => w[0].toUpperCase()).join("") : "?";
};
```

Run: same → Expected: PASS.

- [ ] **Step 2: API + hooks**

In `frontend/src/services/api.js` add to `customerAPI`:

```js
  directory: (params) => api.get("/customers/directory", { params }),
  summary: (id) => api.get(`/customers/${id}/summary`),
  similar: (params) => api.get("/customers/similar", { params }),
```

`frontend/src/features/customers/api.js`:

```js
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerAPI } from "../../services/api";
import { keys, invalidateMoney } from "../../lib/queryKeys";

const body = (res) => res.data.data;
const notFound = (err) => err?.response?.status === 404;

/** Customers screen / pickers: 100 per page (rows are small). */
export const useDirectory = (params) =>
  useInfiniteQuery({
    queryKey: keys.customers.directory(params),
    queryFn: ({ pageParam }) => customerAPI.directory({ ...params, page: pageParam, limit: 100 }).then(body),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: (previous) => previous,
  });

export const useCustomerSummary = (id) =>
  useQuery({ queryKey: keys.customers.summary(id), queryFn: () => customerAPI.summary(id).then(body), enabled: Boolean(id), retry: (n, err) => !notFound(err) && n < 1 });

export const useCustomer = (id) =>
  useQuery({ queryKey: keys.customers.detail(id), queryFn: () => customerAPI.getById(id).then(body), enabled: Boolean(id), retry: (n, err) => !notFound(err) && n < 1 });

/** "Already a customer?" while typing — from 3 letters. */
export const useSimilar = (name, excludeId) => {
  const term = name.trim();
  return useQuery({
    queryKey: keys.customers.similar(term, excludeId),
    queryFn: () => customerAPI.similar({ name: term, excludeId }).then(body),
    enabled: term.length >= 3,
    staleTime: 60_000,
  });
};

/** A rename shows on orders and invoices too, so everything with money refreshes. */
export const useSaveCustomer = (id) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload) => (id ? customerAPI.update(id, payload) : customerAPI.create(payload)).then(body), onSuccess: () => invalidateMoney(qc) });
};

export const useDeleteCustomer = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => customerAPI.delete(id), onSuccess: () => invalidateMoney(qc) });
};
```

- [ ] **Step 3: Directory row and page**

`frontend/src/features/customers/CustomerRow.jsx`:

```jsx
import { memo } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { Phone } from "lucide-react";
import { Money } from "../../ui/Money";
import { initials } from "../../utils/alphaIndex";
import { shortDate } from "../../utils/dashboardFormat";
import { telHref } from "../../utils/phone";

function CustomerRow({ customer: c, oweView = false }) {
  const call = telHref(c.phone);
  const meta = oweView
    ? <><span className={c.oldestUnpaidDays > 90 ? "font-semibold text-status-critical" : ""}>{c.oldestUnpaidDays} days</span> since the oldest unpaid order</>
    : c.lastOrderDate ? `Last order ${shortDate(c.lastOrderDate)} · ${c.ordersCount} order${c.ordersCount === 1 ? "" : "s"}` : "No orders yet";
  return (
    <li className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5 last:border-0">
      <Link to={`/customers/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-raised text-xs font-bold text-brass" aria-hidden="true">{initials(c.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
          <span className="block truncate text-xs text-ink-2">{meta}</span>
        </span>
        <span className="shrink-0 text-right">
          {c.due > 0 ? <Money value={c.due} className="text-sm font-bold text-status-critical" /> : <span className="text-xs font-semibold text-status-good">Paid up</span>}
        </span>
      </Link>
      {call && <a href={call} aria-label={`Call ${c.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-raised text-brass"><Phone className="h-4 w-4" /></a>}
    </li>
  );
}

CustomerRow.propTypes = { customer: PropTypes.object.isRequired, oweView: PropTypes.bool };

export default memo(CustomerRow);
```

`frontend/src/features/customers/CustomersPage.jsx`:

```jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useDirectory } from "./api";
import CustomerRow from "./CustomerRow";
import Chips from "../../ui/Chips";
import TextInput from "../../ui/TextInput";
import PageHeader from "../../ui/PageHeader";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { groupByLetter } from "../../utils/alphaIndex";
import { inr } from "../../utils/dashboardFormat";

export default function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const owe = params.get("owe") === "1";
  const search = params.get("q") || "";
  const term = useDebounced(search.trim());
  const list = useDirectory({ owe: owe ? "1" : undefined, search: term || undefined });
  const sentinel = useInfiniteSentinel(list);
  const pages = list.data?.pages;
  const rows = useMemo(() => (pages || []).flatMap((p) => p.rows), [pages]);
  const first = pages?.[0];
  const groups = useMemo(() => (owe ? [] : groupByLetter(rows)), [rows, owe]);
  const [jump, setJump] = useState(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;

  // Letter index: load pages until that letter is on screen, then scroll to it.
  useEffect(() => {
    if (!jump) return;
    if (rows.length > jump.index || !hasNextPage) {
      document.getElementById(`letter-${jump.letter}`)?.scrollIntoView({ block: "start" });
      setJump(null);
    } else if (!isFetchingNextPage) {
      fetchNextPage();
    }
  }, [jump, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const setParam = (key, value) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });

  const s = first?.summary;
  const chips = [
    { value: "all", label: "All", count: s?.count },
    { value: "owe", label: "Owe money", count: s?.owingCount },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Customers" actions={<Link to="/customers/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>} />
      <div className="mt-3 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setParam("q", e.target.value)} placeholder="Search name or phone" aria-label="Search customers" enterKeyHint="search" />
        <Chips label="Which customers" options={chips} value={owe ? "owe" : "all"} onChange={(v) => setParam("owe", v === "owe" ? "1" : "")} />
        {owe && s && <p className="text-sm text-ink-2" aria-live="polite">{s.owingCount} customer{s.owingCount === 1 ? "" : "s"} owe <span className="font-num font-semibold text-status-critical tabular-nums">{inr(s.due)}</span> · oldest first</p>}
      </div>

      <div className={`mt-3 flex gap-2 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        <div className="min-w-0 flex-1">
          {list.isPending ? (
            <ListSkeleton />
          ) : list.isError && rows.length === 0 ? (
            <ErrorState title="Couldn't load customers." onRetry={() => list.refetch()} />
          ) : rows.length === 0 ? (
            term ? (
              <EmptyState title={`No customer matches “${term}”`} action={<Link to={`/customers/new?name=${encodeURIComponent(term)}`} className={buttonClass({ variant: "secondary" })}>Add “{term}” as a customer</Link>} />
            ) : owe ? (
              <EmptyState title="Nobody owes you money" body="Every order is paid up." />
            ) : (
              <EmptyState title="No customers yet" action={<Link to="/customers/new" className={buttonClass()}>Add a customer</Link>} />
            )
          ) : owe ? (
            <ul className="overflow-hidden rounded-2xl bg-surface">{rows.map((c) => <CustomerRow key={c.id} customer={c} oweView />)}</ul>
          ) : (
            groups.map((g) => (
              <section key={g.letter} aria-labelledby={`letter-${g.letter}`} className="mb-3">
                <h2 id={`letter-${g.letter}`} className="sticky top-0 z-[1] bg-canvas/95 px-1 py-1.5 text-xs font-bold text-brass backdrop-blur">{g.letter}</h2>
                <ul className="overflow-hidden rounded-2xl bg-surface">{g.rows.map((c) => <CustomerRow key={c.id} customer={c} />)}</ul>
              </section>
            ))
          )}
          <div ref={sentinel} aria-hidden="true" />
          {list.isFetchingNextPage && <ListSkeleton rows={2} />}
        </div>

        {!owe && first?.letters?.length > 1 && (
          <nav aria-label="Jump to letter" className="sticky top-4 flex flex-col self-start rounded-full bg-surface/80 py-1">
            {first.letters.map((l) => (
              <button key={l.letter} type="button" onClick={() => setJump(l)} className="px-2 py-0.5 text-[11px] font-bold text-ink-2 hover:text-brass focus-visible:text-brass">{l.letter}</button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Customer page**

`frontend/src/features/customers/CustomerPage.jsx`:

```jsx
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PropTypes from "prop-types";
import { Ellipsis, Phone, MessageCircle, Plus } from "lucide-react";
import { useCustomerSummary, useDeleteCustomer } from "./api";
import OrderRow from "../orders/OrderRow";
import PaymentList from "../payments/PaymentList";
import IconButton from "../../ui/IconButton";
import Tabs, { TabPanel } from "../../ui/Tabs";
import ActionSheet from "../../ui/ActionSheet";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import { telHref, whatsappHref, toIndianMobile, formatMobile } from "../../utils/phone";
import { buildReminder } from "../../utils/whatsappReminder";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

const since = (iso) => (iso ? new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso)) : null);

function OrderGroup({ title, rows }) {
  if (!rows.length) return null;
  return (
    <section className="mb-3">
      <h3 className="px-1 pb-1.5 text-xs font-semibold text-ink-2">{title}</h3>
      <ul className="overflow-hidden rounded-2xl bg-surface">{rows.map((r) => <OrderRow key={r.id} row={r} showCustomer={false} />)}</ul>
    </section>
  );
}

OrderGroup.propTypes = { title: PropTypes.string.isRequired, rows: PropTypes.array.isRequired };

export default function CustomerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: s, isPending, isError, error, refetch } = useCustomerSummary(id);
  const del = useDeleteCustomer();
  const [tab, setTab] = useState("orders");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isPending) return <PageSkeleton />;
  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {error?.response?.status === 404
          ? <EmptyState title="This customer doesn't exist" body="They may have been deleted." action={<Link to="/customers" className={buttonClass({ variant: "secondary" })}>All customers</Link>} />
          : <ErrorState title="Couldn't load this customer." onRetry={() => refetch()} />}
      </div>
    );
  }

  const { customer } = s;
  const unpaid = s.orders.filter((o) => !o.cancelled && o.due > 0);
  const paid = s.orders.filter((o) => !o.cancelled && o.due <= 0);
  const cancelledOrders = s.orders.filter((o) => o.cancelled);
  const mobile = toIndianMobile(customer.phone);
  const call = telHref(customer.phone);
  const remind = s.owes > 0
    ? whatsappHref(customer.phone, buildReminder({
        name: customer.name, amount: s.owes,
        unpaidOrders: [...unpaid].sort((a, b) => a.orderDate.localeCompare(b.orderDate)).map((o) => ({ orderDate: o.orderDate, remaining: o.due })),
      }))
    : null;

  const remove = () =>
    del.mutate(id, {
      onSuccess: () => { toast.success("Customer deleted"); navigate("/customers", { replace: true }); },
      onError: (err) => toast.error(errorText(err, "Couldn't delete. Try again.")),
    });

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-num text-xl font-semibold text-ink">{customer.name}</h2>
          <p className="mt-0.5 text-sm text-ink-2">
            {mobile ? formatMobile(mobile) : customer.phone || "No mobile number"}
            {customer.city && ` · ${customer.city}`}
            {since(customer.createdAt) && ` · customer since ${since(customer.createdAt)}`}
          </p>
        </div>
        <IconButton label="More actions for this customer" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>
      </div>

      <section aria-label="Money" className="rounded-3xl bg-gradient-to-b from-raised to-surface p-4 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
        <p className="text-sm text-ink-2">Owes</p>
        {s.owes > 0 ? (
          <>
            <Money value={s.owes} className="block text-3xl font-bold text-status-critical" />
            <p className="text-sm text-ink-2">oldest unpaid order {s.oldestUnpaidDays} days</p>
          </>
        ) : (
          <p className="text-2xl font-semibold text-status-good">Paid up ✓</p>
        )}
        {s.credit > 0 && <p className="mt-1 text-sm text-ink-2"><Money value={s.credit} /> received more than billed</p>}
        <dl className="mt-3 grid grid-cols-3 gap-2">
          {[["Total business", <Money key="b" value={s.totalBusiness} />], ["Received", <Money key="r" value={s.received} />], ["Orders", <span key="o" className="font-num tabular-nums">{s.ordersCount}</span>]].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-canvas/50 p-2"><dt className="text-[0.7rem] text-ink-2">{label}</dt><dd className="text-sm font-semibold text-ink">{value}</dd></div>
          ))}
        </dl>
        <div className="mt-3 flex gap-2">
          <Link to={`/orders/new?customer=${customer.id}`} className={`${buttonClass({ block: true })} flex-1`}><Plus className="h-4 w-4" aria-hidden="true" />New order</Link>
          {call && <a href={call} className={`${buttonClass({ variant: "secondary" })} flex-1`}><Phone className="h-4 w-4" aria-hidden="true" />Call</a>}
          {remind && <a href={remind} target="_blank" rel="noopener noreferrer" className={`${buttonClass({ variant: "secondary" })} flex-1`}><MessageCircle className="h-4 w-4" aria-hidden="true" />Remind</a>}
        </div>
        {!mobile && <p className="mt-2 text-xs text-ink-2"><Link to={`/customers/edit/${customer.id}`} className="font-semibold text-brass">Add a mobile number</Link> to call or send WhatsApp reminders.</p>}
      </section>

      <Tabs label="Customer sections" value={tab} onChange={setTab}
        tabs={[{ value: "orders", label: `Orders (${s.orders.length})` }, { value: "payments", label: "Payments" }, { value: "details", label: "Details" }]} />

      {tab === "orders" && (
        <TabPanel value="orders">
          {s.orders.length === 0 ? (
            <EmptyState title="No orders yet" action={<Link to={`/orders/new?customer=${customer.id}`} className={buttonClass()}>New order</Link>} />
          ) : (
            <>
              <OrderGroup title="Unpaid" rows={unpaid} />
              <OrderGroup title="Paid" rows={paid} />
              <OrderGroup title="Cancelled — not counted" rows={cancelledOrders} />
            </>
          )}
        </TabPanel>
      )}
      {tab === "payments" && (
        <TabPanel value="payments"><PaymentList payments={s.payments} legacyAdvances={s.legacyAdvances} showOrder /></TabPanel>
      )}
      {tab === "details" && (
        <TabPanel value="details">
          <dl className="divide-y divide-line/60 rounded-2xl bg-surface px-4 text-sm">
            {[
              ["Mobile", mobile ? `+91 ${formatMobile(mobile)}` : customer.phone || "—"],
              ["City / area", customer.city || "—"],
              ["Email", customer.email || "—"],
              ["Address", customer.address || "—"],
              ["GSTIN", customer.gstin || "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 py-3"><dt className="text-ink-2">{label}</dt><dd className="text-right text-ink">{value}</dd></div>
            ))}
          </dl>
          <Link to={`/customers/edit/${customer.id}`} className={`${buttonClass({ variant: "secondary", block: true })} mt-3`}>Edit details</Link>
        </TabPanel>
      )}

      <ActionSheet open={menuOpen} title="Customer" onClose={() => setMenuOpen(false)}
        actions={[{ label: "Edit customer", onSelect: () => navigate(`/customers/edit/${id}`) }, { label: "Delete customer", tone: "danger", onSelect: () => setConfirmDelete(true) }]} />
      <ConfirmDialog open={confirmDelete} title={`Delete ${customer.name}?`} confirmLabel="Delete customer" cancelLabel="Keep customer" busy={del.isPending}
        message={`They will be removed from your customer list. ${s.orders.length ? `Their ${s.orders.length} order${s.orders.length === 1 ? "" : "s"} stay and still count in totals and dues.` : ""}`}
        onConfirm={remove} onClose={() => setConfirmDelete(false)} />
    </div>
  );
}
```

- [ ] **Step 5: Routes, verify, commit**

In `frontend/src/App.jsx`: replace the `Customers` and `CustomerDetails` lazy imports with `const CustomersPage = lazy(() => import("./features/customers/CustomersPage"));` and `const CustomerPage = lazy(() => import("./features/customers/CustomerPage"));`; routes `<Route index element={<CustomersPage />} />` and `<Route path=":id" element={<CustomerPage />} />`.

Run: `cd frontend && npx eslint src/features src/utils && npx vitest run 2>&1 | tail -3` → Expected: clean; pass.

Visual check on the UX copy: `/customers` A–Z with letter headers and a right-hand index — tapping Z loads the rest and scrolls there; "Owe money" lists the same customers and total as the Dues screen, oldest first; searching `453` finds a customer by phone digits; "Veerbhadreshwar"'s page lists only its own orders; totals on the customer page add up (business − received = owes − extra).

```bash
git add frontend/src/services/api.js frontend/src/utils/alphaIndex.js frontend/src/utils/grouping.test.js frontend/src/features/customers/api.js frontend/src/features/customers/CustomersPage.jsx frontend/src/features/customers/CustomerRow.jsx frontend/src/features/customers/CustomerPage.jsx frontend/src/App.jsx
git commit -m "feat(customers): A–Z directory with dues and a customer page matched by id

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 16: Customer form, similar-name warning, quick-create and the customer picker

**Files:**
- Create: `frontend/src/features/customers/customerForm.js`, `customerForm.test.js`, `SimilarWarning.jsx`, `CustomerFormPage.jsx`, `QuickCustomerSheet.jsx`, `CustomerPicker.jsx`
- Modify: `frontend/src/App.jsx`, `backend/knowledge/customers.md`

**Interfaces:**
- Consumes: `useSimilar`, `useSaveCustomer`, `useCustomer`, `useDirectory` (Task 15); `mobileStatus`, `mobileDigits` (Task 9).
- Produces: `emptyCustomer()`, `formFromCustomer(apiCustomer)`, `validateCustomer(form) → errors`, `toCustomerPayload(form)`; `<SimilarWarning name excludeId? onPick?>`; `<QuickCustomerSheet open initialName onClose onCreated(customer)>`; `<CustomerPicker open onClose onPick(customer)>` where customer = `{ id, name, phone, due }`.

- [ ] **Step 1: Failing tests**

`frontend/src/features/customers/customerForm.test.js`:

```js
import { describe, expect, test } from "vitest";
import { emptyCustomer, formFromCustomer, validateCustomer, toCustomerPayload } from "./customerForm";

const form = (o) => ({ ...emptyCustomer(), ...o });

describe("customer form", () => {
  test("name is the only required field", () => {
    expect(validateCustomer(form())).toEqual({ name: "Enter the shop or customer name" });
    expect(validateCustomer(form({ name: "Laxmi Bags" }))).toEqual({});
  });
  test("email and GSTIN are checked only when typed", () => {
    expect(validateCustomer(form({ name: "X", email: "laxmi@", gstin: "29abc" }))).toEqual({
      email: "That email doesn't look right",
      gstin: "GSTIN should be 15 characters, like 29ABCDE1234F1Z5",
    });
    expect(validateCustomer(form({ name: "X", gstin: "29abcde1234f1z5" }))).toEqual({});
  });
  test("payload: trimmed, a valid mobile saved as 10 digits, GSTIN upper-case, empty fields cleared", () => {
    expect(toCustomerPayload(form({ name: " Laxmi Bags ", phone: "+91 98765 43210", city: " Bidar ", gstin: "29abcde1234f1z5" })))
      .toEqual({ name: "Laxmi Bags", phone: "9876543210", city: "Bidar", email: "", address: "", gstin: "29ABCDE1234F1Z5" });
    expect(toCustomerPayload(form({ name: "Zed", phone: "08217 453398" })).phone).toBe("08217 453398");
  });
  test("editing starts from the saved values", () => {
    expect(formFromCustomer({ name: "Zed", metadata: { phone: "9876543210", gstin: "29ABCDE1234F1Z5" } }))
      .toEqual({ name: "Zed", phone: "9876543210", city: "", email: "", address: "", gstin: "29ABCDE1234F1Z5" });
  });
});
```

Run: `cd frontend && npx vitest run src/features/customers` → Expected: FAIL (module missing).

- [ ] **Step 2: `customerForm.js`**

```js
import { mobileDigits, mobileStatus } from "../../utils/phone";

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/; // same rule as the server

export const emptyCustomer = () => ({ name: "", phone: "", city: "", email: "", address: "", gstin: "" });

export const formFromCustomer = (c) => {
  const m = c.metadata || {};
  return { name: c.name || "", phone: m.phone || "", city: m.city || "", email: m.email || "", address: m.address || "", gstin: m.gstin || "" };
};

export const validateCustomer = (f) => {
  const e = {};
  if (!f.name.trim()) e.name = "Enter the shop or customer name";
  if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "That email doesn't look right";
  if (f.gstin.trim() && !GSTIN.test(f.gstin.trim().toUpperCase())) e.gstin = "GSTIN should be 15 characters, like 29ABCDE1234F1Z5";
  return e;
};

/** Empty strings clear a saved field. A valid mobile is stored as its 10 digits; anything else as typed. */
export const toCustomerPayload = (f) => ({
  name: f.name.trim(),
  phone: mobileStatus(f.phone) === "valid" ? mobileDigits(f.phone) : f.phone.trim(),
  city: f.city.trim(),
  email: f.email.trim(),
  address: f.address.trim(),
  gstin: f.gstin.trim().toUpperCase(),
});
```

Run: `cd frontend && npx vitest run src/features/customers` → Expected: PASS.

- [ ] **Step 3: Similar-name warning, quick-create sheet, picker**

`frontend/src/features/customers/SimilarWarning.jsx`:

```jsx
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { useSimilar } from "./api";
import useDebounced from "../../ui/useDebounced";
import { inr } from "../../utils/dashboardFormat";

/** "Is it one of these?" — never blocks saving. With onPick (inside an order), choosing one uses that customer. */
export default function SimilarWarning({ name, excludeId, onPick }) {
  const term = useDebounced(name.trim(), 350);
  const { data } = useSimilar(term, excludeId);
  if (!data?.length) return null;
  const label = (c) => `${c.name} · ${c.due > 0 ? `owes ${inr(c.due)}` : "paid up"}`;
  return (
    <div role="status" className="rounded-2xl border border-status-warn/35 bg-status-warn/10 px-3 py-2.5 text-sm text-status-warn">
      <p>Similar names already exist — is it one of these?</p>
      <ul className="mt-1.5 space-y-1">
        {data.map((c) => (
          <li key={c.id}>
            {onPick ? (
              <button type="button" onClick={() => onPick(c)} className="text-left font-semibold text-ink hover:underline">{label(c)} — use this one</button>
            ) : (
              <Link to={`/customers/${c.id}`} className="font-semibold text-ink hover:underline">{label(c)} ›</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

SimilarWarning.propTypes = { name: PropTypes.string.isRequired, excludeId: PropTypes.string, onPick: PropTypes.func };
```

`frontend/src/features/customers/QuickCustomerSheet.jsx`:

```jsx
import { useState } from "react";
import PropTypes from "prop-types";
import Sheet from "../../ui/Sheet";
import Field from "../../ui/Field";
import TextInput from "../../ui/TextInput";
import PhoneInput from "../../ui/PhoneInput";
import Button from "../../ui/Button";
import SimilarWarning from "./SimilarWarning";
import { useSaveCustomer } from "./api";
import { emptyCustomer, validateCustomer, toCustomerPayload } from "./customerForm";
import { errorText } from "../../lib/errors";

/** Name + mobile only, from inside a form; the rest can be added on the customer's page. Mount with a new key per opening. */
export default function QuickCustomerSheet({ open, initialName = "", onClose, onCreated }) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const save = useSaveCustomer();

  const submit = () => {
    const f = { ...emptyCustomer(), name, phone };
    const errs = validateCustomer(f);
    if (errs.name) {
      setError(errs.name);
      return;
    }
    save.mutate(toCustomerPayload(f), { onSuccess: (c) => onCreated({ id: c.id, name: c.name, phone: c.metadata?.phone || null, due: 0 }) });
  };

  return (
    <Sheet open={open} title="Quick new customer" onClose={onClose}
      footer={
        <div className="space-y-2">
          {save.isError && <p role="alert" className="text-sm text-status-critical">{errorText(save.error, "Couldn't save the customer. Try again.")}</p>}
          <Button block size="lg" loading={save.isPending} onClick={submit}>Save &amp; choose</Button>
        </div>
      }>
      <div className="space-y-4">
        <Field label="Shop / customer name" htmlFor="quick-name" error={error}>
          <TextInput autoFocus value={name} onChange={(e) => { setName(e.target.value); setError(""); }} autoCapitalize="words" />
        </Field>
        <SimilarWarning name={name} onPick={(c) => onCreated(c)} />
        <Field label="Mobile" htmlFor="quick-phone" optional hint="Add the rest later from the customer's page">
          <PhoneInput value={phone} onChange={setPhone} />
        </Field>
      </div>
    </Sheet>
  );
}

QuickCustomerSheet.propTypes = { open: PropTypes.bool.isRequired, initialName: PropTypes.string, onClose: PropTypes.func.isRequired, onCreated: PropTypes.func.isRequired };
```

`frontend/src/features/customers/CustomerPicker.jsx`:

```jsx
import { useState } from "react";
import PropTypes from "prop-types";
import SearchPicker from "../../ui/SearchPicker";
import Button from "../../ui/Button";
import { Money } from "../../ui/Money";
import QuickCustomerSheet from "./QuickCustomerSheet";
import { useDirectory } from "./api";
import useDebounced from "../../ui/useDebounced";
import { shortDate } from "../../utils/dashboardFormat";

/** Search customers (recent first when empty); "＋ New customer" adds one without leaving the form. */
export default function CustomerPicker({ open, onClose, onPick }) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(0); // 0 = closed; otherwise the sheet's key
  const term = useDebounced(query.trim());
  const list = useDirectory({ sort: term ? "name" : "recent", search: term || undefined });
  const rows = list.data?.pages?.[0]?.rows || [];

  const pick = (c) => {
    onPick({ id: c.id, name: c.name, phone: c.phone || null, due: c.due || 0 });
    setQuery("");
    setCreating(0);
  };

  return (
    <>
      <SearchPicker open={open && !creating} title="Choose customer" query={query} onQuery={setQuery} placeholder="Search name or phone"
        loading={list.isPending} error={list.isError ? "Couldn't load customers." : undefined}
        items={rows} getKey={(c) => c.id} onPick={pick} onClose={onClose}
        empty={term ? `No customer matches “${term}”` : "No customers yet"}
        renderItem={(c) => (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink">{c.name}</span>
              <span className="block text-xs text-ink-2">{c.lastOrderDate ? `Last order ${shortDate(c.lastOrderDate)}` : "No orders yet"}</span>
            </span>
            {c.due > 0 && <Money value={c.due} className="text-sm font-semibold text-status-critical" />}
          </>
        )}
        footer={<Button variant="secondary" block onClick={() => setCreating(Date.now())}>＋ New customer{term ? ` “${term}”` : ""}</Button>} />
      {creating > 0 && (
        <QuickCustomerSheet key={creating} open={open} initialName={term} onClose={() => setCreating(0)} onCreated={pick} />
      )}
    </>
  );
}

CustomerPicker.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onPick: PropTypes.func.isRequired };
```

- [ ] **Step 4: The full form page**

`frontend/src/features/customers/CustomerFormPage.jsx`:

```jsx
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useCustomer, useSaveCustomer } from "./api";
import SimilarWarning from "./SimilarWarning";
import { emptyCustomer, formFromCustomer, validateCustomer, toCustomerPayload } from "./customerForm";
import Field from "../../ui/Field";
import TextInput from "../../ui/TextInput";
import PhoneInput from "../../ui/PhoneInput";
import Button from "../../ui/Button";
import StickyFooter from "../../ui/StickyFooter";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { INPUT, buttonClass } from "../../ui/styles";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function CustomerFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = useCustomer(id);
  const save = useSaveCustomer(id);
  const presetName = search.get("name") || "";
  const initial = useMemo(
    () => (isEdit ? (existing.data ? formFromCustomer(existing.data) : null) : { ...emptyCustomer(), name: presetName }),
    [isEdit, existing.data, presetName]
  );
  const [edited, setEdited] = useState(null);
  const [shown, setShown] = useState(false);
  const [moreOpen, setMoreOpen] = useState(null); // null = open only if those fields have values

  if (isEdit && existing.isPending) return <PageSkeleton />;
  if (isEdit && existing.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {existing.error?.response?.status === 404
          ? <EmptyState title="This customer doesn't exist" action={<Link to="/customers" className={buttonClass({ variant: "secondary" })}>All customers</Link>} />
          : <ErrorState title="Couldn't load this customer." onRetry={() => existing.refetch()} />}
      </div>
    );
  }

  const form = edited ?? initial;
  const set = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));
  const errors = shown ? validateCustomer(form) : {};
  const showMore = moreOpen ?? Boolean(form.email || form.address || form.gstin);

  const submit = (e) => {
    e.preventDefault();
    const errs = validateCustomer(form);
    if (Object.keys(errs).length) {
      setShown(true);
      if (errs.email || errs.gstin) setMoreOpen(true);
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    save.mutate(toCustomerPayload(form), {
      onSuccess: (c) => {
        toast.success(isEdit ? "Changes saved" : "Customer added");
        navigate(`/customers/${isEdit ? id : c.id}`, { replace: true });
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-xl px-4 pt-4 sm:px-6">
      <div className="space-y-5">
        <Field label="Shop / customer name" htmlFor="c-name" error={errors.name}>
          <TextInput value={form.name} onChange={(e) => set({ name: e.target.value })} autoCapitalize="words" autoComplete="organization" autoFocus={!isEdit} />
        </Field>
        <SimilarWarning name={form.name} excludeId={id} />
        <Field label={<>Mobile <span className="font-normal">(for calls and WhatsApp reminders)</span></>} htmlFor="c-phone">
          <PhoneInput value={form.phone} onChange={(phone) => set({ phone })} />
        </Field>
        <Field label="City / area" htmlFor="c-city" optional>
          <TextInput value={form.city} onChange={(e) => set({ city: e.target.value })} placeholder="e.g. Bidar, Bhalki" autoCapitalize="words" />
        </Field>
        {showMore ? (
          <div className="space-y-5">
            <Field label="Email" htmlFor="c-email" optional error={errors.email}>
              <TextInput type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
            <Field label="Full address" htmlFor="c-address" optional>
              <textarea rows={3} value={form.address} onChange={(e) => set({ address: e.target.value })} className={`${INPUT} h-auto py-3`} />
            </Field>
            <Field label="GSTIN" htmlFor="c-gstin" optional error={errors.gstin} hint="Useful for GST invoices">
              <TextInput value={form.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} autoCapitalize="characters" maxLength={15} placeholder="29ABCDE1234F1Z5" className="font-num uppercase" />
            </Field>
          </div>
        ) : (
          <button type="button" onClick={() => setMoreOpen(true)} className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 text-sm text-ink-2">
            <span>More details · email, full address, GSTIN</span>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <StickyFooter>
        {save.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(save.error, "Couldn't save. Check your connection and try again.")}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={() => navigate(isEdit ? `/customers/${id}` : "/customers", { replace: true })}>Cancel</Button>
          <Button type="submit" block size="lg" loading={save.isPending}>{isEdit ? "Save changes" : "Save customer"}</Button>
        </div>
      </StickyFooter>
    </form>
  );
}
```

- [ ] **Step 5: Routes, knowledge, verify, commit**

In `frontend/src/App.jsx`: replace the `CreateCustomer` and `EditCustomer` lazy imports with `const CustomerFormPage = lazy(() => import("./features/customers/CustomerFormPage"));` and routes `<Route path="new" element={<CustomerFormPage />} />`, `<Route path="edit/:id" element={<CustomerFormPage />} />`.

Replace the whole of `backend/knowledge/customers.md` with:

```md
# Customers

What it is: the shops and people you sell to. A customer has a name and,
optionally, a mobile number (used for Call and WhatsApp reminders), a city or
area, and under "More details" an email, full address and GSTIN.

## Finding a customer
1. Open [Customers](/customers). Everyone is listed A–Z with a letter index on
   the right; each row shows the last order and number of orders, and what the
   customer owes in red (or "Paid up"). The phone button calls them.
2. Search by name, or by any 3+ digits of the phone number.
3. Tap **Owe money** to see only customers who owe, oldest unpaid first (the
   same list as [Dues](/dues)).

## The customer page
`/customers/:id` shows what they **Owe** (and how old their oldest unpaid
order is), **Total business**, **Received** and number of **Orders**, with
**New order**, **Call** and **Remind** (a WhatsApp message listing the unpaid
orders). Tabs: **Orders** (Unpaid / Paid / Cancelled), **Payments**,
**Details**. Only this customer's own orders are shown; cancelled orders are
listed but not counted.

## Adding a customer
1. On [Customers](/customers) tap **New**. (While making an order or invoice,
   the customer picker's **＋ New customer** opens a quick name + mobile form
   and returns straight to the order.)
2. Type the **Shop / customer name**. If similar names already exist, a warning
   lists them with what they owe, so the same shop isn't added twice.
3. **Mobile** (optional, recommended): the 10-digit number after +91; a tick
   confirms Call and WhatsApp will work.
4. **City / area** (optional). **More details**: email, full address, GSTIN
   (15 characters, e.g. 29ABCDE1234F1Z5).
5. Tap **Save customer**.

## Editing or deleting
- Customer page → **⋯ → Edit customer** (same form), or **Details → Edit details**.
- **⋯ → Delete customer** asks first. Their orders stay and still count in
  totals and dues. Soft delete.
```

Run: `cd frontend && npx eslint src/features && npx vitest run 2>&1 | tail -3` → Expected: clean; pass.

Visual check on the UX copy: New customer — typing "Veerbhadreshwar Tex" shows the warning listing Sri Veerbhadreshwar and Veerbhadreshwar Garments with dues; a 10-digit mobile shows the tick; "More details" opens; a bad GSTIN shows the message under the field once (no toast); Save lands on the new customer's page. Edit keeps city and GSTIN.

```bash
git add frontend/src/features/customers/customerForm.js frontend/src/features/customers/customerForm.test.js frontend/src/features/customers/SimilarWarning.jsx frontend/src/features/customers/CustomerFormPage.jsx frontend/src/features/customers/QuickCustomerSheet.jsx frontend/src/features/customers/CustomerPicker.jsx frontend/src/App.jsx backend/knowledge/customers.md
git commit -m "feat(customers): new/edit customer form with similar-name check, quick-create and picker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: The order form — three steps with Back

**Files:**
- Create: `frontend/src/utils/steps.js`, `frontend/src/utils/steps.test.js`
- Create: `frontend/src/ui/useSteps.js`, `frontend/src/ui/ReviewBlock.jsx`
- Create: `frontend/src/features/orders/form/draft.js`, `draft.test.js`, `OrderFormPage.jsx`, `CustomerStep.jsx`, `ItemsStep.jsx`, `LineCard.jsx`, `SizePicker.jsx`, `ExtrasStep.jsx`
- Modify: `frontend/src/features/orders/api.js` (+ `useSizes`, `usePlates`, `useSaveOrder`)
- Modify: `frontend/src/App.jsx`, `backend/knowledge/orders.md`

**Interfaces:**
- Consumes: `orderFormLines` helpers (existing), `parseNumber` (Task 9), `CustomerPicker` (Task 16), `useCustomerSummary` (Task 15), `useOrder` (Task 14).
- Produces:
  - `firstInvalid(count, errorsFor) → index | -1` (utils/steps.js)
  - `useSteps({ count, errorsFor, start }) → { step, reached, shownFor(i), next(), back(), go(i), validateAll() }`
  - `<ReviewBlock title onEdit>{children}</ReviewBlock>`
  - draft.js: `STEPS`, `newLine()`, `newDraft(customer?)`, `draftFromOrder(order)`, `lineErrors(line)`, `stepErrors(draft, step)`, `numericLine(line)`, `linePreview(line, size) → { amount, kg }`, `draftTotals(draft, sizes, plates) → { products, plateCharge, roundOff, total }`, `toPayload(draft, { isEdit })`
  - `useSizes()`, `usePlates()`, `useSaveOrder(id?)`

- [ ] **Step 1: Failing tests**

`frontend/src/utils/steps.test.js`:

```js
import { describe, expect, test } from "vitest";
import { firstInvalid } from "./steps";

describe("firstInvalid", () => {
  test("the first step with errors, or -1", () => {
    const errs = [{}, { lines: [] }, { plate: "x" }];
    expect(firstInvalid(3, (i) => errs[i])).toBe(1);
    expect(firstInvalid(3, () => ({}))).toBe(-1);
  });
});
```

`frontend/src/features/orders/form/draft.test.js`:

```js
import { describe, expect, test } from "vitest";
import { newDraft, newLine, draftFromOrder, lineErrors, stepErrors, linePreview, draftTotals, toPayload } from "./draft";

const SIZES = [
  { id: "s1", size_label: "14x18", rate_per_kg: "180.00", piece_price_amount: null, piece_price_count: null, weight_kg: null, weight_pieces_count: null },
  { id: "s2", size_label: "16x20", rate_per_kg: null, piece_price_amount: "375.0000", piece_price_count: 1000, weight_kg: "100.000", weight_pieces_count: 10000 },
];
const PLATES = [{ id: "p1", type_name: "2 colour", charge: "500.00" }];
const kg = (o) => ({ ...newLine(), product_size_id: "s1", unit: "KG", quantity_kg: "12.25", rate_per_kg: "180", ...o });
const pcs = (o) => ({ ...newLine(), product_size_id: "s2", unit: "PIECES", quantity_pieces: "10,000", price_amount: "375", price_pieces_count: "1000", weight_kg: "", weight_pieces_count: "", ...o });

describe("lines", () => {
  test("kg: up to 2 decimals; quantity and rate required", () => {
    expect(lineErrors(kg())).toEqual({});
    expect(lineErrors(kg({ quantity_kg: "12.255" }))).toEqual({ quantity: "Use at most 2 decimals" });
    expect(lineErrors(kg({ quantity_kg: "", rate_per_kg: "" }))).toEqual({ quantity: "Enter the kg", rate: "Enter the rate per kg" });
    expect(lineErrors({ ...newLine() })).toMatchObject({ size: "Choose a size" });
  });
  test("pieces: whole quantity, a full price, weight both-or-neither", () => {
    expect(lineErrors(pcs())).toEqual({});
    expect(lineErrors(pcs({ quantity_pieces: "10.5" }))).toEqual({ quantity: "Whole numbers only" });
    expect(lineErrors(pcs({ price_amount: "" }))).toEqual({ price: "Enter the price, like 1000 pcs cost ₹375" });
    expect(lineErrors(pcs({ weight_kg: "100" }))).toEqual({ weight: "Enter both the pieces and their weight in kg, or clear both" });
  });
  test("preview uses the typed numbers (commas allowed) and never crashes on bad text", () => {
    expect(linePreview(kg(), SIZES[0])).toEqual({ amount: 2205, kg: 12.25 });
    expect(linePreview(pcs({ weight_kg: "100", weight_pieces_count: "10000" }), SIZES[1])).toEqual({ amount: 3750, kg: 100 });
    expect(linePreview(pcs({ price_amount: "abc" }), SIZES[1])).toEqual({ amount: null, kg: null });
  });
});

describe("steps and totals", () => {
  test("each step's required fields", () => {
    const d = newDraft();
    expect(stepErrors(d, 0)).toEqual({ customer: "Choose a customer" });
    expect(Object.keys(stepErrors(d, 1))).toEqual(["lines"]);
    expect(stepErrors(d, 2)).toEqual({ plate: "Choose a plate type" });
    expect(stepErrors({ ...d, plateTypeId: "p1", roundOff: "-5", customPlateCharge: "0" }, 2)).toEqual({ customPlateCharge: "Must be more than 0" });
  });
  test("total = lines + plate (custom or default) − round off", () => {
    const d = { ...newDraft(), lines: [kg()], plateTypeId: "p1", roundOff: "5" };
    expect(draftTotals(d, SIZES, PLATES)).toEqual({ products: 2205, plateCharge: 500, roundOff: 5, total: 2700 });
    expect(draftTotals({ ...d, customPlateCharge: "1,000" }, SIZES, PLATES).plateCharge).toBe(1000);
  });
});

describe("payload", () => {
  const d = { ...newDraft({ id: "c1", name: "Laxmi" }), orderDate: "2026-09-30", lines: [kg(), pcs()], plateTypeId: "p1", advance: "500" };
  test("new order: numbers, the picked date string, advance included", () => {
    expect(toPayload(d, { isEdit: false })).toEqual({
      customer_id: "c1", order_date: "2026-09-30", plate_type_id: "p1", status: "PENDING", custom_plate_charge: null, round_off_amount: 0,
      product_sizes: [
        { product_size_id: "s1", unit: "KG", quantity_kg: 12.25, rate_per_kg: 180 },
        { product_size_id: "s2", unit: "PIECES", quantity_pieces: 10000, price_amount: 375, price_pieces_count: 1000 },
      ],
      advance_received: 500,
    });
  });
  test("editing never sends the advance", () => {
    expect(toPayload(d, { isEdit: true })).not.toHaveProperty("advance_received");
  });
  test("a saved order becomes a draft", () => {
    const order = {
      customer_id: "c1", customer: { name: "Laxmi", metadata: { phone: "9876543210" } }, order_date: "2026-09-10", plate_type_id: "p1",
      custom_plate_charge: null, round_off_amount: "0.00", status: "DELIVERED",
      orderProductSizes: [{ id: "l1", product_size_id: "s1", unit: "KG", quantity_kg: "12.25", rate_per_kg: "180.00", productSize: SIZES[0] }],
    };
    const draft = draftFromOrder(order);
    expect(draft).toMatchObject({ customer: { id: "c1", name: "Laxmi", phone: "9876543210" }, orderDate: "2026-09-10", plateTypeId: "p1", customPlateCharge: "", roundOff: "", status: "DELIVERED" });
    expect(draft.lines[0]).toMatchObject({ key: "l1", unit: "KG", quantity_kg: "12.25", rate_per_kg: "180" });
  });
});
```

Run: `cd frontend && npx vitest run src/utils/steps.test.js src/features/orders` → Expected: FAIL (modules missing).

- [ ] **Step 2: Implement steps helpers and draft.js**

`frontend/src/utils/steps.js`:

```js
/** Index of the first step whose errorsFor(i) has any key, or -1. */
export const firstInvalid = (count, errorsFor) => {
  for (let i = 0; i < count; i += 1) if (Object.keys(errorsFor(i)).length) return i;
  return -1;
};
```

`frontend/src/ui/useSteps.js`:

```js
import { useState } from "react";
import { firstInvalid } from "../utils/steps";

const scrollTop = () => document.querySelector("main")?.scrollTo({ top: 0 });
const focusFirstError = () => requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());

/**
 * Multi-step form state. Errors show for a step only after Next was tried on it.
 * Back never loses anything: the data lives in the page, steps are just views.
 */
export default function useSteps({ count, errorsFor, start = 0 }) {
  const [step, setStep] = useState(start);
  const [reached, setReached] = useState(start);
  const [shown, setShown] = useState({});

  const goTo = (i) => {
    setStep(i);
    setReached((r) => Math.max(r, i));
    scrollTop();
  };
  const next = () => {
    if (Object.keys(errorsFor(step)).length) {
      setShown((s) => ({ ...s, [step]: true }));
      focusFirstError();
      return;
    }
    goTo(Math.min(count - 1, step + 1));
  };
  const validateAll = () => {
    const bad = firstInvalid(count, errorsFor);
    if (bad === -1) return true;
    setShown(Object.fromEntries(Array.from({ length: count }, (_, i) => [i, true])));
    goTo(bad);
    focusFirstError();
    return false;
  };
  return {
    step,
    reached,
    shownFor: (i) => Boolean(shown[i]),
    next,
    back: () => goTo(Math.max(0, step - 1)),
    go: (i) => i <= reached && goTo(i),
    validateAll,
  };
}
```

`frontend/src/ui/ReviewBlock.jsx`:

```jsx
import PropTypes from "prop-types";

/** One section of a review step, with an Edit button that jumps back to it. */
export default function ReviewBlock({ title, onEdit, children }) {
  return (
    <section className="rounded-2xl bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-ink-2">{title}</h3>
        <button type="button" onClick={onEdit} className="rounded-full px-3 py-1 text-sm font-semibold text-brass hover:bg-raised" aria-label={`Edit ${title}`}>Edit</button>
      </div>
      <div className="mt-1 text-sm text-ink">{children}</div>
    </section>
  );
}

ReviewBlock.propTypes = { title: PropTypes.string.isRequired, onEdit: PropTypes.func.isRequired, children: PropTypes.node };
```

`frontend/src/features/orders/form/draft.js`:

```js
import { emptyLine, lineFromOrderItem, previewLine, toPayloadLine } from "../../../utils/orderFormLines";
import { parseNumber } from "../../../utils/numberInput";
import { isISODate, todayIST } from "../../../utils/istDate";

export const STEPS = ["Customer & date", "Items", "Plate & review"];

const text = (v) => (v === null || v === undefined ? "" : String(v));
const decimalText = (v) => (v === null || v === undefined || Number(v) === 0 ? "" : String(parseFloat(v)));
const lineKey = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Math.random()));

/** Form lines hold exactly what was typed (text); numbers are parsed when previewing or saving. */
export const newLine = () => ({ ...emptyLine(), key: lineKey(), quantity_kg: "", rate_per_kg: "" });

export const newDraft = (customer = null) => ({
  customer, orderDate: todayIST(), lines: [newLine()], plateTypeId: "", customPlateCharge: "", roundOff: "", advance: "", status: "PENDING",
});

export const draftFromOrder = (order) => ({
  customer: { id: order.customer_id, name: order.customer?.name || "Unknown customer", phone: order.customer?.metadata?.phone || null },
  orderDate: order.order_date,
  lines: (order.orderProductSizes || []).map((item) => {
    const l = lineFromOrderItem(item);
    return {
      ...l, key: item.id,
      quantity_kg: text(l.quantity_kg), rate_per_kg: text(l.rate_per_kg), quantity_pieces: text(l.quantity_pieces),
      price_amount: text(l.price_amount), price_pieces_count: text(l.price_pieces_count),
      weight_kg: text(l.weight_kg), weight_pieces_count: text(l.weight_pieces_count),
    };
  }),
  plateTypeId: order.plate_type_id,
  customPlateCharge: decimalText(order.custom_plate_charge),
  roundOff: decimalText(order.round_off_amount),
  advance: "",
  status: order.status,
});

const num = (t, opts) => parseNumber(t, opts).value;
const missing = (r, message) => r.error || (r.value === null ? message : null);

export const lineErrors = (line) => {
  const e = {};
  if (!line.product_size_id) e.size = "Choose a size";
  if (line.unit === "PIECES") {
    const q = missing(parseNumber(line.quantity_pieces, { whole: true }), "Enter the number of pieces");
    if (q) e.quantity = q;
    if (num(line.price_pieces_count, { whole: true }) === null || num(line.price_amount, { dp: 4 }) === null) e.price = "Enter the price, like 1000 pcs cost ₹375";
    if (text(line.weight_kg) !== "" || text(line.weight_pieces_count) !== "") {
      if (num(line.weight_pieces_count, { whole: true }) === null || num(line.weight_kg, { dp: 3 }) === null) e.weight = "Enter both the pieces and their weight in kg, or clear both";
    }
  } else {
    const q = missing(parseNumber(line.quantity_kg), "Enter the kg");
    if (q) e.quantity = q;
    const r = missing(parseNumber(line.rate_per_kg), "Enter the rate per kg");
    if (r) e.rate = r;
  }
  return e;
};

export const stepErrors = (draft, step) => {
  if (step === 0) {
    const e = {};
    if (!draft.customer) e.customer = "Choose a customer";
    if (!isISODate(draft.orderDate)) e.orderDate = "Choose the order date";
    return e;
  }
  if (step === 1) {
    const lines = draft.lines.map(lineErrors);
    return lines.some((l) => Object.keys(l).length) ? { lines } : {};
  }
  const e = {};
  if (!draft.plateTypeId) e.plate = "Choose a plate type";
  const custom = parseNumber(draft.customPlateCharge);
  if (custom.error) e.customPlateCharge = custom.error;
  const roundOff = parseNumber(draft.roundOff, { signed: true, allowZero: true });
  if (roundOff.error) e.roundOff = roundOff.error;
  const advance = parseNumber(draft.advance, { allowZero: true });
  if (advance.error) e.advance = advance.error;
  return e;
};

/** Typed text → the numbers orderMath and the API expect. Weight is "" when not given. */
export const numericLine = (line) =>
  line.unit === "PIECES"
    ? {
        ...line,
        quantity_pieces: num(line.quantity_pieces, { whole: true }),
        price_amount: num(line.price_amount, { dp: 4 }),
        price_pieces_count: num(line.price_pieces_count, { whole: true }),
        weight_kg: num(line.weight_kg, { dp: 3 }) ?? "",
        weight_pieces_count: num(line.weight_pieces_count, { whole: true }) ?? "",
      }
    : { ...line, quantity_kg: num(line.quantity_kg), rate_per_kg: num(line.rate_per_kg) };

/** Live amount + kg for one line; null while it is incomplete or has a typo. */
export const linePreview = (line, size) => {
  const e = lineErrors(line);
  if (e.size || e.quantity || e.price || e.rate) return { amount: null, kg: null };
  const numeric = numericLine(e.weight ? { ...line, weight_kg: "", weight_pieces_count: "" } : line);
  return previewLine(numeric, size);
};

export const draftTotals = (draft, sizes, plates) => {
  const products = draft.lines.reduce((sum, line) => {
    const { amount } = linePreview(line, sizes.find((s) => s.id === line.product_size_id));
    return amount === null ? sum : sum + amount;
  }, 0);
  const plate = plates.find((p) => p.id === draft.plateTypeId);
  const plateCharge = num(draft.customPlateCharge) ?? (plate ? parseFloat(plate.charge) : 0);
  const roundOff = num(draft.roundOff, { signed: true, allowZero: true }) ?? 0;
  return { products, plateCharge, roundOff, total: products + plateCharge - roundOff };
};

export const toPayload = (draft, { isEdit }) => ({
  customer_id: draft.customer.id,
  order_date: draft.orderDate,
  plate_type_id: draft.plateTypeId,
  status: draft.status,
  custom_plate_charge: num(draft.customPlateCharge), // null → the plate type's charge
  round_off_amount: num(draft.roundOff, { signed: true, allowZero: true }) ?? 0,
  product_sizes: draft.lines.map((line) => toPayloadLine(numericLine(line))),
  // The advance is only ever set when the order is created.
  ...(isEdit ? {} : { advance_received: num(draft.advance, { allowZero: true }) ?? 0 }),
});
```

Run: `cd frontend && npx vitest run src/utils/steps.test.js src/features/orders` → Expected: PASS.

- [ ] **Step 3: Catalog + save hooks**

Append to `frontend/src/features/orders/api.js` (add `productSizeAPI, plateTypeAPI` to the services import):

```js
/** Sizes and plate types change rarely: cached for 5 minutes. */
export const useSizes = () => useQuery({ queryKey: keys.catalog.sizes, queryFn: () => productSizeAPI.getAll().then(body), staleTime: 5 * 60_000 });
export const usePlates = () => useQuery({ queryKey: keys.catalog.plates, queryFn: () => plateTypeAPI.getAll().then(body), staleTime: 5 * 60_000 });

export const useSaveOrder = (id) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload) => (id ? orderAPI.update(id, payload) : orderAPI.create(payload)).then(body), onSuccess: () => invalidateMoney(qc) });
};
```

- [ ] **Step 4: The step components**

`frontend/src/features/orders/form/SizePicker.jsx`:

```jsx
import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import SearchPicker from "../../../ui/SearchPicker";
import { formatSizePricing } from "../../../utils/formatters";

export default function SizePicker({ open, sizes, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const items = useMemo(() => sizes.filter((s) => s.size_label.toLowerCase().includes(q)), [sizes, q]);
  return (
    <SearchPicker open={open} title="Choose size" query={query} onQuery={setQuery} placeholder="Search sizes" items={items} getKey={(s) => s.id}
      renderItem={(s) => (
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">{s.size_label}</span>
          <span className="block text-xs text-ink-2">{formatSizePricing(s)}</span>
        </span>
      )}
      onPick={(s) => { onPick(s); setQuery(""); }} onClose={onClose}
      empty={q ? `No size matches “${query.trim()}”` : "No sizes yet — add them under Sizes"} />
  );
}

SizePicker.propTypes = { open: PropTypes.bool.isRequired, sizes: PropTypes.array.isRequired, onPick: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired };
```

`frontend/src/features/orders/form/LineCard.jsx`:

```jsx
import { useState } from "react";
import PropTypes from "prop-types";
import { Trash2, ChevronDown } from "lucide-react";
import Field from "../../../ui/Field";
import NumberInput from "../../../ui/NumberInput";
import IconButton from "../../../ui/IconButton";
import Button from "../../../ui/Button";
import { Money } from "../../../ui/Money";
import { INPUT, INPUT_INVALID } from "../../../ui/styles";
import SizePicker from "./SizePicker";
import { linePreview } from "./draft";
import { availableUnits, applySizeSelection, applySizeWeight } from "../../../utils/orderFormLines";
import { formatSizePricing, formatKg, formatCurrency, perPiecePriceHint, perPieceWeightHint } from "../../../utils/formatters";
import { parseNumber } from "../../../utils/numberInput";
import { errorText } from "../../../lib/errors";

function Pair({ legend, error, hint, children }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-[0.8rem] font-semibold text-ink-2">{legend}</legend>
      <div className="flex items-center gap-2">{children}</div>
      {error ? <p role="alert" className="text-xs font-medium text-status-critical">{error}</p> : hint ? <p className="text-xs text-ink-2">{hint}</p> : null}
    </fieldset>
  );
}

Pair.propTypes = { legend: PropTypes.node.isRequired, error: PropTypes.string, hint: PropTypes.node, children: PropTypes.node };

export default function LineCard({ line, index, sizes, errors, onChange, onRemove, canRemove, onSaveSizeWeight }) {
  const [picking, setPicking] = useState(false);
  const [weightDraft, setWeightDraft] = useState(null); // { count, kg, saving, error } while setting a size weight
  const size = sizes.find((s) => s.id === line.product_size_id);
  const units = availableUnits(size);
  const { amount, kg } = linePreview(line, size);
  const set = (patch) => onChange({ ...line, ...patch });
  const n = index + 1;
  const sizeHasWeight = Boolean(size) && size.weight_kg !== null && size.weight_kg !== undefined;
  const lineHasWeight = String(line.weight_kg ?? "") !== "";
  const price = { amount: parseNumber(line.price_amount, { dp: 4 }).value, count: parseNumber(line.price_pieces_count, { whole: true }).value };
  const weight = { kg: parseNumber(line.weight_kg, { dp: 3 }).value, count: parseNumber(line.weight_pieces_count, { whole: true }).value };

  const saveWeight = async () => {
    const count = parseNumber(weightDraft.count, { whole: true }).value;
    const w = parseNumber(weightDraft.kg, { dp: 3 }).value;
    if (count === null || w === null) {
      setWeightDraft((d) => ({ ...d, error: "Enter both: how many pieces and their weight in kg" }));
      return;
    }
    setWeightDraft((d) => ({ ...d, saving: true, error: "" }));
    try {
      const updated = await onSaveSizeWeight(size, { weight_pieces_count: count, weight_kg: w });
      onChange(applySizeWeight(line, updated));
      setWeightDraft(null);
    } catch (err) {
      setWeightDraft((d) => ({ ...d, saving: false, error: errorText(err, "Couldn't save the weight") }));
    }
  };

  return (
    <div className="space-y-4 rounded-3xl bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-2">Size {n}</p>
        {canRemove && <IconButton label={`Remove size ${n}`} onClick={onRemove} className="h-9 w-9 bg-transparent text-ink-2"><Trash2 className="h-4 w-4" /></IconButton>}
      </div>

      <Field label="Size" htmlFor={`line-${n}-size`} error={errors.size}>
        <button type="button" onClick={() => setPicking(true)} className={`${INPUT} flex items-center justify-between gap-2 text-left ${errors.size ? INPUT_INVALID : ""}`}>
          {size ? <span className="truncate font-semibold">{size.size_label}</span> : <span className="text-ink-2">Choose a size</span>}
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
        </button>
      </Field>
      {size && <p className="-mt-2 text-xs text-ink-2">{formatSizePricing(size)}</p>}

      <div role="radiogroup" aria-label={`Sold by — size ${n}`} className="inline-flex rounded-2xl bg-raised p-1">
        {[["KG", "Kg"], ["PIECES", "Pcs"]].map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={line.unit === value} disabled={!units.includes(value)} onClick={() => set({ unit: value })}
            className={`h-9 rounded-xl px-5 text-sm font-semibold disabled:opacity-40 ${line.unit === value ? "bg-brass text-brass-on" : "text-ink-2"}`}>
            {label}
          </button>
        ))}
      </div>

      {line.unit === "PIECES" ? (
        <>
          <Field label="Quantity" htmlFor={`line-${n}-pcs`} error={errors.quantity}>
            <NumberInput whole value={line.quantity_pieces} onChange={(v) => set({ quantity_pieces: v })} suffix="pcs" />
          </Field>
          <Pair legend="Price" error={errors.price} hint={price.amount && price.count ? perPiecePriceHint(price.amount, price.count) : undefined}>
            <div className="w-28 shrink-0"><NumberInput whole aria-label="Number of pieces priced" value={line.price_pieces_count} onChange={(v) => set({ price_pieces_count: v })} /></div>
            <span className="shrink-0 text-sm text-ink-2">pcs cost</span>
            <div className="min-w-0 flex-1"><NumberInput aria-label="Price for those pieces" prefix="₹" value={line.price_amount} onChange={(v) => set({ price_amount: v })} /></div>
          </Pair>
          <Pair legend={<>Weight <span className="font-normal">(optional)</span></>} error={errors.weight}
            hint={weight.kg && weight.count ? `${perPieceWeightHint(weight.kg, weight.count)}${line.weight_source === "MANUAL" ? " · measured for this order" : ""}` : undefined}>
            <div className="w-28 shrink-0"><NumberInput whole aria-label="Number of pieces weighed" value={line.weight_pieces_count} onChange={(v) => set({ weight_pieces_count: v, weight_source: "MANUAL" })} /></div>
            <span className="shrink-0 text-sm text-ink-2">pcs weigh</span>
            <div className="min-w-0 flex-1"><NumberInput aria-label="Weight in kg" suffix="kg" value={line.weight_kg} onChange={(v) => set({ weight_kg: v, weight_source: "MANUAL" })} /></div>
          </Pair>
          {size && !sizeHasWeight && !lineHasWeight && (
            <div className="space-y-2 rounded-2xl border border-status-warn/35 bg-status-warn/10 p-3 text-sm text-status-warn">
              <p>Weight not set for {size.size_label}, so this line&apos;s kg can&apos;t be worked out. Add it for the size, type a measured weight above, or skip.</p>
              {!weightDraft ? (
                <Button size="sm" variant="secondary" onClick={() => setWeightDraft({ count: "", kg: "", saving: false, error: "" })}>Set weight for {size.size_label}</Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-28 shrink-0"><NumberInput whole aria-label="Pieces" placeholder="10000" value={weightDraft.count} onChange={(v) => setWeightDraft((d) => ({ ...d, count: v }))} /></div>
                    <span className="shrink-0 text-ink-2">pcs weigh</span>
                    <div className="min-w-0 flex-1"><NumberInput aria-label="Kg" suffix="kg" placeholder="100" value={weightDraft.kg} onChange={(v) => setWeightDraft((d) => ({ ...d, kg: v }))} /></div>
                  </div>
                  {weightDraft.error && <p role="alert" className="text-xs text-status-critical">{weightDraft.error}</p>}
                  <Button size="sm" loading={weightDraft.saving} onClick={saveWeight}>Save to size</Button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" htmlFor={`line-${n}-kg`} error={errors.quantity}>
            <NumberInput value={line.quantity_kg} onChange={(v) => set({ quantity_kg: v })} suffix="kg" />
          </Field>
          <Field label="Rate per kg" htmlFor={`line-${n}-rate`} error={errors.rate} hint={size?.rate_per_kg ? `Size rate ${formatCurrency(size.rate_per_kg)}` : undefined}>
            <NumberInput value={line.rate_per_kg} onChange={(v) => set({ rate_per_kg: v })} prefix="₹" />
          </Field>
        </div>
      )}

      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="text-sm text-ink-2">
          Amount
          {line.unit === "PIECES" && amount !== null && <span className="ml-2 text-xs">{kg === null ? "kg: weight not set" : `≈ ${formatKg(kg)}`}</span>}
        </span>
        {amount === null ? <span className="text-sm text-ink-2">—</span> : <Money value={amount} className="font-semibold" />}
      </div>

      <SizePicker open={picking} sizes={sizes} onClose={() => setPicking(false)} onPick={(s) => { onChange(applySizeSelection(line, s)); setPicking(false); }} />
    </div>
  );
}

LineCard.propTypes = {
  line: PropTypes.object.isRequired, index: PropTypes.number.isRequired, sizes: PropTypes.array.isRequired, errors: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired, onRemove: PropTypes.func.isRequired, canRemove: PropTypes.bool.isRequired, onSaveSizeWeight: PropTypes.func.isRequired,
};
```

`frontend/src/features/orders/form/CustomerStep.jsx`:

```jsx
import { useState } from "react";
import PropTypes from "prop-types";
import { Search } from "lucide-react";
import Field from "../../../ui/Field";
import DateField from "../../../ui/DateField";
import { INPUT, INPUT_INVALID } from "../../../ui/styles";
import CustomerPicker from "../../customers/CustomerPicker";
import { inr } from "../../../utils/dashboardFormat";

export default function CustomerStep({ draft, update, errors }) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="space-y-5">
      <Field label="Customer" htmlFor="order-customer" error={errors.customer}>
        <button type="button" onClick={() => setPicking(true)} className={`${INPUT} flex items-center justify-between gap-2 text-left ${errors.customer ? INPUT_INVALID : ""}`}>
          {draft.customer ? <span className="truncate font-semibold">{draft.customer.name}</span> : <span className="text-ink-2">Choose a customer</span>}
          <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
        </button>
      </Field>
      {draft.customer?.due > 0 && <p className="-mt-3 text-xs text-status-critical">Already owes {inr(draft.customer.due)}</p>}
      <Field label="Order date" htmlFor="order-date" error={errors.orderDate}>
        <DateField value={draft.orderDate} onChange={(orderDate) => update({ orderDate })} />
      </Field>
      <CustomerPicker open={picking} onClose={() => setPicking(false)} onPick={(customer) => { update({ customer }); setPicking(false); }} />
    </div>
  );
}

CustomerStep.propTypes = { draft: PropTypes.object.isRequired, update: PropTypes.func.isRequired, errors: PropTypes.object.isRequired };
```

`frontend/src/features/orders/form/ItemsStep.jsx`:

```jsx
import PropTypes from "prop-types";
import Button from "../../../ui/Button";
import LineCard from "./LineCard";
import { newLine } from "./draft";

export default function ItemsStep({ draft, update, sizes, errors, onSaveSizeWeight }) {
  const setLine = (i, next) => update((d) => ({ lines: d.lines.map((l, j) => (j === i ? next : l)) }));
  const removeLine = (i) => update((d) => ({ lines: d.lines.filter((_, j) => j !== i) }));
  return (
    <div className="space-y-3">
      {draft.lines.map((line, i) => (
        <LineCard key={line.key} line={line} index={i} sizes={sizes} errors={errors.lines?.[i] || {}}
          onChange={(next) => setLine(i, next)} onRemove={() => removeLine(i)} canRemove={draft.lines.length > 1} onSaveSizeWeight={onSaveSizeWeight} />
      ))}
      <Button variant="secondary" block onClick={() => update((d) => ({ lines: [...d.lines, newLine()] }))}>＋ Add another size</Button>
    </div>
  );
}

ItemsStep.propTypes = { draft: PropTypes.object.isRequired, update: PropTypes.func.isRequired, sizes: PropTypes.array.isRequired, errors: PropTypes.object.isRequired, onSaveSizeWeight: PropTypes.func.isRequired };
```

`frontend/src/features/orders/form/ExtrasStep.jsx`:

```jsx
import { useState } from "react";
import PropTypes from "prop-types";
import { ChevronDown } from "lucide-react";
import Field from "../../../ui/Field";
import NumberInput from "../../../ui/NumberInput";
import Chips from "../../../ui/Chips";
import ReviewBlock from "../../../ui/ReviewBlock";
import { Money } from "../../../ui/Money";
import { linePreview } from "./draft";
import { ORDER_FLOW, ORDER_STATUS } from "../../../utils/statusMeta";
import { inr, shortDate } from "../../../utils/dashboardFormat";
import { qtyText } from "../../../utils/itemsText";
import { parseNumber } from "../../../utils/numberInput";

const STATUS_OPTIONS = ORDER_FLOW.map((s) => ({ value: s, label: ORDER_STATUS[s].label }));

export default function ExtrasStep({ draft, update, plates, sizes, errors, isEdit, totals, onGo }) {
  const plate = plates.find((p) => p.id === draft.plateTypeId);
  const hasExtras = Boolean(draft.customPlateCharge || draft.roundOff || draft.advance || errors.customPlateCharge || errors.roundOff || errors.advance);
  const [moreOpen, setMoreOpen] = useState(hasExtras);
  const more = moreOpen || hasExtras;

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-[0.8rem] font-semibold text-ink-2">Plate type</legend>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
          {plates.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={p.id === draft.plateTypeId} onClick={() => update({ plateTypeId: p.id })}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${p.id === draft.plateTypeId ? "border-brass bg-brass/10 text-ink" : "border-line bg-surface text-ink-2"}`}>
              <span className="font-semibold">{p.type_name}</span>
              <Money value={Number(p.charge)} />
            </button>
          ))}
        </div>
        {errors.plate && <p role="alert" className="mt-1.5 text-xs font-medium text-status-critical">{errors.plate}</p>}
      </fieldset>

      {more ? (
        <div className="space-y-4 rounded-3xl bg-surface p-4">
          <Field label="Custom plate charge" htmlFor="order-custom-plate" optional error={errors.customPlateCharge}
            hint={`Leave empty to use ${plate ? `${plate.type_name}'s ${inr(plate.charge)}` : "the plate type's charge"}`}>
            <NumberInput prefix="₹" value={draft.customPlateCharge} onChange={(v) => update({ customPlateCharge: v })} />
          </Field>
          <Field label="Round off" htmlFor="order-round-off" optional error={errors.roundOff} hint="Taken off the total — e.g. 5 turns ₹10,005 into ₹10,000">
            <NumberInput signed prefix="₹" value={draft.roundOff} onChange={(v) => update({ roundOff: v })} />
          </Field>
          {isEdit ? (
            <p className="text-xs text-ink-2">To add or correct an advance, record it as a payment on the order page.</p>
          ) : (
            <Field label="Advance received" htmlFor="order-advance" optional error={errors.advance} hint="Saved as an advance payment on the order date">
              <NumberInput prefix="₹" value={draft.advance} onChange={(v) => update({ advance: v })} />
            </Field>
          )}
          <div>
            <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">Status</p>
            <Chips label="Order status" options={STATUS_OPTIONS} value={ORDER_FLOW.includes(draft.status) ? draft.status : ""} onChange={(status) => update({ status })} />
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setMoreOpen(true)} className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 text-sm text-ink-2">
          <span>More options · custom plate charge, round off, advance, status</span>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">Review</h2>
        <ReviewBlock title="Customer & date" onEdit={() => onGo(0)}>
          <p className="font-semibold">{draft.customer?.name || "—"}</p>
          <p className="text-ink-2">{draft.orderDate ? shortDate(draft.orderDate) : "—"}</p>
        </ReviewBlock>
        <ReviewBlock title="Items" onEdit={() => onGo(1)}>
          <ul className="space-y-1">
            {draft.lines.map((line) => {
              const size = sizes.find((s) => s.id === line.product_size_id);
              const { amount } = linePreview(line, size);
              const quantity = line.unit === "PIECES" ? parseNumber(line.quantity_pieces, { whole: true }).value : parseNumber(line.quantity_kg).value;
              return (
                <li key={line.key} className="flex justify-between gap-3">
                  <span className="truncate">{size?.size_label || "—"}{quantity !== null ? ` · ${qtyText({ unit: line.unit, quantity })}` : ""}</span>
                  {amount === null ? <span className="text-ink-2">—</span> : <Money value={amount} />}
                </li>
              );
            })}
          </ul>
        </ReviewBlock>
        <dl className="space-y-1 rounded-2xl bg-surface px-4 py-3 text-sm">
          <div className="flex justify-between text-ink-2"><dt>Items</dt><dd><Money value={totals.products} /></dd></div>
          <div className="flex justify-between text-ink-2"><dt>Plate</dt><dd><Money value={totals.plateCharge} /></dd></div>
          {totals.roundOff !== 0 && <div className="flex justify-between text-ink-2"><dt>Round off</dt><dd className="font-num tabular-nums">{totals.roundOff > 0 ? "−" : "+"}{inr(Math.abs(totals.roundOff))}</dd></div>}
          <div className="flex justify-between border-t border-line pt-2 font-semibold text-ink"><dt>Total</dt><dd><Money value={totals.total} /></dd></div>
        </dl>
      </div>
    </div>
  );
}

ExtrasStep.propTypes = {
  draft: PropTypes.object.isRequired, update: PropTypes.func.isRequired, plates: PropTypes.array.isRequired, sizes: PropTypes.array.isRequired,
  errors: PropTypes.object.isRequired, isEdit: PropTypes.bool.isRequired, totals: PropTypes.object.isRequired, onGo: PropTypes.func.isRequired,
};
```

- [ ] **Step 5: The page**

`frontend/src/features/orders/form/OrderFormPage.jsx`:

```jsx
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useOrder, useSizes, usePlates, useSaveOrder } from "../api";
import { useCustomerSummary } from "../../customers/api";
import CustomerStep from "./CustomerStep";
import ItemsStep from "./ItemsStep";
import ExtrasStep from "./ExtrasStep";
import { STEPS, newDraft, draftFromOrder, stepErrors, draftTotals, toPayload } from "./draft";
import Stepper from "../../../ui/Stepper";
import StickyFooter from "../../../ui/StickyFooter";
import Button from "../../../ui/Button";
import ConfirmDialog from "../../../ui/ConfirmDialog";
import { Money } from "../../../ui/Money";
import { EmptyState, ErrorState, PageSkeleton } from "../../../ui/States";
import { buttonClass } from "../../../ui/styles";
import useSteps from "../../../ui/useSteps";
import { keys } from "../../../lib/queryKeys";
import { errorText } from "../../../lib/errors";
import { productSizeAPI } from "../../../services/api";
import { backfillMessage } from "../../../utils/formatters";
import { useToast } from "../../../context/ToastContext";

export default function OrderFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [search] = useSearchParams();
  const presetId = isEdit ? null : search.get("customer");
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const orderQ = useOrder(id);
  const presetQ = useCustomerSummary(presetId);
  const sizesQ = useSizes();
  const platesQ = usePlates();
  const save = useSaveOrder(id);

  // An edited order may use a size or plate that has since been archived: keep it selectable here.
  const sizes = useMemo(() => {
    const list = sizesQ.data || [];
    const own = (orderQ.data?.orderProductSizes || []).map((l) => l.productSize).filter((s) => s && !list.some((x) => x.id === s.id));
    return [...list, ...own.map((s) => ({ ...s, size_label: `${s.size_label} (archived)` }))];
  }, [sizesQ.data, orderQ.data]);
  const plates = useMemo(() => {
    const list = platesQ.data || [];
    const own = orderQ.data?.plateType;
    return own && !list.some((p) => p.id === own.id) ? [...list, { ...own, type_name: `${own.type_name} (archived)` }] : list;
  }, [platesQ.data, orderQ.data]);

  const initial = useMemo(() => {
    if (isEdit) return orderQ.data ? draftFromOrder(orderQ.data) : null;
    if (!presetId) return newDraft();
    if (presetQ.data) {
      const c = presetQ.data.customer;
      return newDraft({ id: c.id, name: c.name, phone: c.phone, due: presetQ.data.owes });
    }
    return presetQ.isError ? newDraft() : null;
  }, [isEdit, orderQ.data, presetId, presetQ.data, presetQ.isError]);
  const [edited, setEdited] = useState(null);
  const draft = edited ?? initial;
  const update = (patch) => setEdited((prev) => {
    const base = prev ?? initial;
    return { ...base, ...(typeof patch === "function" ? patch(base) : patch) };
  });

  const steps = useSteps({ count: STEPS.length, errorsFor: (i) => (draft ? stepErrors(draft, i) : {}), start: isEdit ? 2 : 0 });
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (!draft || sizesQ.isPending || platesQ.isPending) {
    if (orderQ.isError) {
      return (
        <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
          {orderQ.error?.response?.status === 404
            ? <EmptyState title="This order doesn't exist" action={<Link to="/orders" className={buttonClass({ variant: "secondary" })}>All orders</Link>} />
            : <ErrorState title="Couldn't load this order." onRetry={() => orderQ.refetch()} />}
        </div>
      );
    }
    if (sizesQ.isError || platesQ.isError) return <div className="mx-auto max-w-xl px-4 py-6"><ErrorState title="Couldn't load sizes and plate types." onRetry={() => { sizesQ.refetch(); platesQ.refetch(); }} /></div>;
    return <PageSkeleton />;
  }

  const totals = draftTotals(draft, sizes, plates);
  const errors = steps.shownFor(steps.step) ? stepErrors(draft, steps.step) : {};
  const leave = () => navigate(isEdit ? `/orders/${id}` : "/orders", { replace: true });
  const back = () => (steps.step === 0 ? (edited ? setConfirmLeave(true) : leave()) : steps.back());

  const saveSizeWeight = async (size, weight) => {
    const res = await productSizeAPI.update(size.id, {
      size_label: size.size_label, rate_per_kg: size.rate_per_kg, piece_price_amount: size.piece_price_amount, piece_price_count: size.piece_price_count, ...weight,
    });
    const updated = res.data.data;
    qc.setQueryData(keys.catalog.sizes, (list) => (list || []).map((s) => (s.id === updated.id ? updated : s)));
    const filled = backfillMessage(updated.backfilled_lines);
    if (filled) toast.success(filled);
    return updated;
  };

  const submit = () => {
    if (!steps.validateAll()) return;
    save.mutate(toPayload(draft, { isEdit }), {
      onSuccess: (order) => {
        toast.success(isEdit ? "Order updated" : "Order saved");
        navigate(`/orders/${isEdit ? id : order.id}`, { replace: true });
      },
    });
  };

  return (
    <div className="mx-auto max-w-xl px-4 pt-3 sm:px-6">
      <Stepper steps={STEPS} current={steps.step} reached={steps.reached} onGo={steps.go} />
      {isEdit && orderQ.data?.invoice_id && (
        <p className="mt-3 rounded-2xl bg-status-warn/10 px-3 py-2 text-sm text-status-warn">
          This order is on invoice #{orderQ.data.invoice?.invoice_number || "—"}. Changes here won&apos;t update the invoice — delete and regenerate the invoice to update it.
        </p>
      )}

      <div className="mt-4">
        {steps.step === 0 && <CustomerStep draft={draft} update={update} errors={errors} />}
        {steps.step === 1 && <ItemsStep draft={draft} update={update} sizes={sizes} errors={errors} onSaveSizeWeight={saveSizeWeight} />}
        {steps.step === 2 && <ExtrasStep draft={draft} update={update} plates={plates} sizes={sizes} errors={errors} isEdit={isEdit} totals={totals} onGo={steps.go} />}
      </div>

      <StickyFooter>
        {save.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(save.error, "Couldn't save the order. Check your connection and try again.")}</p>}
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={back}>Back</Button>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-xs text-ink-2">Total</p>
            <Money value={totals.total} className="text-lg font-bold text-ink" />
          </div>
          {steps.step < STEPS.length - 1
            ? <Button onClick={steps.next}>Next</Button>
            : <Button onClick={submit} loading={save.isPending}>{isEdit ? "Save changes" : "Save order"}</Button>}
        </div>
      </StickyFooter>

      <ConfirmDialog open={confirmLeave} title="Leave without saving?" message="What you entered on this order will be lost." confirmLabel="Leave" cancelLabel="Keep editing"
        onConfirm={leave} onClose={() => setConfirmLeave(false)} />
    </div>
  );
}
```

- [ ] **Step 6: Routes and orders knowledge**

In `frontend/src/App.jsx`: replace the `CreateOrder` and `EditOrder` lazy imports with `const OrderFormPage = lazy(() => import("./features/orders/form/OrderFormPage"));` and routes `<Route path="new" element={<OrderFormPage />} />`, `<Route path="edit/:id" element={<OrderFormPage />} />`.

In `backend/knowledge/orders.md`:
1. Replace the intro paragraph (first paragraph, above "Domain terms:") with:

```md
What it is: bag-manufacturing orders. An order = customer + date + one plate
type + one or more size lines, each sold by **Kg** (kg × rate/kg) or by
**Pcs** (pieces × a price like "1,000 pcs cost ₹375"). Order total = sum of
line amounts + plate charge (custom or default) − round off. An advance can be
recorded when the order is created; every other payment is recorded on the
order page (see payments.md).
```

2. Keep the "Domain terms:" bullets, except change the last bullet to: `- Order **status**: Pending → In progress → Completed → Delivered (or Cancelled). Set in the order form's More options or with the status chips on the order page.`
3. Replace the sections "## Creating an order", "## Viewing / editing an order", "## Exporting orders to Excel" and "## Deleting an order" with:

```md
## Finding an order
1. Open [Orders](/orders). Orders are grouped by day (Today, Yesterday,
   dates), newest first. Each row shows the customer, first size and quantity,
   status, the total, and **Due ₹…** in red or **Paid ✓** in green.
2. Search by customer name or size. Chips: **All · Due · In progress · This
   month**. The line under the chips shows how many orders, their total and
   the due; cancelled orders are listed (struck through) but not counted.
3. **⋯ → Download Excel** exports the orders matching the search (this month
   only when that chip is on).

## Creating an order
Three steps with **Back** on every step (nothing typed is lost) and a progress
bar you can tap to jump back:
1. **Customer & date** — tap to choose the customer (search by name or phone;
   recent customers first; shows what they owe). Not a customer yet? **＋ New
   customer** adds one with just name + mobile and returns here. The **Order
   date** defaults to today (Today / Yesterday shortcuts).
2. **Items** — per size: choose the **Size** (the list shows its prices), then
   **Kg | Pcs** (only units the size has a price for).
   - **Kg**: quantity in kg (up to 2 decimals, e.g. 12.25) and **Rate per kg**
     (pre-filled from the size).
   - **Pcs**: quantity (whole number), **Price** "N pcs cost ₹X" (pre-filled),
     optional **Weight** "N pcs weigh W kg" (pre-filled; typing your own marks
     it as measured). If the size has no weight, a note offers **Set weight
     for <size>** — saving it updates the size and fills earlier pieces lines
     that had none (a message says how many). Skipping is fine.
   Each line shows its amount live (and ≈ kg for pieces). **＋ Add another
   size** adds a line.
3. **Plate & review** — choose the **Plate type** (shows its charge). **More
   options**: custom plate charge (empty = the plate type's charge), round off
   (taken off the total), **Advance received** (saved as an advance payment on
   the order date) and status. The review shows each section with **Edit**.
   The total is always at the bottom. Tap **Save order**.

## The order page
`/orders/:id`: customer, date and status; a money card with **Total**,
**Received**, **Due** and **＋ Record payment**; Call / WhatsApp for the
customer; status chips (Pending → In progress → Completed → Delivered); tabs
**Items** (lines, plate, round off, total), **Payments** (edit/delete each via
⋯) and **Details**. The **⋯** menu: **Edit order**, **Create invoice** (while
not invoiced), **Record advance**, **Record refund**, **Cancel order** (shows
a Restore button afterwards) and **Delete order** (asks first; soft delete).

## Editing an order
**⋯ → Edit order** opens the same three steps, filled in. The advance can't be
changed here — record an advance or refund as a payment instead. If the order
is already on an invoice, a warning says the invoice won't change: delete and
regenerate the invoice to update it.
```

4. Replace the "Rules the UI enforces:" list at the end with:

```md
Rules the UI enforces:
- Customer, order date, plate type and at least one size line are required;
  each line needs its quantity and rate/price. Problems show next to the field
  and Next/Save goes to the first one.
- Changing a size on a line pre-fills its kg rate only if the line has no rate
  yet; a pieces line's price and weight reset to the new size's values. Saved
  orders keep their frozen prices and weights.
- Order create/update/status-change/delete are all written to the audit log
  (visible on [History](/history)).
```

- [ ] **Step 7: Verify and commit**

Run: `cd frontend && npx eslint src/features src/ui src/utils && npx vitest run 2>&1 | tail -3` → Expected: clean; pass.

Visual check on the UX copy (390px, dark then light): New order → Next on an empty step shows "Choose a customer" and focuses the field; choose via search; quick-create a customer from the picker returns with it selected; step 2: 12.25 kg accepted, 12.255 shows "Use at most 2 decimals"; a pieces line on a size without weight → "Set weight for …" saves and fills; Back to step 1 keeps everything; tap the first progress segment to jump; step 3 review Edit buttons jump; the footer total equals the saved order's total on its page; Edit order opens at step 3 with the invoiced warning when invoiced and no advance field; from a customer page, New order starts with that customer.

```bash
git add frontend/src/utils/steps.js frontend/src/utils/steps.test.js frontend/src/ui/useSteps.js frontend/src/ui/ReviewBlock.jsx frontend/src/features/orders/form frontend/src/features/orders/api.js frontend/src/App.jsx backend/knowledge/orders.md
git commit -m "feat(orders): three-step order form with Back, live totals and review

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 18: Invoices list and the invoice page

**Files:**
- Modify: `frontend/src/services/api.js` (`invoiceAPI.list`, `invoiceAPI.fetchPdf`)
- Modify: `frontend/src/utils/whatsappReminder.js` (+ `buildInvoiceReminder`); Create: `frontend/src/utils/whatsappReminder.test.js`
- Create: `frontend/src/features/invoices/api.js`, `sharePdf.js`, `InvoicesPage.jsx`, `InvoiceRow.jsx`, `InvoicePage.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `/api/invoices/list`, `/api/invoices/:id` with `money`, `orderMoney`, `orderPayments` (Task 7); `PaymentSheet` with `orderChoices` and `PaymentList` (Task 14).
- Produces: `useInvoiceList`, `useInvoice`, `useInvoiceStatus`, `useDeleteInvoice`, `useUnbilledOrders`, `useGenerateInvoice`; `sharePdf(invoice) → "shared"|"cancelled"|"downloaded"`; `buildInvoiceReminder({ name, number, invoiceDate, amountDue })`.

- [ ] **Step 1: Reminder text — failing test, then implement**

`frontend/src/utils/whatsappReminder.test.js`:

```js
import { describe, expect, test } from "vitest";
import { buildInvoiceReminder } from "./whatsappReminder";
import { shortDate } from "./dashboardFormat";

describe("buildInvoiceReminder", () => {
  test("names the invoice, its date and the exact balance", () => {
    expect(buildInvoiceReminder({ name: "Festival Bags", number: "00000034", invoiceDate: "2026-09-28", amountDue: 4050 })).toBe(
      ["Namaste Festival Bags, this is a gentle reminder from YARS Industries.",
        `Invoice #00000034 dated ${shortDate("2026-09-28")} — balance due: ₹4,050`,
        "Kindly arrange the payment at your convenience. Thank you!"].join("\n")
    );
  });
});
```

Run: `cd frontend && npx vitest run src/utils/whatsappReminder.test.js` → Expected: FAIL.

Append to `frontend/src/utils/whatsappReminder.js`:

```js
export const buildInvoiceReminder = ({ name, number, invoiceDate, amountDue }) =>
  [
    `Namaste ${name}, this is a gentle reminder from YARS Industries.`,
    `Invoice #${number} dated ${shortDate(invoiceDate)} — balance due: ${inr(amountDue)}`,
    "Kindly arrange the payment at your convenience. Thank you!",
  ].join("\n");
```

Run: same → Expected: PASS.

- [ ] **Step 2: API, hooks and PDF sharing**

In `frontend/src/services/api.js` add to `invoiceAPI`:

```js
  list: (params) => api.get("/invoices/list", { params }),
  /** The PDF as a File (sent with the auth header), for sharing or saving. */
  fetchPdf: async (invoice) => {
    const res = await api.get(`/invoices/${invoice.id}/pdf`, { responseType: "blob" });
    return new File([res.data], `invoice-${invoice.invoice_number || invoice.id}.pdf`, { type: "application/pdf" });
  },
```

`frontend/src/features/invoices/api.js`:

```js
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoiceAPI, orderAPI } from "../../services/api";
import { keys, invalidateMoney } from "../../lib/queryKeys";

const body = (res) => res.data.data;
const notFound = (err) => err?.response?.status === 404;

export const useInvoiceList = (params) =>
  useInfiniteQuery({
    queryKey: keys.invoices.list(params),
    queryFn: ({ pageParam }) => invoiceAPI.list({ ...params, page: pageParam, limit: 30 }).then(body),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: (previous) => previous,
  });

export const useInvoice = (id) =>
  useQuery({ queryKey: keys.invoices.detail(id), queryFn: () => invoiceAPI.getById(id).then(body), enabled: Boolean(id), retry: (n, err) => !notFound(err) && n < 1 });

export const useInvoiceStatus = (id) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (status) => invoiceAPI.updateStatus(id, { status }), onSuccess: () => invalidateMoney(qc) });
};

export const useDeleteInvoice = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => invoiceAPI.delete(id), onSuccess: () => invalidateMoney(qc) });
};

/** A customer's orders not yet on an invoice (full orders, so totals use orderMath). */
export const useUnbilledOrders = (customerId) =>
  useQuery({ queryKey: keys.orders.unbilled(customerId), queryFn: () => orderAPI.getAll({ customer_id: customerId, invoice_id: "null" }).then(body), enabled: Boolean(customerId) });

export const useGenerateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload) => invoiceAPI.generate(payload).then(body), onSuccess: () => invalidateMoney(qc) });
};
```

`frontend/src/features/invoices/sharePdf.js`:

```js
import { invoiceAPI } from "../../services/api";

/** Phone share sheet (WhatsApp, etc.) when the browser can share files; otherwise a download. */
export const sharePdf = async (invoice) => {
  const file = await invoiceAPI.fetchPdf(invoice);
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Invoice ${invoice.invoice_number}` });
      return "shared";
    } catch (err) {
      if (err?.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return "downloaded";
};
```

- [ ] **Step 3: List screen**

`frontend/src/features/invoices/InvoiceRow.jsx`:

```jsx
import { memo } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { DueText } from "../../ui/Money";
import { inr, shortDate } from "../../utils/dashboardFormat";

function InvoiceRow({ row }) {
  const cancelled = row.derivedStatus === "CANCELLED";
  return (
    <li className="border-b border-line/60 last:border-0">
      <Link to={`/invoices/${row.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">#{row.number} · {row.customer.name}</p>
          <p className="truncate text-xs text-ink-2">
            {shortDate(row.invoiceDate)} ·{" "}
            {row.derivedStatus === "OVERDUE"
              ? <span className="font-semibold text-status-critical">overdue {row.overdueDays} day{row.overdueDays === 1 ? "" : "s"}</span>
              : row.dueDate ? `due ${shortDate(row.dueDate)}` : "no due date"}
            {row.taxPercent > 0 && ` · ${row.taxPercent}% GST`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-num text-sm font-bold tabular-nums ${cancelled ? "text-ink-2 line-through" : "text-ink"}`}>{inr(row.finalAmount)}</p>
          {cancelled ? <span className="text-xs text-ink-2">Cancelled</span> : <DueText due={row.amountDue > 0 ? row.amountDue : -row.amountExtra} />}
        </div>
      </Link>
    </li>
  );
}

InvoiceRow.propTypes = { row: PropTypes.object.isRequired };

export default memo(InvoiceRow);
```

`frontend/src/features/invoices/InvoicesPage.jsx`:

```jsx
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useInvoiceList } from "./api";
import InvoiceRow from "./InvoiceRow";
import Chips from "../../ui/Chips";
import TextInput from "../../ui/TextInput";
import PageHeader from "../../ui/PageHeader";
import Button from "../../ui/Button";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { inr } from "../../utils/dashboardFormat";

export default function InvoicesPage() {
  const [params, setParams] = useSearchParams();
  const chip = params.get("chip") || "all";
  const search = params.get("q") || "";
  const term = useDebounced(search.trim());
  const list = useInvoiceList({ chip, search: term || undefined });
  const sentinel = useInfiniteSentinel(list);
  const pages = list.data?.pages;
  const rows = useMemo(() => (pages || []).flatMap((p) => p.rows), [pages]);
  const first = pages?.[0];

  const setParam = (key, value) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });

  const chips = [
    { value: "all", label: "All", count: first?.counts.all },
    { value: "unpaid", label: "Unpaid", count: first?.counts.unpaid },
    { value: "overdue", label: "Overdue", count: first?.counts.overdue },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Invoices" actions={<Link to="/invoices/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>} />
      <div className="mt-3 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setParam("q", e.target.value)} placeholder="Search customer or invoice number" aria-label="Search invoices" enterKeyHint="search" />
        <Chips label="Filter invoices" options={chips} value={chip} onChange={(v) => setParam("chip", v)} />
        {first && first.summary.due > 0 && (
          <p className="text-sm text-ink-2" aria-live="polite">Unpaid <span className="font-num font-semibold text-status-critical tabular-nums">{inr(first.summary.due)}</span> across {first.counts.unpaid} invoice{first.counts.unpaid === 1 ? "" : "s"}</p>
        )}
      </div>
      <div className={`mt-3 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? (
          <ListSkeleton />
        ) : list.isError && rows.length === 0 ? (
          <ErrorState title="Couldn't load invoices." onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          chip !== "all" || term ? (
            <EmptyState title="No invoices match" action={<Button variant="secondary" onClick={() => setParams({}, { replace: true })}>Clear search and filters</Button>} />
          ) : (
            <EmptyState title="No invoices yet" body="Make one from a customer's orders." action={<Link to="/invoices/new" className={buttonClass()}>New invoice</Link>} />
          )
        ) : (
          <ul className="overflow-hidden rounded-2xl bg-surface">{rows.map((r) => <InvoiceRow key={r.id} row={r} />)}</ul>
        )}
        <div ref={sentinel} aria-hidden="true" />
        {list.isFetchingNextPage && <ListSkeleton rows={2} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Invoice page**

`frontend/src/features/invoices/InvoicePage.jsx`:

```jsx
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ellipsis, Share2, MessageCircle } from "lucide-react";
import { useInvoice, useInvoiceStatus, useDeleteInvoice } from "./api";
import { sharePdf } from "./sharePdf";
import PaymentSheet from "../payments/PaymentSheet";
import PaymentList from "../payments/PaymentList";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Tabs, { TabPanel } from "../../ui/Tabs";
import ActionSheet from "../../ui/ActionSheet";
import ConfirmDialog from "../../ui/ConfirmDialog";
import StatusBadge from "../../ui/StatusBadge";
import { Money, DueText } from "../../ui/Money";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import { formatInvoiceQty, formatInvoiceRate } from "../../utils/formatters";
import { shortDate } from "../../utils/dashboardFormat";
import { whatsappHref } from "../../utils/phone";
import { buildInvoiceReminder } from "../../utils/whatsappReminder";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function InvoicePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: inv, isPending, isError, error, refetch } = useInvoice(id);
  const setStatus = useInvoiceStatus(id);
  const del = useDeleteInvoice();
  const [tab, setTab] = useState("items");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheet, setSheet] = useState({ open: false, key: 0 });
  const [confirm, setConfirm] = useState(null); // "cancel" | "delete"
  const [sharing, setSharing] = useState(false);

  if (isPending) return <PageSkeleton />;
  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {error?.response?.status === 404
          ? <EmptyState title="This invoice doesn't exist" body="It may have been deleted." action={<Link to="/invoices" className={buttonClass({ variant: "secondary" })}>All invoices</Link>} />
          : <ErrorState title="Couldn't load this invoice." onRetry={() => refetch()} />}
      </div>
    );
  }

  const m = inv.money;
  const cancelled = m.derivedStatus === "CANCELLED";
  const name = inv.customer?.name || "Unknown customer";
  const choices = inv.orderMoney.filter((o) => o.due > 0 && !o.deleted && o.status !== "CANCELLED");
  const remind = !cancelled && m.amountDue > 0
    ? whatsappHref(inv.customer?.metadata?.phone, buildInvoiceReminder({ name, number: inv.invoice_number, invoiceDate: inv.invoice_date, amountDue: m.amountDue }))
    : null;
  const items = (inv.invoiceItems || []).filter((i) => parseFloat(i.total_price) >= 0); // advance lines are shown as received, not items
  const fail = (err) => toast.error(errorText(err, "That didn't work. Try again."));

  const share = async () => {
    setSharing(true);
    try {
      if ((await sharePdf(inv)) === "downloaded") toast.success("PDF downloaded");
    } catch (err) {
      fail(err);
    } finally {
      setSharing(false);
    }
  };

  const runConfirm = () => {
    if (confirm === "cancel") setStatus.mutate("CANCELLED", { onSuccess: () => { setConfirm(null); toast.success("Invoice cancelled"); }, onError: fail });
    if (confirm === "delete") del.mutate(id, { onSuccess: () => { toast.success("Invoice deleted"); navigate("/invoices", { replace: true }); }, onError: fail });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-2">Invoice #{inv.invoice_number}</p>
          <Link to={`/customers/${inv.customer_id}`} className="block truncate font-num text-xl font-semibold text-ink hover:underline">{name}</Link>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
            {shortDate(inv.invoice_date)}{inv.payment_due_date && ` · due ${shortDate(inv.payment_due_date)}`} · {inv.orderMoney.length} order{inv.orderMoney.length === 1 ? "" : "s"}
            <StatusBadge kind="invoice" status={m.derivedStatus} />
          </p>
        </div>
        <IconButton label="More actions for this invoice" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>
      </div>

      {cancelled && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-raised px-4 py-3 text-sm text-ink-2">
          <span>Cancelled — not counted as unpaid.</span>
          <Button size="sm" variant="secondary" loading={setStatus.isPending} onClick={() => setStatus.mutate("PENDING", { onSuccess: () => toast.success("Invoice restored"), onError: fail })}>Restore</Button>
        </div>
      )}

      <section aria-label="Money" className="rounded-3xl bg-gradient-to-b from-raised to-surface p-4 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-ink-2"><dt>Orders total</dt><dd><Money value={Number(inv.total_amount)} className="font-semibold text-ink" /></dd></div>
          <div className="flex justify-between text-ink-2"><dt>GST {Number(inv.tax_percent)}%</dt><dd><Money value={Number(inv.tax_amount)} className="font-semibold text-ink" /></dd></div>
          {Number(inv.tax_amount) > 0 && <div className="flex justify-between text-ink-2"><dt>Invoice total</dt><dd><Money value={Number(inv.final_amount)} className="font-semibold text-ink" /></dd></div>}
          <div className="flex justify-between text-ink-2"><dt>Received on these orders</dt><dd><Money value={m.amountPaid} className="font-semibold text-ink" /></dd></div>
        </dl>
        <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3">
          {m.amountDue > 0
            ? <><span className="text-sm font-semibold text-ink-2">Due{m.derivedStatus === "OVERDUE" && <span className="text-status-critical"> · overdue {m.overdueDays} days</span>}</span><Money value={m.amountDue} className="text-3xl font-bold text-status-critical" /></>
            : <><span className="text-sm font-semibold text-status-good">Paid in full ✓</span>{m.amountExtra > 0 && <span className="text-sm text-ink-2"><Money value={m.amountExtra} /> extra received</span>}</>}
        </div>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" loading={sharing} onClick={share}><Share2 className="h-4 w-4" aria-hidden="true" />Share PDF</Button>
          {!cancelled && choices.length > 0 && <Button className="flex-1" variant="secondary" onClick={() => setSheet({ open: true, key: Date.now() })}>＋ Payment</Button>}
          {remind && <a href={remind} target="_blank" rel="noopener noreferrer" className={`${buttonClass({ variant: "secondary" })} flex-1`}><MessageCircle className="h-4 w-4" aria-hidden="true" />Remind</a>}
        </div>
      </section>

      <Tabs label="Invoice sections" value={tab} onChange={setTab}
        tabs={[{ value: "items", label: "Items" }, { value: "payments", label: `Payments (${inv.orderPayments.length})` }, { value: "details", label: "Details" }]} />

      {tab === "items" && (
        <TabPanel value="items">
          <ul className="divide-y divide-line/60 rounded-2xl bg-surface px-4">
            {items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{item.description}</p>
                  <p className="text-xs text-ink-2">{formatInvoiceQty(item)} · {formatInvoiceRate(item)}</p>
                </div>
                <Money value={Number(item.total_price)} className="text-sm font-semibold" />
              </li>
            ))}
            <li className="flex justify-between gap-3 py-3"><span className="font-semibold text-ink">Orders total</span><Money value={Number(inv.total_amount)} className="font-bold" /></li>
          </ul>
        </TabPanel>
      )}
      {tab === "payments" && <TabPanel value="payments"><PaymentList payments={inv.orderPayments} showOrder /></TabPanel>}
      {tab === "details" && (
        <TabPanel value="details">
          <dl className="divide-y divide-line/60 rounded-2xl bg-surface px-4 text-sm">
            {[
              ["Invoice date", shortDate(inv.invoice_date)],
              ["Billing period", `${shortDate(inv.billing_period_start)} – ${shortDate(inv.billing_period_end)}`],
              ["Payment due", inv.payment_due_date ? shortDate(inv.payment_due_date) : "—"],
              ["GST", `${Number(inv.tax_percent)}%`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 py-3"><dt className="text-ink-2">{label}</dt><dd className="text-right text-ink">{value}</dd></div>
            ))}
          </dl>
          <h3 className="mt-4 px-1 pb-1.5 text-xs font-semibold text-ink-2">Orders on this invoice</h3>
          <ul className="divide-y divide-line/60 overflow-hidden rounded-2xl bg-surface">
            {inv.orderMoney.map((o) => (
              <li key={o.id}>
                <Link to={`/orders/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-raised/60">
                  <span className="text-sm text-ink">{shortDate(o.orderDate)}{o.deleted ? " (deleted)" : o.status === "CANCELLED" ? " (cancelled)" : ""}</span>
                  <span className="text-right"><Money value={o.total} className="block text-sm font-semibold" /><DueText due={o.due} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </TabPanel>
      )}

      <ActionSheet open={menuOpen} title={`Invoice #${inv.invoice_number}`} onClose={() => setMenuOpen(false)}
        actions={[
          !cancelled && { label: "Cancel invoice", tone: "danger", onSelect: () => setConfirm("cancel") },
          { label: "Delete invoice", tone: "danger", onSelect: () => setConfirm("delete") },
        ]} />
      <ConfirmDialog open={confirm === "cancel"} title={`Cancel invoice #${inv.invoice_number}?`} confirmLabel="Cancel invoice" cancelLabel="Keep invoice" busy={setStatus.isPending}
        message="It stays in the list marked Cancelled and no longer counts as unpaid. Payments on its orders don't change. You can restore it."
        onConfirm={runConfirm} onClose={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === "delete"} title={`Delete invoice #${inv.invoice_number}?`} confirmLabel="Delete invoice" cancelLabel="Keep invoice" busy={del.isPending}
        message="Its orders become un-invoiced so you can bill them again. Payments stay on the orders."
        onConfirm={runConfirm} onClose={() => setConfirm(null)} />
      <PaymentSheet key={sheet.key} open={sheet.open} mode="payment" invoiceId={id} orderChoices={choices} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
    </div>
  );
}
```

- [ ] **Step 5: Routes, verify, commit**

In `frontend/src/App.jsx`: replace the `Invoices` and `InvoiceDetails` lazy imports with `const InvoicesPage = lazy(() => import("./features/invoices/InvoicesPage"));` and `const InvoicePage = lazy(() => import("./features/invoices/InvoicePage"));`; routes `<Route index element={<InvoicesPage />} />` and `<Route path=":id" element={<InvoicePage />} />`.

Run: `cd frontend && npx eslint src/features src/utils src/services && npx vitest run 2>&1 | tail -3` → Expected: clean; pass.

Visual check on the UX copy: `/invoices` chips show All 31 · Unpaid · Overdue with counts; about 24 invoices show "Paid ✓"; the taxed invoice's due includes its GST; an overdue invoice shows "overdue N days" in red; the invoice page's Due equals the list row and the downloaded PDF's "Due"; ＋ Payment lets you pick the order and saves (then the invoice turns Paid when fully paid); Cancel → banner + Restore; Delete returns to the list and its orders show as not invoiced.

```bash
git add frontend/src/services/api.js frontend/src/utils/whatsappReminder.js frontend/src/utils/whatsappReminder.test.js frontend/src/features/invoices/api.js frontend/src/features/invoices/sharePdf.js frontend/src/features/invoices/InvoicesPage.jsx frontend/src/features/invoices/InvoiceRow.jsx frontend/src/features/invoices/InvoicePage.jsx frontend/src/App.jsx
git commit -m "feat(invoices): invoices list and page — due from recorded payments incl. tax, share PDF, pay per order

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: New invoice — three steps with Back

**Files:**
- Create: `frontend/src/features/invoices/invoiceDraft.js`, `invoiceDraft.test.js`, `NewInvoicePage.jsx`
- Modify: `frontend/src/App.jsx`, `backend/knowledge/invoices.md`

**Interfaces:**
- Consumes: `useSteps`, `ReviewBlock` (Task 17), `CustomerPicker` (Task 16), `useUnbilledOrders`, `useGenerateInvoice` (Task 18), frontend `orderTotal`.
- Produces: `INVOICE_STEPS`, `billableOrders(orders)`, `billingPeriod(orders) → { from, to } | null`, `invoiceTotals(orders, gstOn, gstText) → { subtotal, percent, tax, final }`, `invoiceErrors(draft, step)`, `toInvoicePayload(draft, chosenOrders)`.

- [ ] **Step 1: Failing tests**

`frontend/src/features/invoices/invoiceDraft.test.js`:

```js
import { describe, expect, test } from "vitest";
import { billableOrders, billingPeriod, invoiceTotals, invoiceErrors, toInvoicePayload } from "./invoiceDraft";

const kgOrder = (o) => ({
  id: "o", order_date: "2026-09-10", status: "DELIVERED", invoice_id: null, custom_plate_charge: null, round_off_amount: "0.00",
  plateType: { charge: "0.00" }, orderProductSizes: [{ unit: "KG", quantity_kg: "12.35", rate_per_kg: "181.25", productSize: { rate_per_kg: "181.25" } }], ...o,
}); // 2238.4375
const A = kgOrder({ id: "a", order_date: "2026-09-12" });
const B = kgOrder({ id: "b", order_date: "2026-09-02", plateType: { charge: "500.00" }, orderProductSizes: [{ unit: "KG", quantity_kg: "10.00", rate_per_kg: "100.00", productSize: { rate_per_kg: "100.00" } }] }); // 1500

describe("invoice draft", () => {
  test("only orders not invoiced and not cancelled, oldest first", () => {
    expect(billableOrders([A, B, kgOrder({ id: "c", invoice_id: "i1" }), kgOrder({ id: "d", status: "CANCELLED" })]).map((o) => o.id)).toEqual(["b", "a"]);
  });
  test("billing period from the ticked orders", () => {
    expect(billingPeriod([A, B])).toEqual({ from: "2026-09-02", to: "2026-09-12" });
    expect(billingPeriod([])).toBeNull();
  });
  test("totals use the server's arithmetic (unrounded order totals, then 2 decimals)", () => {
    expect(invoiceTotals([A, B], false, "18")).toEqual({ subtotal: 3738.44, percent: 0, tax: 0, final: 3738.44 });
    expect(invoiceTotals([A, B], true, "5")).toEqual({ subtotal: 3738.44, percent: 5, tax: 186.92, final: 3925.36 });
  });
  test("step checks", () => {
    expect(invoiceErrors({ customer: null }, 0)).toEqual({ customer: "Choose a customer" });
    expect(invoiceErrors({ customer: { id: "c" }, selected: [], gstOn: true, gst: "abc" }, 1)).toEqual({ orders: "Tick at least one order", gst: "Enter a number" });
    expect(invoiceErrors({ customer: { id: "c" }, selected: ["a"], gstOn: true, gst: "120" }, 1)).toEqual({ gst: "GST can't be more than 100%" });
    expect(invoiceErrors({ dueDate: "2026-02-30" }, 2)).toEqual({ dueDate: "Choose the payment due date" });
  });
  test("payload", () => {
    expect(toInvoicePayload({ customer: { id: "c1" }, gstOn: true, gst: "18", dueDate: "2026-10-30" }, [B, A])).toEqual({
      customer_id: "c1", order_ids: ["b", "a"], billing_period_start: "2026-09-02", billing_period_end: "2026-09-12", payment_due_date: "2026-10-30", tax_percent: 18,
    });
  });
});
```

Run: `cd frontend && npx vitest run src/features/invoices` → Expected: FAIL (module missing).

- [ ] **Step 2: `invoiceDraft.js`**

```js
import { orderTotal } from "../../utils/orderMath";
import { parseNumber } from "../../utils/numberInput";
import { isISODate } from "../../utils/istDate";

export const INVOICE_STEPS = ["Customer", "Orders", "Review"];

export const billableOrders = (orders) =>
  orders.filter((o) => !o.invoice_id && o.status !== "CANCELLED").sort((a, b) => a.order_date.localeCompare(b.order_date));

export const billingPeriod = (orders) => {
  if (!orders.length) return null;
  const dates = orders.map((o) => o.order_date).sort();
  return { from: dates[0], to: dates[dates.length - 1] };
};

const twoDp = (x) => Number(x.toFixed(2)); // the server stores toFixed(2) of these same sums

/** Same arithmetic as the server's generateInvoice, so the preview is exactly what gets saved. */
export const invoiceTotals = (orders, gstOn, gstText) => {
  const subtotal = orders.reduce((s, o) => s + orderTotal(o), 0);
  const percent = gstOn ? parseNumber(gstText, { allowZero: true }).value ?? 0 : 0;
  const tax = (subtotal * percent) / 100;
  return { subtotal: twoDp(subtotal), percent, tax: twoDp(tax), final: twoDp(subtotal + tax) };
};

export const invoiceErrors = (d, step) => {
  if (step === 0) return d.customer ? {} : { customer: "Choose a customer" };
  if (step === 1) {
    const e = {};
    if (!d.selected.length) e.orders = "Tick at least one order";
    if (d.gstOn) {
      const p = parseNumber(d.gst);
      if (p.error || p.value === null) e.gst = p.error || "Enter the GST %";
      else if (p.value > 100) e.gst = "GST can't be more than 100%";
    }
    return e;
  }
  return isISODate(d.dueDate) ? {} : { dueDate: "Choose the payment due date" };
};

export const toInvoicePayload = (d, orders) => {
  const period = billingPeriod(orders);
  return {
    customer_id: d.customer.id,
    order_ids: orders.map((o) => o.id),
    billing_period_start: period.from,
    billing_period_end: period.to,
    payment_due_date: d.dueDate,
    tax_percent: d.gstOn ? parseNumber(d.gst).value : 0,
  };
};
```

Run: `cd frontend && npx vitest run src/features/invoices` → Expected: PASS.

- [ ] **Step 3: The page**

`frontend/src/features/invoices/NewInvoicePage.jsx`:

```jsx
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Search } from "lucide-react";
import { useUnbilledOrders, useGenerateInvoice } from "./api";
import { useCustomerSummary } from "../customers/api";
import CustomerPicker from "../customers/CustomerPicker";
import { INVOICE_STEPS, billableOrders, billingPeriod, invoiceTotals, invoiceErrors, toInvoicePayload } from "./invoiceDraft";
import Stepper from "../../ui/Stepper";
import StickyFooter from "../../ui/StickyFooter";
import Button from "../../ui/Button";
import Field from "../../ui/Field";
import NumberInput from "../../ui/NumberInput";
import DateField from "../../ui/DateField";
import Switch from "../../ui/Switch";
import ReviewBlock from "../../ui/ReviewBlock";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "../../ui/States";
import { INPUT, INPUT_INVALID } from "../../ui/styles";
import useSteps from "../../ui/useSteps";
import { itemsText, itemsFromLines } from "../../utils/itemsText";
import { ORDER_STATUS } from "../../utils/statusMeta";
import { addDays, todayIST } from "../../utils/istDate";
import { inr, shortDate } from "../../utils/dashboardFormat";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function NewInvoicePage() {
  const [search] = useSearchParams();
  const presetId = search.get("customer");
  const navigate = useNavigate();
  const toast = useToast();
  const preset = useCustomerSummary(presetId);
  const generate = useGenerateInvoice();

  const initial = useMemo(() => ({
    customer: preset.data ? { id: preset.data.customer.id, name: preset.data.customer.name, due: preset.data.owes } : null,
    selected: null, // null = every billable order (pre-ticked)
    gstOn: false,
    gst: "18",
    dueDate: addDays(todayIST(), 30),
  }), [preset.data]);
  const [edited, setEdited] = useState(null);
  const d = edited ?? initial;
  const update = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));

  const ordersQ = useUnbilledOrders(d.customer?.id);
  const billable = useMemo(() => billableOrders(ordersQ.data || []), [ordersQ.data]);
  const selected = d.selected ?? billable.map((o) => o.id);
  const chosen = billable.filter((o) => selected.includes(o.id));
  const full = { ...d, selected };
  const steps = useSteps({ count: INVOICE_STEPS.length, errorsFor: (i) => invoiceErrors(full, i), start: presetId ? 1 : 0 });
  const [picking, setPicking] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (presetId && preset.isPending) return <PageSkeleton />;

  const step = d.customer ? steps.step : 0;
  const errors = steps.shownFor(step) ? invoiceErrors(full, step) : {};
  const totals = invoiceTotals(chosen, d.gstOn, d.gst);
  const period = billingPeriod(chosen);
  const toggle = (id) => update({ selected: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id] });
  const leave = () => navigate("/invoices", { replace: true });
  const back = () => (step === 0 ? (edited ? setConfirmLeave(true) : leave()) : steps.back());

  const submit = () => {
    if (!steps.validateAll()) return;
    generate.mutate(toInvoicePayload(full, chosen), {
      onSuccess: (inv) => {
        toast.success(`Invoice #${inv.invoice_number} created`);
        navigate(`/invoices/${inv.id}`, { replace: true });
      },
    });
  };

  return (
    <div className="mx-auto max-w-xl px-4 pt-3 sm:px-6">
      <Stepper steps={INVOICE_STEPS} current={step} reached={d.customer ? steps.reached : 0} onGo={steps.go} />

      <div className="mt-4">
        {step === 0 && (
          <Field label="Customer" htmlFor="inv-customer" error={errors.customer}>
            <button type="button" onClick={() => setPicking(true)} className={`${INPUT} flex items-center justify-between gap-2 text-left ${errors.customer ? INPUT_INVALID : ""}`}>
              {d.customer ? <span className="truncate font-semibold">{d.customer.name}</span> : <span className="text-ink-2">Choose a customer</span>}
              <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
            </button>
          </Field>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <h2 className="font-num text-lg font-semibold text-ink">{d.customer.name} — which orders?</h2>
            <p className="-mt-2 text-sm text-ink-2">Every order not yet invoiced is ticked.</p>
            {ordersQ.isPending ? (
              <ListSkeleton rows={3} />
            ) : ordersQ.isError ? (
              <ErrorState title="Couldn't load the orders." onRetry={() => ordersQ.refetch()} />
            ) : billable.length === 0 ? (
              <EmptyState title="Nothing to bill" body={`All of ${d.customer.name}'s orders are already on invoices (or cancelled).`} />
            ) : (
              <div className="space-y-2" role="group" aria-label="Orders to include">
                {billable.map((o) => {
                  const on = selected.includes(o.id);
                  return (
                    <button key={o.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(o.id)} className="flex w-full items-center gap-3 rounded-2xl bg-surface px-3 py-3 text-left">
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${on ? "bg-brass text-brass-on" : "bg-raised text-transparent"}`} aria-hidden="true"><Check className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{shortDate(o.order_date)} · {itemsText(itemsFromLines(o.orderProductSizes))}</span>
                        <span className="block text-xs text-ink-2">{inr(o.money.total)} · {o.money.due > 0 ? `due ${inr(o.money.due)}` : "paid"} · {ORDER_STATUS[o.status]?.label || o.status}</span>
                      </span>
                    </button>
                  );
                })}
                {errors.orders && <p role="alert" className="text-xs font-medium text-status-critical">{errors.orders}</p>}
              </div>
            )}
            <Switch checked={d.gstOn} onChange={(gstOn) => update({ gstOn })} label="Add GST" description={period ? `Billing period ${shortDate(period.from)} – ${shortDate(period.to)}, from the ticked orders` : undefined} />
            {d.gstOn && (
              <Field label="GST %" htmlFor="inv-gst" error={errors.gst}>
                <NumberInput value={d.gst} onChange={(gst) => update({ gst })} suffix="%" />
              </Field>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <ReviewBlock title="Customer" onEdit={() => steps.go(0)}><p className="font-semibold">{d.customer.name}</p></ReviewBlock>
            <ReviewBlock title="Orders" onEdit={() => steps.go(1)}>
              <p>{chosen.length} order{chosen.length === 1 ? "" : "s"}{period && ` · ${shortDate(period.from)} – ${shortDate(period.to)}`}</p>
            </ReviewBlock>
            <dl className="space-y-1 rounded-2xl bg-surface px-4 py-3 text-sm">
              <div className="flex justify-between text-ink-2"><dt>Orders total</dt><dd><Money value={totals.subtotal} /></dd></div>
              <div className="flex justify-between text-ink-2"><dt>GST {totals.percent}%</dt><dd><Money value={totals.tax} /></dd></div>
              <div className="flex justify-between border-t border-line pt-2 font-semibold text-ink"><dt>Invoice total</dt><dd><Money value={totals.final} /></dd></div>
            </dl>
            <p className="px-1 text-sm text-ink-2">Invoice date: today, {shortDate(todayIST())}</p>
            <Field label="Payment due" htmlFor="inv-due" error={errors.dueDate}>
              <DateField quick={false} value={d.dueDate} onChange={(dueDate) => update({ dueDate })} />
            </Field>
          </div>
        )}
      </div>

      <StickyFooter>
        {generate.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(generate.error, "Couldn't create the invoice. Try again.")}</p>}
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={back}>Back</Button>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-xs text-ink-2">{chosen.length} order{chosen.length === 1 ? "" : "s"}</p>
            <Money value={totals.final} className="text-lg font-bold text-ink" />
          </div>
          {step < INVOICE_STEPS.length - 1
            ? <Button onClick={steps.next}>Next</Button>
            : <Button onClick={submit} loading={generate.isPending}>Create invoice</Button>}
        </div>
      </StickyFooter>

      <CustomerPicker open={picking} onClose={() => setPicking(false)} onPick={(customer) => { update({ customer, selected: null }); setPicking(false); }} />
      <ConfirmDialog open={confirmLeave} title="Leave without creating the invoice?" message="Your choices will be lost." confirmLabel="Leave" cancelLabel="Stay" onConfirm={leave} onClose={() => setConfirmLeave(false)} />
    </div>
  );
}
```

Ruling built into this code: while no customer is chosen the page shows step 0 whatever `steps.step` says (a preset customer that failed to load can't strand the user on step 2).

- [ ] **Step 4: Routes and invoices knowledge**

In `frontend/src/App.jsx`: replace the `GenerateInvoice` lazy import with `const NewInvoicePage = lazy(() => import("./features/invoices/NewInvoicePage"));`, add `Navigate` to the react-router import, and use:

```jsx
                          <Route path="new" element={<NewInvoicePage />} />
                          <Route path="generate" element={<Navigate to="/invoices/new" replace />} />
```

Replace the whole of `backend/knowledge/invoices.md` with:

```md
# Invoices

What it is: invoices built from a customer's orders that are not on an invoice
yet (not cancelled). Creating one stamps those orders with the invoice id,
copies their lines into `invoice_items`, applies optional GST, and assigns the
next 8-digit number (e.g. 00000042).

## How much is due
**Due = invoice total (including GST) − everything received on the invoice's
orders** (payments, advances; refunds subtracted). The status is worked out
from that: **Paid** when nothing is due, **Overdue** when the due date has
passed with money still due, otherwise **Unpaid** — only **Cancelled** is set
by hand. The same Due shows on the list, the invoice page and the PDF.

## Making an invoice
1. Open [Invoices](/invoices) → **New** (or an order's **⋯ → Create invoice**,
   which starts with that customer). Three steps with **Back** on each:
2. **Customer** — choose from the picker.
3. **Orders** — every order not yet invoiced is ticked; untick any to leave
   out. **Add GST** switches tax on (default 18%, editable). The billing period
   is taken from the ticked orders.
4. **Review** — orders total, GST, invoice total; set **Payment due** (30 days
   by default). Tap **Create invoice**. You land on the new invoice.

## The invoice page
`/invoices/:id`: customer, dates and status; a money card — **Orders total**,
**GST**, **Received on these orders**, **Due** — with **Share PDF** (phone
share sheet, or a download), **＋ Payment** (choose which order the money is
for) and **Remind** (WhatsApp with the invoice number and balance). Tabs:
**Items**, **Payments**, **Details** (dates, GST and the orders with each
one's due). **⋯**: **Cancel invoice** (asks first; Restore afterwards) and
**Delete invoice** (its orders become un-invoiced; payments stay on the orders).

## Finding invoices
[Invoices](/invoices) lists them newest first with **Due ₹…** or **Paid ✓**;
chips **All · Unpaid · Overdue**; search by customer or invoice number.

Notes:
- An order can be on only one invoice. Editing an order after it is invoiced
  does NOT change the invoice; delete the invoice and create it again.
- Invoice items show units: kg lines as "₹180.00/kg" × "50 kg", pieces lines
  with the price as entered ("₹375.00 / 1,000 pcs" × "5,000 pcs"). Invoices
  made before piece orders existed show no units. Estimated weights never
  appear on invoices.
```

- [ ] **Step 5: Verify and commit**

Run: `cd frontend && npx eslint src/features && npx vitest run 2>&1 | tail -3` → Expected: clean; pass.

Visual check on the UX copy: New invoice → choose a customer with unbilled orders → all ticked; untick one (total updates); GST on at 5% → footer total equals the review's invoice total; Back from Review keeps ticks and GST; Create → the invoice page shows exactly that total; from an order's ⋯ → Create invoice starts on Orders for that customer; `/invoices/generate` redirects.

```bash
git add frontend/src/features/invoices/invoiceDraft.js frontend/src/features/invoices/invoiceDraft.test.js frontend/src/features/invoices/NewInvoicePage.jsx frontend/src/App.jsx backend/knowledge/invoices.md
git commit -m "feat(invoices): three-step new invoice with GST preview that matches what is saved

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: Remove replaced code; lint clean; measure; handoff

**Files:**
- Delete (each only after the grep below shows no importer): `frontend/src/pages/{Orders,OrderDetails,CreateOrder,EditOrder,Customers,CustomerDetails,CreateCustomer,EditCustomer,Invoices,InvoiceDetails,GenerateInvoice}.jsx`, `frontend/src/pages/{Orders,Customers}.css`, `frontend/src/components/orders/*`, `frontend/src/components/customers/*`, `frontend/src/components/invoices/*`, `frontend/src/components/payments/*`, `frontend/src/services/paymentAPI.js`, `frontend/src/components/ui/action-button.jsx`, `frontend/src/utils/orderFormLines.test.js` only if `orderFormLines.js` is also unused (it is still used by the new form — keep both)
- Modify: `HANDOFF.md`

- [ ] **Step 1: Find what is still imported**

Run:

```bash
cd frontend/src
for f in pages/Orders pages/OrderDetails pages/CreateOrder pages/EditOrder pages/Customers pages/CustomerDetails pages/CreateCustomer pages/EditCustomer pages/Invoices pages/InvoiceDetails pages/GenerateInvoice services/paymentAPI components/ui/action-button; do
  n=$(grep -rlE "from ['\"][./]*${f}['\"]|import\(['\"][./]*${f}['\"]\)" . | wc -l | tr -d ' '); echo "$f $n"; done
for d in orders customers invoices payments; do echo "components/$d:"; grep -rlE "components/$d/" . | grep -v "^./components/$d/" ; done
```

Expected: every file prints `0`; the component folders are imported only by the pages being deleted (or nothing). If anything else still imports one of them, keep that file and ledger a `Ruling:` naming the importer.

- [ ] **Step 2: Delete and prove nothing broke**

```bash
cd frontend
git rm src/pages/Orders.jsx src/pages/OrderDetails.jsx src/pages/CreateOrder.jsx src/pages/EditOrder.jsx src/pages/Customers.jsx src/pages/CustomerDetails.jsx src/pages/CreateCustomer.jsx src/pages/EditCustomer.jsx src/pages/Invoices.jsx src/pages/InvoiceDetails.jsx src/pages/GenerateInvoice.jsx src/pages/Orders.css src/pages/Customers.css src/services/paymentAPI.js src/components/ui/action-button.jsx
git rm -r src/components/orders src/components/customers src/components/invoices src/components/payments
npx eslint . 2>&1 | tail -3
npx vitest run 2>&1 | tail -3
npx vite build 2>&1 | grep -E "kB|warning|error" | tail -20
```

Expected: eslint reports **0 errors** (the 4 pre-existing react-refresh warnings may remain); tests pass; build succeeds with no chunk-size warning. Record in the ledger: entry chunk size and the largest chunk, vs the 1,271 kB single-chunk baseline.

- [ ] **Step 3: Render check (not committed)**

Temporarily wrap `<OrdersPage />`'s list in `frontend/src/features/orders/OrdersPage.jsx` with `<Profiler id="orders" onRender={(id, phase) => console.count(`orders ${phase}`)}>` (import `Profiler` from react), open `/orders` on the UX copy, scroll to the bottom, and read the console: each page load should add one `update` commit, and rows already on screen must not re-render (memoised `OrderRow`). Record the counts in the ledger, then remove the Profiler (`git diff --stat` shows no change to OrdersPage.jsx).

- [ ] **Step 4: Handoff**

Add a section to `HANDOFF.md` after the dashboard section:

```md
## UX redesign — sub-project 1 (branch `feature/ux-redesign`, not deployed)

Built on `feature/dashboard-redesign`; ships in ONE release with the dashboard
and sub-projects 2–3. Spec: `docs/superpowers/specs/2026-09-30-ux-redesign-1-core-design.md`;
plan: `docs/superpowers/plans/2026-09-30-ux-redesign-1-core.md`.

- **Money comes from one place:** `backend/src/services/orderFacts.js`
  (paise, built on `orderMath`). Used by the dashboard, `GET /api/orders/list`,
  `/api/customers/directory`, `/api/customers/:id/summary`, invoices, and the
  `money` block on `GET /api/orders/:id`.
- **Refunds** reduce received everywhere (orderMath both sides, dashboard,
  Jarvis canonical SQL). Jarvis "pending" now skips cancelled orders.
- **Invoices:** due = final amount incl. tax − received on the invoice's
  orders (+ invoice-only payments); status derived (Cancelled is the only
  manual one). `PATCH /invoices/:id/status` accepts only PENDING/CANCELLED.
- **Orders:** includes are `required:false` (archived sizes/plates/customers
  never hide an order); editing never changes the advance; server dates use
  `todayIST()`.
- **Customers:** page is by `customer_id` (not name); `city` and `gstin` in
  `metadata`; `/customers/similar` warns about duplicates.
- **Frontend:** kit in `src/ui/`, screens in `src/features/{orders,customers,
  invoices,payments}`, TanStack Query (`src/lib/queryKeys.js` →
  `invalidateMoney` after any money change), every route lazy, vendor chunks.
  Pages not redesigned yet render inside `<Legacy>` — the old CSS applies only
  under `.legacy` (removed in sub-project 3).
- **Verify before release:** `NODE_ENV=production node scripts/dashboard-verify.js`
  now also cross-checks the orders list, the customer directory and every
  invoice's paid amount against SQL, and reports orders on two invoices.
- Not in this sub-project: Expenses, History, catalog (sub-project 2); Stock
  screens, Login/Assistant re-theme, deleting legacy CSS (sub-project 3).
```

- [ ] **Step 5: Commit**

```bash
git add HANDOFF.md
git commit -m "chore(frontend): remove the replaced order, customer, invoice and payment screens; handoff notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(The `git rm` deletions from Step 2 are already staged and go into this commit.)

---

### Task 21: Walkthrough on the local copy of production

Nothing here touches production. The UX copy is Docker `yars-uxcopy` (port 5434, db `yars_uxcopy`, user/password `yars`/`yars`), login `uxdemo` / `ux-demo-pass-1`.

- [ ] **Step 1: Run the new code against the copy**

Stop any old backend on 5055, then start: `cd backend && NODE_ENV=test DB_HOSTNAME=localhost DB_PORT=5434 DB_NAME=yars_uxcopy DB_USERNAME=yars DB_PASSWORD=yars PORT=5055 node src/server.js` (background). Frontend: `cd frontend && VITE_API_URL=http://localhost:5055/api npx vite --port 5173 --strictPort` (background).

Run: `cd backend && NODE_ENV=test DB_HOSTNAME=localhost DB_PORT=5434 DB_NAME=yars_uxcopy DB_USERNAME=yars DB_PASSWORD=yars node scripts/dashboard-verify.js`
Expected: `✅`. Record the summary in the ledger (lists, invoices blocks).

- [ ] **Step 2: Walk every flow at 390px (dark, then light) and at desktop width**

For each item, compare against the named source of truth; any mismatch is a finding.

1. Orders: summary "Due" = dashboard "To collect"; chips; search size and name; infinite scroll to the last order with no duplicates; cancelled rows struck through; Back from an order keeps the filters.
2. Order page: money card = list row; part / full / over-due payment (warning, "Save anyway"); refund above received refused; edit + delete payment (confirm); status chips; cancel → Restore; delete order; 404 id.
3. New order: every step's Back keeps data; progress-bar jump; review Edit; 12.25 kg accepted, 12.255 refused with the message; pieces line + "Set weight for size"; quick-create customer from the picker; saved total = footer total; Edit order starts at step 3, no advance field, invoiced warning.
4. Customers: A–Z index jump to the last letter; Owe money = Dues screen (names and total); search by phone digits; "Veerbhadreshwar" page shows only its own orders; business − received = owes − extra.
5. Customer form: similar-name warning; mobile tick; GSTIN error shown once; saved city/GSTIN visible in Details.
6. Invoices: counts (≈24 Paid); taxed invoice's due includes GST; list Due = page Due = PDF "Due"; pay from the invoice page by order; cancel / restore; delete; new invoice with 5% GST — preview total = saved total.
7. Old screens (Stock, Expenses, History, Sizes) look as before; nothing new looks restyled by old CSS.
8. Keyboard: Tab stays inside an open sheet, Escape closes it and focus returns to the button that opened it; every icon button has a spoken name.
9. OS "reduce motion" on: sheets appear without sliding.

- [ ] **Step 3: Fix what the walkthrough finds**

Each finding: if it is logic, write the failing test first (in the owning task's test file), then fix; if it is visual, fix and re-check at 390px dark + light. Commit per fix with a message naming the finding. Ledger each as `Task 21: fixed <finding> — <test or visual check>`.

- [ ] **Step 4: Final suites**

Run: `cd backend && npm test 2>&1 | tail -5` and `cd frontend && npx vitest run 2>&1 | tail -3 && npx eslint . 2>&1 | tail -2`
Expected: all green; eslint 0 errors.
