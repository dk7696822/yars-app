# Piece-Based Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an order line be sold by pieces ("N pieces cost ₹X") alongside kg, estimate each pieces line's kg from a per-size weight ("N pieces weigh W kg"), and report total kg sold without ever counting a line twice — with zero change to existing data or totals.

**Architecture:** Additive schema change (new nullable columns + a `unit` column defaulting to `KG` + DB CHECK constraints) on `product_sizes`, `order_product_sizes`, `invoice_items`. One order-math module per side (`backend/src/services/orderMath.js`, `frontend/src/utils/orderMath.js`) pinned by one shared JSON vector file; every place that computes line amounts / totals / kg switches to it. Rollout is gated by a before/after snapshot diff that must be identical.

**Tech Stack:** Node 20, Express 5, Sequelize 6, PostgreSQL (Supabase prod, Docker `postgres:16-alpine` for tests), Jest 30; React 19, Vite 6, Tailwind, Vitest 3 (new, dev-only).

**Spec:** `docs/superpowers/specs/2026-09-30-piece-orders-design.md`

## Global Constraints

- **Never touch `epidermohydra/`.** Never `git add .`/`-A` (backend `.gitignore` is broken) — stage by explicit path. Leave the user's local changes alone (`frontend/.env.production`, deleted `backend/.env.example`, untracked `backend/scripts/*recover*`/`restore*`, `frontend/.firebase*`, `frontend/firebase.json`).
- **Existing data untouched**: the migration only adds columns/constraints/types and drops NOT NULLs; no `UPDATE` of existing rows.
- KG line amount stays **byte-for-byte** `parseFloat(quantity_kg) * parseFloat(rate_per_kg || size.rate_per_kg)` — no new rounding.
- PIECES line amount = `round₂(quantity_pieces × price_amount ÷ price_pieces_count)`, half-up, exact integer arithmetic (matches Postgres `ROUND(numeric, 2)`).
- Each line is exactly one of KG / PIECES (DB-enforced). Kg sold = kg of KG lines + estimated kg of weighted PIECES lines; pieces sold = PIECES lines only.
- Prices/weights are snapshots on the line; size-setting changes never rewrite existing lines — except back-fill of lines whose `weight_kg IS NULL`.
- Money is INR; DECIMAL columns arrive as strings — parse before arithmetic.
- Every UI change updates the matching `backend/knowledge/*.md` in the same task (Task 9 does the KB; later UI tasks must keep labels matching it).
- Tests only ever run against the local Docker DB via `npm test` (guarded by `tests/setup.js`).
- Production steps (Task 15) need the owner's explicit go-ahead **per step**.
- Commits end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. **Editing a legacy (pre-migration) kg order through the new form** — a person expects totals unchanged after a no-op save. → Task 5 test "update with old-style KG payload keeps total identical".
2. **Choosing Kg on a size that only has a piece price (or vice-versa) without a custom price** — expects a clear 400, not a NaN total or a DB constraint 500. → Task 5 tests "KG line on piece-only size → 400", "PIECES line on kg-only size without price → 400".
3. **Typing a fractional or text piece quantity ("12.5", "abc")** — expects rejection; "5000" as a string must work. → Task 5 test "quantity_pieces validation".
4. **Changing a size's weight a second time** — expects lines already filled (SIZE) and measured (MANUAL) lines to keep their weights. → Task 4 test "second weight change does not overwrite".
5. **Invoicing a mixed order whose piece price has 4 decimals** — expects invoice subtotal = order total to the paisa and item totals summing to it. → Task 6 test "mixed order invoice totals".

---

## File Structure

**Backend — create**
- `backend/src/services/orderMath.js` — line amount / kg / pieces, order total, payment position, volume summary.
- `backend/src/services/pieceFields.js` — parsing/validation of "N pieces ↔ amount" pairs; `LineError`.
- `backend/src/services/orderLines.js` — turns one client order line + its size into the DB row (snapshot rules).
- `backend/src/services/invoiceItemFormat.js` — PDF rate/qty text for invoice items.
- `backend/src/services/orderExport.js` — builds dashboard-export rows (moved out of the controller so it is testable).
- `backend/src/migrations/20260930000001-add-piece-orders.js`
- `backend/scripts/piece-orders-snapshot.js` — read-only before/after snapshot + compare.
- `backend/tests/fixtures/order-math-vectors.json` — shared by Jest and Vitest.
- `backend/tests/helpers/orderFactories.js`, `backend/tests/helpers/http.js`
- Tests: `orderMath.test.js`, `pieceOrdersMigration.test.js`, `productSizeController.test.js`, `orderController.test.js`, `invoicePieces.test.js`, `orderExport.test.js`, `pieceOrdersSnapshot.test.js`, `knowledgeQueries.test.js`

**Backend — modify**
- Models: `productSize.js`, `orderProductSize.js`, `invoiceItem.js`
- Controllers: `productSizeController.js`, `orderController.js`, `invoiceController.js`, `exportController.js`
- `services/auditService.js`, `tests/setup.js`
- Knowledge: `knowledge/schema.md`, `orders.md`, `dashboard.md`, `invoices.md`

**Frontend — create**
- `frontend/src/utils/orderMath.js` (+ `orderMath.test.js`)
- `frontend/src/utils/orderFormLines.js` (+ `orderFormLines.test.js`) — order-form line state ↔ payload.
- `frontend/src/components/orders/OrderLineFields.jsx` — one order line's inputs.
- `frontend/src/utils/formatters.test.js`

**Frontend — modify**
- `package.json` (vitest + `test` script), `utils/formatters.js`
- `components/productSizes/ProductSizeForm.jsx`, `ProductSizeList.jsx`, `pages/EditProductSize.jsx`
- `components/orders/OrderForm.jsx`, `pages/CreateOrder.jsx`, `pages/EditOrder.jsx`
- `pages/OrderDetails.jsx`, `components/orders/OrderList.jsx`, `components/invoices/GenerateInvoiceForm.jsx`, `components/invoices/InvoiceDetails.jsx`, `pages/Dashboard.jsx`

---

### Task 1: Backend order math + shared vectors

**Files:**
- Create: `backend/tests/fixtures/order-math-vectors.json`
- Create: `backend/src/services/orderMath.js`
- Test: `backend/tests/orderMath.test.js`

**Interfaces:**
- Produces (CommonJS, all accept DB-shaped objects with string decimals):
  - `piecesAmount(quantityPieces, priceAmount, pricePiecesCount) → number` (₹, 2 dp)
  - `lineAmount(line, size = line.productSize) → number`
  - `lineKg(line) → number | null`
  - `linePieces(line) → number`
  - `plateCharge(order) → number`
  - `orderTotal(order) → number` (unrounded; callers `toFixed(2)` as today)
  - `paymentPosition(order, total = orderTotal(order)) → { totalPaid, advanceReceived, totalReceived, remaining }`
  - `volumeSummary(orders) → { kgFromKgLines, kgFromPieces, kgSold, piecesTotal, piecesWithoutWeight }`

- [ ] **Step 1: Make sure the test DB is up** (all Jest suites load `tests/setup.js`, which connects)

Run: `cd backend && npm run test:db:up && npm run test:migrate`
Expected: container `yars-test-db` running; migrations up to `20260723000003`.

- [ ] **Step 2: Write the shared vectors**

`backend/tests/fixtures/order-math-vectors.json`:

```json
{
  "lineAmount": [
    { "name": "kg line with frozen rate", "line": { "unit": "KG", "quantity_kg": "50.00", "rate_per_kg": "180.00" }, "size": { "rate_per_kg": "175.00" }, "expected": 9000 },
    { "name": "legacy kg line without a unit field", "line": { "quantity_kg": "12.35", "rate_per_kg": "181.25" }, "size": { "rate_per_kg": "181.25" }, "expected": 2238.4375 },
    { "name": "kg line with null rate falls back to size rate", "line": { "unit": "KG", "quantity_kg": "10.00", "rate_per_kg": null }, "size": { "rate_per_kg": "150.00" }, "expected": 1500 },
    { "name": "pieces: 1 piece costs 0.50", "line": { "unit": "PIECES", "quantity_pieces": 5000, "price_amount": "0.5000", "price_pieces_count": 1 }, "size": {}, "expected": 2500 },
    { "name": "pieces: 1,000 pcs cost 375", "line": { "unit": "PIECES", "quantity_pieces": 5000, "price_amount": "375.0000", "price_pieces_count": 1000 }, "size": {}, "expected": 1875 },
    { "name": "pieces: 3 pcs cost 1 rupee, 3,000 pcs", "line": { "unit": "PIECES", "quantity_pieces": 3000, "price_amount": "1.0000", "price_pieces_count": 3 }, "size": {}, "expected": 1000 },
    { "name": "pieces: 3 pcs cost 1 rupee, 1 pc", "line": { "unit": "PIECES", "quantity_pieces": 1, "price_amount": "1.0000", "price_pieces_count": 3 }, "size": {}, "expected": 0.33 },
    { "name": "pieces: exact half paisa rounds up", "line": { "unit": "PIECES", "quantity_pieces": 1, "price_amount": "0.0050", "price_pieces_count": 1 }, "size": {}, "expected": 0.01 },
    { "name": "pieces: float trap 1001 x 1.005", "line": { "unit": "PIECES", "quantity_pieces": 1001, "price_amount": "1.0050", "price_pieces_count": 1 }, "size": {}, "expected": 1006.01 },
    { "name": "pieces: string quantity from a form", "line": { "unit": "PIECES", "quantity_pieces": "2000", "price_amount": 0.5, "price_pieces_count": "1" }, "size": {}, "expected": 1000 }
  ],
  "lineKg": [
    { "name": "kg line", "line": { "unit": "KG", "quantity_kg": "50.00" }, "expected": 50 },
    { "name": "pieces with 10,000 pcs weigh 100 kg", "line": { "unit": "PIECES", "quantity_pieces": 5000, "weight_kg": "100.000", "weight_pieces_count": 10000 }, "expected": 50 },
    { "name": "pieces with 1 pc weighs 0.012 kg", "line": { "unit": "PIECES", "quantity_pieces": 2500, "weight_kg": "0.012", "weight_pieces_count": 1 }, "expected": 30 },
    { "name": "pieces without weight", "line": { "unit": "PIECES", "quantity_pieces": 2000, "weight_kg": null, "weight_pieces_count": null }, "expected": null }
  ],
  "linePieces": [
    { "name": "kg line", "line": { "unit": "KG", "quantity_kg": "50.00" }, "expected": 0 },
    { "name": "pieces line", "line": { "unit": "PIECES", "quantity_pieces": 5000 }, "expected": 5000 }
  ],
  "orders": [
    {
      "name": "legacy order: kg lines, plate type charge, advance only in the column",
      "order": {
        "custom_plate_charge": null, "round_off_amount": "0.00", "advance_received": "2000.00",
        "plateType": { "charge": "1500.00" },
        "orderProductSizes": [
          { "quantity_kg": "50.00", "rate_per_kg": "180.00", "productSize": { "rate_per_kg": "180.00" } },
          { "quantity_kg": "20.00", "rate_per_kg": "200.00", "productSize": { "rate_per_kg": "190.00" } }
        ],
        "payments": []
      },
      "expected": { "total": 14500, "totalPaid": 0, "advanceReceived": 2000, "totalReceived": 2000, "remaining": 12500 }
    },
    {
      "name": "advance recorded in both places is counted once",
      "order": {
        "custom_plate_charge": null, "round_off_amount": "0.00", "advance_received": "2000.00",
        "plateType": { "charge": "1500.00" },
        "orderProductSizes": [
          { "unit": "KG", "quantity_kg": "50.00", "rate_per_kg": "180.00", "productSize": { "rate_per_kg": "180.00" } },
          { "unit": "KG", "quantity_kg": "20.00", "rate_per_kg": "200.00", "productSize": { "rate_per_kg": "190.00" } }
        ],
        "payments": [ { "payment_type": "ADVANCE", "amount": "2000.00" }, { "payment_type": "PARTIAL", "amount": "3000.00" } ]
      },
      "expected": { "total": 14500, "totalPaid": 3000, "advanceReceived": 2000, "totalReceived": 5000, "remaining": 9500 }
    },
    {
      "name": "mixed kg + pieces with custom plate charge and round off",
      "order": {
        "custom_plate_charge": "500.00", "round_off_amount": "5.00", "advance_received": "0.00",
        "plateType": { "charge": "1500.00" },
        "orderProductSizes": [
          { "unit": "KG", "quantity_kg": "10.00", "rate_per_kg": "150.00", "productSize": { "rate_per_kg": "150.00" } },
          { "unit": "PIECES", "quantity_kg": null, "rate_per_kg": null, "quantity_pieces": 5000, "price_amount": "375.0000", "price_pieces_count": 1000, "productSize": { "rate_per_kg": null } }
        ],
        "payments": [ { "payment_type": "FINAL", "amount": "3870.00" } ]
      },
      "expected": { "total": 3870, "totalPaid": 3870, "advanceReceived": 0, "totalReceived": 3870, "remaining": 0 }
    }
  ],
  "volume": [
    {
      "name": "kg once, weighted pieces as est. kg, unweighted pieces flagged",
      "orders": [
        { "orderProductSizes": [
          { "unit": "KG", "quantity_kg": "10.00" },
          { "unit": "PIECES", "quantity_pieces": 5000, "weight_kg": "100.000", "weight_pieces_count": 10000 }
        ] },
        { "orderProductSizes": [
          { "unit": "PIECES", "quantity_pieces": 2000, "weight_kg": null, "weight_pieces_count": null },
          { "quantity_kg": "2.50" }
        ] }
      ],
      "expected": { "kgFromKgLines": 12.5, "kgFromPieces": 50, "kgSold": 62.5, "piecesTotal": 7000, "piecesWithoutWeight": 2000 }
    }
  ]
}
```

- [ ] **Step 3: Write the failing test**

`backend/tests/orderMath.test.js`:

```js
"use strict";

const vectors = require("./fixtures/order-math-vectors.json");
const m = require("../src/services/orderMath");

describe("orderMath (shared vectors — frontend runs the same file)", () => {
  test.each(vectors.lineAmount)("lineAmount: $name", ({ line, size, expected }) => {
    expect(m.lineAmount(line, size)).toBeCloseTo(expected, 6);
  });

  test.each(vectors.lineKg)("lineKg: $name", ({ line, expected }) => {
    if (expected === null) expect(m.lineKg(line)).toBeNull();
    else expect(m.lineKg(line)).toBeCloseTo(expected, 6);
  });

  test.each(vectors.linePieces)("linePieces: $name", ({ line, expected }) => {
    expect(m.linePieces(line)).toBe(expected);
  });

  test.each(vectors.orders)("orderTotal + paymentPosition: $name", ({ order, expected }) => {
    const total = m.orderTotal(order);
    expect(total).toBeCloseTo(expected.total, 6);
    const pos = m.paymentPosition(order, total);
    expect(pos.totalPaid).toBeCloseTo(expected.totalPaid, 6);
    expect(pos.advanceReceived).toBeCloseTo(expected.advanceReceived, 6);
    expect(pos.totalReceived).toBeCloseTo(expected.totalReceived, 6);
    expect(pos.remaining).toBeCloseTo(expected.remaining, 6);
  });

  test.each(vectors.volume)("volumeSummary: $name", ({ orders, expected }) => {
    expect(m.volumeSummary(orders)).toEqual(expected);
  });

  test("kg lines keep the exact legacy float expression (no rounding added)", () => {
    const line = { quantity_kg: "12.35", rate_per_kg: "181.25" };
    expect(m.lineAmount(line, {})).toBe(parseFloat("12.35") * parseFloat("181.25"));
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/orderMath.test.js`
Expected: FAIL — `Cannot find module '../src/services/orderMath'`.

- [ ] **Step 5: Implement**

`backend/src/services/orderMath.js`:

```js
"use strict";

/**
 * Order math — the single source of truth for line amounts, line kg, order
 * totals and payment position. frontend/src/utils/orderMath.js mirrors this
 * file; both are pinned by backend/tests/fixtures/order-math-vectors.json.
 *
 * DECIMAL columns arrive as strings — every function parses its inputs.
 */

const isPieces = (line) => line.unit === "PIECES";

// 0.375 / "0.3750" → 3750n at scale 4. Inputs are DB decimals (≤ 4 dp) or form numbers.
const toScaled = (value, scale) => BigInt(Number(value).toFixed(scale).replace(".", ""));

/**
 * ₹ for a pieces line: quantity × price ÷ count, rounded half-up to the paisa
 * with exact integer arithmetic, so it matches Postgres ROUND(numeric, 2).
 */
const piecesAmount = (quantityPieces, priceAmount, pricePiecesCount) => {
  const numerator = BigInt(quantityPieces) * toScaled(priceAmount, 4); // ₹ × 10^4
  const denominator = BigInt(pricePiecesCount) * 100n; // → paise
  const paise = (2n * numerator + denominator) / (2n * denominator);
  return Number(paise) / 100;
};

const lineAmount = (line, size = line.productSize) => {
  if (isPieces(line)) {
    return piecesAmount(line.quantity_pieces, line.price_amount, line.price_pieces_count);
  }
  // Byte-for-byte the pre-pieces expression. Do not "improve" it: every
  // existing order total depends on it staying identical.
  return parseFloat(line.quantity_kg) * parseFloat(line.rate_per_kg || size.rate_per_kg);
};

const lineKg = (line) => {
  if (!isPieces(line)) return parseFloat(line.quantity_kg);
  if (line.weight_kg == null || line.weight_pieces_count == null) return null;
  return (Number(line.quantity_pieces) * parseFloat(line.weight_kg)) / Number(line.weight_pieces_count);
};

const linePieces = (line) => (isPieces(line) ? Number(line.quantity_pieces) : 0);

const plateCharge = (order) => parseFloat(order.custom_plate_charge || order.plateType?.charge || 0);

const orderTotal = (order) => {
  const productAmount = (order.orderProductSizes || []).reduce((sum, line) => sum + lineAmount(line), 0);
  return productAmount + plateCharge(order) - parseFloat(order.round_off_amount || 0);
};

/**
 * The advance rule: an order's advance is EITHER the sum of its ADVANCE
 * payments (when any exist) OR the legacy advance_received column — never both.
 */
const paymentPosition = (order, total = orderTotal(order)) => {
  const payments = order.payments || [];
  const sum = (list) => list.reduce((acc, p) => acc + parseFloat(p.amount), 0);
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

const round3 = (x) => Math.round(x * 1000) / 1000;

/** Each line lands in exactly one bucket — the no-double-counting rule. */
const volumeSummary = (orders) => {
  let kgFromKgLines = 0;
  let kgFromPieces = 0;
  let piecesTotal = 0;
  let piecesWithoutWeight = 0;
  for (const order of orders) {
    for (const line of order.orderProductSizes || []) {
      if (!isPieces(line)) {
        kgFromKgLines += parseFloat(line.quantity_kg || 0);
        continue;
      }
      const pieces = linePieces(line);
      piecesTotal += pieces;
      const kg = lineKg(line);
      if (kg === null) piecesWithoutWeight += pieces;
      else kgFromPieces += kg;
    }
  }
  return {
    kgFromKgLines: round3(kgFromKgLines),
    kgFromPieces: round3(kgFromPieces),
    kgSold: round3(kgFromKgLines + kgFromPieces),
    piecesTotal,
    piecesWithoutWeight,
  };
};

module.exports = { piecesAmount, lineAmount, lineKg, linePieces, plateCharge, orderTotal, paymentPosition, volumeSummary };
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/orderMath.test.js`
Expected: PASS (all vector cases).

- [ ] **Step 7: Commit**

```bash
git add backend/tests/fixtures/order-math-vectors.json backend/src/services/orderMath.js backend/tests/orderMath.test.js
git commit -m "feat(orders): shared order math module with pieces support

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Frontend order math, formatters, Vitest

**Files:**
- Modify: `frontend/package.json` (devDependency `vitest`, script `test`)
- Create: `frontend/src/utils/orderMath.js`, `frontend/src/utils/orderMath.test.js`
- Modify: `frontend/src/utils/formatters.js`
- Create: `frontend/src/utils/formatters.test.js`

**Interfaces:**
- Consumes: vector file from Task 1.
- Produces (ESM): same names/semantics as Task 1 (`piecesAmount, lineAmount, lineKg, linePieces, plateCharge, orderTotal, paymentPosition, volumeSummary`). **Frontend `lineAmount(line, size)` requires `size` for KG lines when `line.productSize` is absent.**
- Produces formatters: `formatNumber(n, maxFrac = 3)`, `formatKg(kg)`, `formatPiecePrice(amount, count)`, `perPiecePriceHint(amount, count)`, `perPieceWeightHint(kg, count)`, `formatSizePricing(size)`, `formatLineQuantity(item)`, `formatLineRate(item)`, `formatLineKg(item)`, `formatInvoiceQty(item)`, `formatInvoiceRate(item)`.

- [ ] **Step 1: Install Vitest**

Run: `cd frontend && npm install --save-dev vitest@^3.2.7`
Then add to `package.json` `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 2: Write the failing tests**

`frontend/src/utils/orderMath.test.js`:

```js
import { readFileSync } from "node:fs";
import { describe, test, expect } from "vitest";
import * as m from "./orderMath";

const vectors = JSON.parse(
  readFileSync(new URL("../../../backend/tests/fixtures/order-math-vectors.json", import.meta.url), "utf8")
);

describe("orderMath (same vectors as the backend)", () => {
  test.each(vectors.lineAmount)("lineAmount: $name", ({ line, size, expected }) => {
    expect(m.lineAmount(line, size)).toBeCloseTo(expected, 6);
  });
  test.each(vectors.lineKg)("lineKg: $name", ({ line, expected }) => {
    if (expected === null) expect(m.lineKg(line)).toBeNull();
    else expect(m.lineKg(line)).toBeCloseTo(expected, 6);
  });
  test.each(vectors.linePieces)("linePieces: $name", ({ line, expected }) => {
    expect(m.linePieces(line)).toBe(expected);
  });
  test.each(vectors.orders)("orderTotal + paymentPosition: $name", ({ order, expected }) => {
    const total = m.orderTotal(order);
    expect(total).toBeCloseTo(expected.total, 6);
    const pos = m.paymentPosition(order, total);
    expect(pos.remaining).toBeCloseTo(expected.remaining, 6);
    expect(pos.totalReceived).toBeCloseTo(expected.totalReceived, 6);
  });
  test.each(vectors.volume)("volumeSummary: $name", ({ orders, expected }) => {
    expect(m.volumeSummary(orders)).toEqual(expected);
  });
});
```

`frontend/src/utils/formatters.test.js`:

```js
import { describe, test, expect } from "vitest";
import { formatPiecePrice, perPiecePriceHint, perPieceWeightHint, formatSizePricing, formatLineQuantity, formatLineKg, formatInvoiceQty, formatInvoiceRate } from "./formatters";

describe("piece formatters", () => {
  test("price per 1 piece", () => expect(formatPiecePrice("0.5000", 1)).toBe("₹0.50/pc"));
  test("price per N pieces keeps what was typed", () => expect(formatPiecePrice("375.0000", 1000)).toBe("₹375.00 / 1,000 pcs"));
  test("price with 3 decimals", () => expect(formatPiecePrice("0.3750", 1)).toBe("₹0.375/pc"));
  test("per-piece hints", () => {
    expect(perPiecePriceHint(375, 1000)).toBe("= ₹0.375 per piece");
    expect(perPieceWeightHint(100, 10000)).toBe("≈ 10 g per piece");
  });
  test("size pricing summary", () => {
    expect(formatSizePricing({ rate_per_kg: "180.00", piece_price_amount: "0.5000", piece_price_count: 1, weight_kg: "100.000", weight_pieces_count: 10000 }))
      .toBe("₹180.00/kg · ₹0.50/pc · 10 g/pc");
    expect(formatSizePricing({ rate_per_kg: "180.00", piece_price_amount: null, weight_kg: null })).toBe("₹180.00/kg · — · —");
  });
  test("line quantity and kg text", () => {
    expect(formatLineQuantity({ unit: "KG", quantity_kg: "50.00" })).toBe("50 kg");
    expect(formatLineQuantity({ unit: "PIECES", quantity_pieces: 5000 })).toBe("5,000 pcs");
    expect(formatLineKg({ unit: "PIECES", quantity_pieces: 5000, weight_kg: "100.000", weight_pieces_count: 10000, weight_source: "SIZE" })).toBe("≈ 50 kg");
    expect(formatLineKg({ unit: "PIECES", quantity_pieces: 5000, weight_kg: "0.011", weight_pieces_count: 1, weight_source: "MANUAL" })).toBe("≈ 55 kg (measured)");
    expect(formatLineKg({ unit: "PIECES", quantity_pieces: 5000, weight_kg: null, weight_pieces_count: null })).toBe("kg: weight not set");
    expect(formatLineKg({ unit: "KG", quantity_kg: "5.00" })).toBeNull();
  });
  test("invoice items: legacy (unit null) unchanged, new ones labelled", () => {
    expect(formatInvoiceQty({ unit: null, quantity: "50.00" })).toBe("50.00");
    expect(formatInvoiceQty({ unit: "KG", quantity: "50.00" })).toBe("50 kg");
    expect(formatInvoiceQty({ unit: "PIECES", quantity: "5000.00" })).toBe("5,000 pcs");
    expect(formatInvoiceRate({ unit: "PIECES", unit_price: "0.38", price_amount: "375.0000", price_pieces_count: 1000 })).toBe("₹375.00 / 1,000 pcs");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL — cannot resolve `./orderMath`; missing formatter exports.

- [ ] **Step 4: Implement `frontend/src/utils/orderMath.js`**

```js
/**
 * Order math — mirror of backend/src/services/orderMath.js. Both are pinned by
 * backend/tests/fixtures/order-math-vectors.json; change them together.
 * DECIMAL fields from the API are strings — every function parses its inputs.
 */

const isPieces = (line) => line.unit === "PIECES";

const toScaled = (value, scale) => BigInt(Number(value).toFixed(scale).replace(".", ""));

export const piecesAmount = (quantityPieces, priceAmount, pricePiecesCount) => {
  const numerator = BigInt(quantityPieces) * toScaled(priceAmount, 4);
  const denominator = BigInt(pricePiecesCount) * 100n;
  const paise = (2n * numerator + denominator) / (2n * denominator);
  return Number(paise) / 100;
};

export const lineAmount = (line, size = line.productSize) => {
  if (isPieces(line)) {
    return piecesAmount(line.quantity_pieces, line.price_amount, line.price_pieces_count);
  }
  // Byte-for-byte the pre-pieces expression — existing totals depend on it.
  return parseFloat(line.quantity_kg) * parseFloat(line.rate_per_kg || size.rate_per_kg);
};

export const lineKg = (line) => {
  if (!isPieces(line)) return parseFloat(line.quantity_kg);
  if (line.weight_kg == null || line.weight_kg === "" || line.weight_pieces_count == null || line.weight_pieces_count === "") return null;
  return (Number(line.quantity_pieces) * parseFloat(line.weight_kg)) / Number(line.weight_pieces_count);
};

export const linePieces = (line) => (isPieces(line) ? Number(line.quantity_pieces) : 0);

export const plateCharge = (order) => parseFloat(order.custom_plate_charge || order.plateType?.charge || 0);

export const orderTotal = (order) => {
  const productAmount = (order.orderProductSizes || []).reduce((sum, line) => sum + lineAmount(line), 0);
  return productAmount + plateCharge(order) - parseFloat(order.round_off_amount || 0);
};

export const paymentPosition = (order, total = orderTotal(order)) => {
  const payments = order.payments || [];
  const sum = (list) => list.reduce((acc, p) => acc + parseFloat(p.amount), 0);
  const totalPaid = sum(payments.filter((p) => p.payment_type !== "ADVANCE"));
  const advanceFromPayments = sum(payments.filter((p) => p.payment_type === "ADVANCE"));
  const advanceReceived = advanceFromPayments > 0 ? advanceFromPayments : parseFloat(order.advance_received || 0);
  return { totalPaid, advanceReceived, totalReceived: totalPaid + advanceReceived, remaining: total - totalPaid - advanceReceived };
};

const round3 = (x) => Math.round(x * 1000) / 1000;

export const volumeSummary = (orders) => {
  let kgFromKgLines = 0;
  let kgFromPieces = 0;
  let piecesTotal = 0;
  let piecesWithoutWeight = 0;
  for (const order of orders) {
    for (const line of order.orderProductSizes || []) {
      if (!isPieces(line)) {
        kgFromKgLines += parseFloat(line.quantity_kg || 0);
        continue;
      }
      const pieces = linePieces(line);
      piecesTotal += pieces;
      const kg = lineKg(line);
      if (kg === null) piecesWithoutWeight += pieces;
      else kgFromPieces += kg;
    }
  }
  return {
    kgFromKgLines: round3(kgFromKgLines),
    kgFromPieces: round3(kgFromPieces),
    kgSold: round3(kgFromKgLines + kgFromPieces),
    piecesTotal,
    piecesWithoutWeight,
  };
};
```

- [ ] **Step 5: Append to `frontend/src/utils/formatters.js`**

```js
import { lineKg } from "./orderMath";

/** Indian digit grouping, up to maxFrac decimals: 10000 → "10,000". */
export const formatNumber = (n, maxFrac = 3) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: maxFrac }).format(Number(n));

export const formatKg = (kg) => `${formatNumber(kg, 2)} kg`;

// ₹ with 2–4 decimals: 0.375 → "₹0.375", 375 → "₹375.00".
const rupees = (amount) =>
  `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(amount))}`;

/** A pieces price exactly as it was entered: "₹0.50/pc" or "₹375.00 / 1,000 pcs". */
export const formatPiecePrice = (amount, count) =>
  Number(count) === 1 ? `${rupees(amount)}/pc` : `${rupees(amount)} / ${formatNumber(count)} pcs`;

export const perPiecePriceHint = (amount, count) => `= ${rupees(Number(amount) / Number(count))} per piece`;

export const perPieceWeightHint = (kg, count) => `≈ ${formatNumber((Number(kg) / Number(count)) * 1000, 2)} g per piece`;

const hasValue = (v) => v !== null && v !== undefined && v !== "";

/** Product-size list summary: "₹180.00/kg · ₹0.50/pc · 10 g/pc" ("—" when unset). */
export const formatSizePricing = (size) => {
  const kg = hasValue(size.rate_per_kg) ? `${formatCurrency(size.rate_per_kg)}/kg` : "—";
  const pcs = hasValue(size.piece_price_amount) ? formatPiecePrice(size.piece_price_amount, size.piece_price_count) : "—";
  const weight = hasValue(size.weight_kg)
    ? `${formatNumber((Number(size.weight_kg) / Number(size.weight_pieces_count)) * 1000, 2)} g/pc`
    : "—";
  return `${kg} · ${pcs} · ${weight}`;
};

export const formatLineQuantity = (item) =>
  item.unit === "PIECES" ? `${formatNumber(item.quantity_pieces)} pcs` : `${parseFloat(item.quantity_kg)} kg`;

export const formatLineRate = (item) =>
  item.unit === "PIECES"
    ? formatPiecePrice(item.price_amount, item.price_pieces_count)
    : `${formatCurrency(item.rate_per_kg || item.productSize?.rate_per_kg)}/kg`;

/** Estimated kg text for a pieces line; null for kg lines. */
export const formatLineKg = (item) => {
  if (item.unit !== "PIECES") return null;
  const kg = lineKg(item);
  if (kg === null) return "kg: weight not set";
  return `≈ ${formatKg(kg)}${item.weight_source === "MANUAL" ? " (measured)" : ""}`;
};

/** Invoice items: unit NULL = created before pieces existed → show exactly as before. */
export const formatInvoiceQty = (item) => {
  if (item.unit === "PIECES") return `${formatNumber(item.quantity)} pcs`;
  if (item.unit === "KG") return `${parseFloat(item.quantity)} kg`;
  return item.quantity;
};

export const formatInvoiceRate = (item) => {
  if (item.unit === "PIECES") return formatPiecePrice(item.price_amount, item.price_pieces_count);
  if (item.unit === "KG") return `${formatCurrency(item.unit_price)}/kg`;
  return formatCurrency(item.unit_price);
};
```

Move the `import { lineKg } from "./orderMath";` line to the top of the file with the other imports (formatters.js currently has none — put it on line 1).

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS. If `formatCurrency` output differs for `₹180.00/kg` (it uses `Intl` currency style → "₹180.00"), the expectation already matches that.

- [ ] **Step 7: Lint touched files**

Run: `cd frontend && npx eslint src/utils/orderMath.js src/utils/orderMath.test.js src/utils/formatters.js src/utils/formatters.test.js`
Expected: no errors. (If `no-undef` flags `BigInt` literal syntax, raise `ecmaVersion` in `eslint.config.js` `languageOptions` from `2020` to `'latest'`.)

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/utils/orderMath.js frontend/src/utils/orderMath.test.js frontend/src/utils/formatters.js frontend/src/utils/formatters.test.js
git commit -m "feat(frontend): order math mirror + piece formatters, vitest on shared vectors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Before staging `frontend/package-lock.json`, run `git diff --stat frontend/package-lock.json` — the diff must contain only the vitest additions (the owner has had local changes to this file before).

---

### Task 3: Migration, models, test harness

**Files:**
- Create: `backend/src/migrations/20260930000001-add-piece-orders.js`
- Modify: `backend/src/models/productSize.js`, `orderProductSize.js`, `invoiceItem.js`
- Modify: `backend/tests/setup.js`
- Create: `backend/tests/helpers/orderFactories.js`, `backend/tests/helpers/http.js`
- Test: `backend/tests/pieceOrdersMigration.test.js`

**Interfaces:**
- Produces DB columns exactly as spec §1; enum types `enum_order_product_sizes_unit`, `enum_order_product_sizes_weight_source`, `enum_invoice_items_unit`.
- Produces test helpers: `createCustomer(name?)`, `createPlateType(charge = "1500.00")`, `createSize(fields = {})`, `createOrderWithLines({ customer, plateType, lines, ...orderFields })`, `mockRes()`.

- [ ] **Step 1: Test harness — truncate original-module tables too**

In `backend/tests/setup.js`, extend `TABLES` (keep existing entries, add these at the top of the array):

```js
  "invoice_items",
  "payments",
  "invoices",
  "order_product_sizes",
  "orders",
  "product_sizes",
  "plate_types",
  "customers",
  "audit_logs",
```

`backend/tests/helpers/http.js`:

```js
"use strict";

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
};

module.exports = { mockRes };
```

`backend/tests/helpers/orderFactories.js`:

```js
"use strict";

const db = require("../../src/models");

const rand = () => Math.random().toString(36).slice(2, 8);

const createCustomer = (name = `Customer-${rand()}`) => db.Customer.create({ name });

const createPlateType = (charge = "1500.00") => db.PlateType.create({ type_name: `Plate-${rand()}`, charge });

const createSize = (fields = {}) => db.ProductSize.create({ size_label: `S-${rand()}`, rate_per_kg: "180.00", ...fields });

const createOrderWithLines = async ({ customer, plateType, lines, ...orderFields }) => {
  const order = await db.Order.create({
    customer_id: customer.id,
    plate_type_id: plateType.id,
    order_date: "2026-09-01",
    ...orderFields,
  });
  for (const line of lines) {
    await db.OrderProductSize.create({ order_id: order.id, ...line });
  }
  return order;
};

module.exports = { createCustomer, createPlateType, createSize, createOrderWithLines };
```

- [ ] **Step 2: Write the failing migration test**

`backend/tests/pieceOrdersMigration.test.js`:

```js
"use strict";

const { Sequelize } = require("sequelize");
const db = require("../src/models");
const migration = require("../src/migrations/20260930000001-add-piece-orders");

const qi = db.sequelize.getQueryInterface();
const q = (sql) => db.sequelize.query(sql).then(([rows]) => rows);

const hasColumn = async (table, column) =>
  (await q(`SELECT 1 FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${column}'`)).length > 0;

// Leave the schema migrated no matter how a test exits — later suites need it.
afterAll(async () => {
  if (!(await hasColumn("order_product_sizes", "unit"))) await migration.up(qi, Sequelize);
});

describe("migration 20260930000001-add-piece-orders", () => {
  test("existing rows keep every value; old lines become KG with no pieces fields", async () => {
    await migration.down(qi, Sequelize);

    // Legacy-shaped data, written with raw SQL because the models already know the new columns.
    await q(`INSERT INTO customers (id, name, is_archived, metadata, created_at, updated_at)
             VALUES ('11111111-1111-1111-1111-111111111111', 'Legacy Co', false, '{}', now(), now())`);
    await q(`INSERT INTO plate_types (id, type_name, charge, is_archived, created_at, updated_at)
             VALUES ('22222222-2222-2222-2222-222222222222', '4 Colour', 1500.00, false, now(), now())`);
    await q(`INSERT INTO product_sizes (id, size_label, rate_per_kg, is_archived, created_at, updated_at)
             VALUES ('33333333-3333-3333-3333-333333333333', '8x10', 180.00, false, now(), now())`);
    await q(`INSERT INTO orders (id, customer_id, order_date, advance_received, plate_type_id, status, is_archived, round_off_amount, created_at, updated_at)
             VALUES ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '2026-01-05', 2000.00,
                     '22222222-2222-2222-2222-222222222222', 'DELIVERED', false, 5.00, now(), now())`);
    await q(`INSERT INTO order_product_sizes (id, order_id, product_size_id, quantity_kg, rate_per_kg)
             VALUES ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444',
                     '33333333-3333-3333-3333-333333333333', 12.35, 181.25)`);
    await q(`INSERT INTO invoices (id, customer_id, invoice_number, invoice_date, billing_period_start, billing_period_end, total_amount, tax_percent, tax_amount, final_amount, status, is_archived, created_at, updated_at)
             VALUES ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '00000001', '2026-01-31', '2026-01-01', '2026-01-31',
                     3733.44, 0, 0, 3733.44, 'PENDING', false, now(), now())`);
    await q(`INSERT INTO invoice_items (id, invoice_id, order_id, description, quantity, unit_price, total_price, created_at, updated_at)
             VALUES ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444',
                     '8x10 (2026-01-05)', 12.35, 181.25, 2238.44, now(), now())`);

    const snapshot = async () => ({
      sizes: await q(`SELECT id, size_label, rate_per_kg, is_archived FROM product_sizes ORDER BY id`),
      orders: await q(`SELECT id, advance_received, round_off_amount, status FROM orders ORDER BY id`),
      lines: await q(`SELECT id, order_id, product_size_id, quantity_kg, rate_per_kg FROM order_product_sizes ORDER BY id`),
      invoices: await q(`SELECT id, total_amount, tax_amount, final_amount FROM invoices ORDER BY id`),
      items: await q(`SELECT id, description, quantity, unit_price, total_price FROM invoice_items ORDER BY id`),
    });

    const before = await snapshot();
    await migration.up(qi, Sequelize);
    expect(await snapshot()).toEqual(before);

    const [line] = await q(`SELECT unit, quantity_pieces, price_amount, price_pieces_count, weight_kg, weight_pieces_count, weight_source FROM order_product_sizes`);
    expect(line).toEqual({ unit: "KG", quantity_pieces: null, price_amount: null, price_pieces_count: null, weight_kg: null, weight_pieces_count: null, weight_source: null });
    const [item] = await q(`SELECT unit, price_amount, price_pieces_count FROM invoice_items`);
    expect(item).toEqual({ unit: null, price_amount: null, price_pieces_count: null });
  });

  describe("constraints", () => {
    let order;
    let size;
    beforeEach(async () => {
      const customer = await db.Customer.create({ name: "C" });
      const plate = await db.PlateType.create({ type_name: "P", charge: "100.00" });
      size = await db.ProductSize.create({ size_label: "8x10", rate_per_kg: "180.00" });
      order = await db.Order.create({ customer_id: customer.id, plate_type_id: plate.id, order_date: "2026-09-01" });
    });

    const insertLine = (fields) => db.OrderProductSize.create({ order_id: order.id, product_size_id: size.id, ...fields });

    test("a valid PIECES line is accepted", async () => {
      await expect(insertLine({ unit: "PIECES", quantity_pieces: 5000, price_amount: "0.5", price_pieces_count: 1 })).resolves.toBeTruthy();
    });

    test("a line cannot be both kg and pieces", async () => {
      await expect(insertLine({ unit: "PIECES", quantity_kg: "10", quantity_pieces: 5000, price_amount: "0.5", price_pieces_count: 1 })).rejects.toThrow(/order_product_sizes_unit_chk/);
      await expect(insertLine({ unit: "KG", quantity_kg: "10", rate_per_kg: "180", quantity_pieces: 5000 })).rejects.toThrow(/order_product_sizes_unit_chk/);
    });

    test("a PIECES line needs a price and no kg rate", async () => {
      await expect(insertLine({ unit: "PIECES", quantity_pieces: 5000 })).rejects.toThrow(/order_product_sizes_unit_chk/);
      await expect(insertLine({ unit: "PIECES", quantity_pieces: 5000, price_amount: "0.5", price_pieces_count: 1, rate_per_kg: "180" })).rejects.toThrow(/order_product_sizes_unit_chk/);
    });

    test("weight is all-or-nothing and positive", async () => {
      await expect(insertLine({ unit: "PIECES", quantity_pieces: 10, price_amount: "1", price_pieces_count: 1, weight_kg: "1" })).rejects.toThrow(/order_product_sizes_unit_chk/);
      await expect(insertLine({ unit: "PIECES", quantity_pieces: 10, price_amount: "1", price_pieces_count: 1, weight_kg: "0", weight_pieces_count: 100, weight_source: "SIZE" })).rejects.toThrow(/order_product_sizes_values_chk/);
    });

    test("a size needs at least one price and complete pairs", async () => {
      await expect(db.ProductSize.create({ size_label: "X", rate_per_kg: null })).rejects.toThrow(/product_sizes_has_price_chk/);
      await expect(db.ProductSize.create({ size_label: "X", rate_per_kg: null, piece_price_amount: "0.5", piece_price_count: 1 })).resolves.toBeTruthy();
      await expect(db.ProductSize.create({ size_label: "Y", rate_per_kg: "100", weight_kg: "1" })).rejects.toThrow(/product_sizes_weight_pair_chk/);
    });

    test("down refuses once pieces lines exist", async () => {
      await insertLine({ unit: "PIECES", quantity_pieces: 5000, price_amount: "0.5", price_pieces_count: 1 });
      await expect(migration.down(qi, Sequelize)).rejects.toThrow(/Refusing to roll back/);
      expect(await hasColumn("order_product_sizes", "unit")).toBe(true);
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/pieceOrdersMigration.test.js`
Expected: FAIL — cannot find the migration module.

- [ ] **Step 4: Write the migration**

`backend/src/migrations/20260930000001-add-piece-orders.js`:

```js
"use strict";

/**
 * Piece-based orders — spec: docs/superpowers/specs/2026-09-30-piece-orders-design.md
 *
 * Purely additive on real customer data: new nullable columns, one NOT NULL
 * column whose constant default ('KG') Postgres stores in the catalog (no
 * table rewrite), and DROP NOT NULLs. No existing value is written. One
 * transaction: if any existing row violated a new CHECK, nothing changes.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });

      await run(`CREATE TYPE "enum_order_product_sizes_unit" AS ENUM ('KG', 'PIECES');`);
      await run(`CREATE TYPE "enum_order_product_sizes_weight_source" AS ENUM ('SIZE', 'MANUAL');`);
      await run(`CREATE TYPE "enum_invoice_items_unit" AS ENUM ('KG', 'PIECES');`);

      // --- product_sizes ---------------------------------------------------
      await run(`
        ALTER TABLE product_sizes
          ALTER COLUMN rate_per_kg DROP NOT NULL,
          ADD COLUMN piece_price_amount DECIMAL(12,4),
          ADD COLUMN piece_price_count INTEGER,
          ADD COLUMN weight_kg DECIMAL(12,3),
          ADD COLUMN weight_pieces_count INTEGER;`);
      await run(`
        ALTER TABLE product_sizes
          ADD CONSTRAINT product_sizes_piece_price_pair_chk
            CHECK ((piece_price_amount IS NULL) = (piece_price_count IS NULL)),
          ADD CONSTRAINT product_sizes_piece_price_values_chk
            CHECK (piece_price_count IS NULL OR (piece_price_count >= 1 AND piece_price_amount >= 0)),
          ADD CONSTRAINT product_sizes_weight_pair_chk
            CHECK ((weight_kg IS NULL) = (weight_pieces_count IS NULL)),
          ADD CONSTRAINT product_sizes_weight_values_chk
            CHECK (weight_pieces_count IS NULL OR (weight_pieces_count >= 1 AND weight_kg > 0)),
          ADD CONSTRAINT product_sizes_has_price_chk
            CHECK (rate_per_kg IS NOT NULL OR piece_price_amount IS NOT NULL);`);

      // --- order_product_sizes ---------------------------------------------
      await run(`
        ALTER TABLE order_product_sizes
          ALTER COLUMN quantity_kg DROP NOT NULL,
          ALTER COLUMN rate_per_kg DROP NOT NULL,
          ADD COLUMN unit "enum_order_product_sizes_unit" NOT NULL DEFAULT 'KG',
          ADD COLUMN quantity_pieces INTEGER,
          ADD COLUMN price_amount DECIMAL(12,4),
          ADD COLUMN price_pieces_count INTEGER,
          ADD COLUMN weight_kg DECIMAL(12,3),
          ADD COLUMN weight_pieces_count INTEGER,
          ADD COLUMN weight_source "enum_order_product_sizes_weight_source";`);
      await run(`
        ALTER TABLE order_product_sizes
          ADD CONSTRAINT order_product_sizes_values_chk CHECK (
            (quantity_pieces IS NULL OR quantity_pieces >= 1)
            AND (price_pieces_count IS NULL OR (price_pieces_count >= 1 AND price_amount >= 0))
            AND (weight_pieces_count IS NULL OR (weight_pieces_count >= 1 AND weight_kg > 0))
          ),
          -- The no-double-counting rule: a line is exactly one of KG / PIECES.
          -- The KG branch deliberately does not require rate_per_kg (legacy
          -- rows may rely on the size's rate).
          ADD CONSTRAINT order_product_sizes_unit_chk CHECK (
            (unit = 'KG'
              AND quantity_kg IS NOT NULL
              AND quantity_pieces IS NULL AND price_amount IS NULL AND price_pieces_count IS NULL
              AND weight_kg IS NULL AND weight_pieces_count IS NULL AND weight_source IS NULL)
            OR
            (unit = 'PIECES'
              AND quantity_pieces IS NOT NULL AND quantity_kg IS NULL AND rate_per_kg IS NULL
              AND price_amount IS NOT NULL AND price_pieces_count IS NOT NULL
              AND ((weight_kg IS NULL AND weight_pieces_count IS NULL AND weight_source IS NULL)
                OR (weight_kg IS NOT NULL AND weight_pieces_count IS NOT NULL AND weight_source IS NOT NULL)))
          );`);

      // --- invoice_items -----------------------------------------------------
      await run(`
        ALTER TABLE invoice_items
          ADD COLUMN unit "enum_invoice_items_unit",
          ADD COLUMN price_amount DECIMAL(12,4),
          ADD COLUMN price_pieces_count INTEGER;`);
      await run(`
        ALTER TABLE invoice_items
          ADD CONSTRAINT invoice_items_price_pair_chk
            CHECK ((price_amount IS NULL) = (price_pieces_count IS NULL));`);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });

      // Rolling back would destroy pieces data / leave kg-less sizes invalid.
      const [[{ lines }]] = await run(`SELECT COUNT(*)::int AS lines FROM order_product_sizes WHERE unit = 'PIECES'`);
      const [[{ sizes }]] = await run(`SELECT COUNT(*)::int AS sizes FROM product_sizes WHERE rate_per_kg IS NULL`);
      if (lines > 0 || sizes > 0) {
        throw new Error(`Refusing to roll back: ${lines} pieces order lines and ${sizes} sizes without a kg rate exist.`);
      }

      await run(`
        ALTER TABLE invoice_items
          DROP CONSTRAINT invoice_items_price_pair_chk,
          DROP COLUMN unit, DROP COLUMN price_amount, DROP COLUMN price_pieces_count;`);
      await run(`
        ALTER TABLE order_product_sizes
          DROP CONSTRAINT order_product_sizes_unit_chk,
          DROP CONSTRAINT order_product_sizes_values_chk,
          DROP COLUMN unit, DROP COLUMN quantity_pieces, DROP COLUMN price_amount,
          DROP COLUMN price_pieces_count, DROP COLUMN weight_kg, DROP COLUMN weight_pieces_count,
          DROP COLUMN weight_source,
          ALTER COLUMN quantity_kg SET NOT NULL,
          ALTER COLUMN rate_per_kg SET NOT NULL;`);
      await run(`
        ALTER TABLE product_sizes
          DROP CONSTRAINT product_sizes_piece_price_pair_chk,
          DROP CONSTRAINT product_sizes_piece_price_values_chk,
          DROP CONSTRAINT product_sizes_weight_pair_chk,
          DROP CONSTRAINT product_sizes_weight_values_chk,
          DROP CONSTRAINT product_sizes_has_price_chk,
          DROP COLUMN piece_price_amount, DROP COLUMN piece_price_count,
          DROP COLUMN weight_kg, DROP COLUMN weight_pieces_count,
          ALTER COLUMN rate_per_kg SET NOT NULL;`);
      await run(`DROP TYPE "enum_invoice_items_unit";`);
      await run(`DROP TYPE "enum_order_product_sizes_weight_source";`);
      await run(`DROP TYPE "enum_order_product_sizes_unit";`);
    });
  },
};
```

- [ ] **Step 5: Update the models**

`backend/src/models/productSize.js` — in `rate_per_kg`, change `allowNull: false,` to `allowNull: true, // NULL = sold only by pieces (at least one price is DB-enforced)`; then add after the `rate_per_kg` block:

```js
      // "N pieces cost ₹X" — stored exactly as typed (see services/orderMath.js).
      piece_price_amount: { type: DataTypes.DECIMAL(12, 4), allowNull: true },
      piece_price_count: { type: DataTypes.INTEGER, allowNull: true },
      // "N pieces weigh W kg" — used only to estimate kg of pieces lines.
      weight_kg: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
      weight_pieces_count: { type: DataTypes.INTEGER, allowNull: true },
```

`backend/src/models/orderProductSize.js` — in both `quantity_kg` and `rate_per_kg`, change `allowNull: false,` to `allowNull: true,`; add after `rate_per_kg`:

```js
      // KG lines use quantity_kg/rate_per_kg; PIECES lines use the fields
      // below. A DB CHECK guarantees a line is exactly one of the two.
      unit: { type: DataTypes.ENUM("KG", "PIECES"), allowNull: false, defaultValue: "KG" },
      quantity_pieces: { type: DataTypes.INTEGER, allowNull: true },
      price_amount: { type: DataTypes.DECIMAL(12, 4), allowNull: true },
      price_pieces_count: { type: DataTypes.INTEGER, allowNull: true },
      weight_kg: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
      weight_pieces_count: { type: DataTypes.INTEGER, allowNull: true },
      weight_source: { type: DataTypes.ENUM("SIZE", "MANUAL"), allowNull: true },
```

`backend/src/models/invoiceItem.js` — add after `total_price`:

```js
      // NULL for plate-charge/advance rows and for every item created before
      // piece orders existed (those render exactly as before).
      unit: { type: DataTypes.ENUM("KG", "PIECES"), allowNull: true },
      price_amount: { type: DataTypes.DECIMAL(12, 4), allowNull: true },
      price_pieces_count: { type: DataTypes.INTEGER, allowNull: true },
```

- [ ] **Step 6: Apply the migration to the test DB and run the test**

Run: `cd backend && npm run test:migrate && npx cross-env NODE_ENV=test jest tests/pieceOrdersMigration.test.js`
Expected: `20260930000001-add-piece-orders: migrated`; test PASS.

- [ ] **Step 7: Run the whole suite (nothing else regressed)**

Run: `cd backend && npm test`
Expected: all suites pass (120 existing + new).

- [ ] **Step 8: Commit**

```bash
git add backend/src/migrations/20260930000001-add-piece-orders.js backend/src/models/productSize.js backend/src/models/orderProductSize.js backend/src/models/invoiceItem.js backend/tests/setup.js backend/tests/helpers/orderFactories.js backend/tests/helpers/http.js backend/tests/pieceOrdersMigration.test.js
git commit -m "feat(db): additive migration for piece-based order lines

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Pair validation + product-size API with weight back-fill

**Files:**
- Create: `backend/src/services/pieceFields.js`
- Modify: `backend/src/controllers/productSizeController.js`
- Test: `backend/tests/productSizeController.test.js`

**Interfaces:**
- Produces `pieceFields.js`: `isBlank(v) → boolean`; `parsePair(amountRaw, countRaw, label, { positive }) → { value: { amount:number, count:number } | null } | { error: string }`; `class LineError extends Error`.
- Produces API: `POST/PUT /api/product-sizes` accept `rate_per_kg` (optional), `piece_price_amount`, `piece_price_count`, `weight_kg`, `weight_pieces_count`. `PUT` response `data` = size JSON + `backfilled_lines: number`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/productSizeController.test.js`:

```js
"use strict";

const db = require("../src/models");
const { createProductSize, updateProductSize } = require("../src/controllers/productSizeController");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const call = async (fn, req) => {
  const res = mockRes();
  await fn(req, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe("product sizes — pricing fields", () => {
  test("old client (rate only) still works", async () => {
    const { status, body } = await call(createProductSize, { body: { size_label: "8x10", rate_per_kg: 180 } });
    expect(status).toBe(201);
    expect(body.data.piece_price_amount).toBeNull();
  });

  test("piece-only size is allowed", async () => {
    const { status, body } = await call(createProductSize, { body: { size_label: "10x12", piece_price_amount: 250, piece_price_count: 100 } });
    expect(status).toBe(201);
    expect(body.data.rate_per_kg).toBeNull();
    expect(Number(body.data.piece_price_amount)).toBe(250);
    expect(body.data.piece_price_count).toBe(100);
  });

  test.each([
    [{ size_label: "A" }, /rate per kg or a piece price/i],
    [{ size_label: "A", rate_per_kg: 100, piece_price_amount: 5 }, /piece price: enter both/i],
    [{ size_label: "A", rate_per_kg: 100, weight_kg: 1, weight_pieces_count: 0 }, /whole number, 1 or more/i],
    [{ size_label: "A", rate_per_kg: 100, weight_kg: 0, weight_pieces_count: 100 }, /greater than 0/i],
    [{ size_label: "A", rate_per_kg: -1 }, /rate per kg/i],
    [{ size_label: "A", rate_per_kg: 100, piece_price_amount: 5, piece_price_count: 2.5 }, /whole number/i],
  ])("rejects %o", async (body, message) => {
    const { status, body: out } = await call(createProductSize, { body });
    expect(status).toBe(400);
    expect(out.message).toMatch(message);
  });
});

describe("product sizes — weight back-fill", () => {
  let size;
  let pieceLineNoWeight;
  let pieceLineManual;
  let otherSizeLine;

  beforeEach(async () => {
    const customer = await createCustomer();
    const plateType = await createPlateType();
    size = await createSize({ piece_price_amount: "0.5", piece_price_count: 1 });
    const other = await createSize({ piece_price_amount: "1", piece_price_count: 1 });
    const order = await createOrderWithLines({
      customer, plateType,
      lines: [
        { product_size_id: size.id, unit: "PIECES", quantity_pieces: 5000, price_amount: "0.5", price_pieces_count: 1 },
        { product_size_id: size.id, unit: "PIECES", quantity_pieces: 100, price_amount: "0.5", price_pieces_count: 1, weight_kg: "2", weight_pieces_count: 100, weight_source: "MANUAL" },
        { product_size_id: size.id, unit: "KG", quantity_kg: "10", rate_per_kg: "180" },
        { product_size_id: other.id, unit: "PIECES", quantity_pieces: 10, price_amount: "1", price_pieces_count: 1 },
      ],
    });
    const lines = await db.OrderProductSize.findAll({ where: { order_id: order.id } });
    pieceLineNoWeight = lines.find((l) => l.quantity_pieces === 5000);
    pieceLineManual = lines.find((l) => l.quantity_pieces === 100);
    otherSizeLine = lines.find((l) => l.product_size_id === other.id);
  });

  const setWeight = (kg, count) =>
    call(updateProductSize, {
      params: { id: size.id },
      body: { size_label: size.size_label, rate_per_kg: size.rate_per_kg, piece_price_amount: "0.5", piece_price_count: 1, weight_kg: kg, weight_pieces_count: count },
    });

  test("fills only NULL-weight pieces lines of that size; money untouched", async () => {
    const { status, body } = await setWeight(100, 10000);
    expect(status).toBe(200);
    expect(body.data.backfilled_lines).toBe(1);

    await pieceLineNoWeight.reload();
    expect(Number(pieceLineNoWeight.weight_kg)).toBe(100);
    expect(pieceLineNoWeight.weight_pieces_count).toBe(10000);
    expect(pieceLineNoWeight.weight_source).toBe("SIZE");
    expect(Number(pieceLineNoWeight.price_amount)).toBe(0.5);

    await pieceLineManual.reload();
    expect(Number(pieceLineManual.weight_kg)).toBe(2);
    expect(pieceLineManual.weight_source).toBe("MANUAL");

    await otherSizeLine.reload();
    expect(otherSizeLine.weight_kg).toBeNull();
  });

  test("second weight change does not overwrite lines that already have a weight", async () => {
    await setWeight(100, 10000);
    const { body } = await setWeight(120, 10000);
    expect(body.data.backfilled_lines).toBe(0);
    await pieceLineNoWeight.reload();
    expect(Number(pieceLineNoWeight.weight_kg)).toBe(100);
  });

  test("removing a size's weight clears nothing", async () => {
    await setWeight(100, 10000);
    await call(updateProductSize, {
      params: { id: size.id },
      body: { size_label: size.size_label, rate_per_kg: size.rate_per_kg, piece_price_amount: "0.5", piece_price_count: 1, weight_kg: "", weight_pieces_count: "" },
    });
    await pieceLineNoWeight.reload();
    expect(Number(pieceLineNoWeight.weight_kg)).toBe(100);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/productSizeController.test.js`
Expected: FAIL (piece-only size rejected with "Size label and rate per kg are required"; no `backfilled_lines`).

- [ ] **Step 3: Implement `backend/src/services/pieceFields.js`**

```js
"use strict";

/** A client-facing validation failure on one order line → HTTP 400. */
class LineError extends Error {}

const isBlank = (v) => v === undefined || v === null || v === "";

/**
 * Parse an "N pieces ↔ amount" pair (a piece price or a weight).
 * Both blank → { value: null }. Half-filled or invalid → { error }.
 * `positive` = amount must be > 0 (weights); otherwise ≥ 0 (prices).
 */
const parsePair = (amountRaw, countRaw, label, { positive }) => {
  if (isBlank(amountRaw) && isBlank(countRaw)) return { value: null };
  if (isBlank(amountRaw) || isBlank(countRaw)) {
    return { error: `${label}: enter both the number of pieces and the amount` };
  }
  const amount = Number(amountRaw);
  const count = Number(countRaw);
  if (!Number.isFinite(amount) || (positive ? amount <= 0 : amount < 0)) {
    return { error: `${label}: amount must be ${positive ? "greater than 0" : "0 or more"}` };
  }
  if (!Number.isInteger(count) || count < 1) {
    return { error: `${label}: number of pieces must be a whole number, 1 or more` };
  }
  return { value: { amount, count } };
};

module.exports = { LineError, isBlank, parsePair };
```

- [ ] **Step 4: Implement the controller changes**

In `backend/src/controllers/productSizeController.js`:

Replace the imports with:

```js
const { ProductSize, OrderProductSize, sequelize } = require("../models");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");
const { isBlank, parsePair } = require("../services/pieceFields");

/**
 * Validate the pricing fields shared by create and update.
 * Returns { fields } ready for the model, or { error }.
 */
const parsePricing = (body) => {
  const rate = isBlank(body.rate_per_kg) ? null : Number(body.rate_per_kg);
  if (rate !== null && (!Number.isFinite(rate) || rate < 0)) return { error: "Rate per kg must be 0 or more" };
  const price = parsePair(body.piece_price_amount, body.piece_price_count, "Piece price", { positive: false });
  if (price.error) return { error: price.error };
  const weight = parsePair(body.weight_kg, body.weight_pieces_count, "Weight", { positive: true });
  if (weight.error) return { error: weight.error };
  if (rate === null && !price.value) return { error: "Enter a rate per kg or a piece price (or both)" };
  return {
    fields: {
      rate_per_kg: rate,
      piece_price_amount: price.value ? price.value.amount : null,
      piece_price_count: price.value ? price.value.count : null,
      weight_kg: weight.value ? weight.value.amount : null,
      weight_pieces_count: weight.value ? weight.value.count : null,
    },
  };
};
```

Replace the body of `createProductSize`'s `try` with:

```js
    const { size_label } = req.body;
    if (!size_label) {
      return error(res, 400, "Size label is required");
    }
    const pricing = parsePricing(req.body);
    if (pricing.error) {
      return error(res, 400, pricing.error);
    }

    const productSize = await ProductSize.create({ size_label, ...pricing.fields });

    return success(res, 201, "Product size created successfully", productSize);
```

Replace `updateProductSize` entirely with:

```js
const updateProductSize = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { size_label } = req.body;

    if (!size_label) {
      await transaction.rollback();
      return error(res, 400, "Size label is required");
    }
    const pricing = parsePricing(req.body);
    if (pricing.error) {
      await transaction.rollback();
      return error(res, 400, pricing.error);
    }

    const productSize = await ProductSize.findOne({ where: { id, is_archived: false }, transaction });
    if (!productSize) {
      await transaction.rollback();
      return error(res, 404, "Product size not found");
    }

    await productSize.update({ size_label, ...pricing.fields }, { transaction });

    // Back-fill (spec §3): pieces lines of this size that have NO weight pick
    // up the new weight once. Lines with any weight — copied earlier or
    // measured — are never overwritten. Money columns are never touched.
    let backfilled = 0;
    if (pricing.fields.weight_kg !== null) {
      [backfilled] = await OrderProductSize.update(
        { weight_kg: pricing.fields.weight_kg, weight_pieces_count: pricing.fields.weight_pieces_count, weight_source: "SIZE" },
        { where: { product_size_id: id, unit: "PIECES", weight_kg: null }, transaction }
      );
    }

    await transaction.commit();
    return success(res, 200, "Product size updated successfully", { ...productSize.toJSON(), backfilled_lines: backfilled });
  } catch (err) {
    await transaction.rollback();
    console.error("Error updating product size:", err);
    return error(res, 500, "Failed to update product size", err.message);
  }
};
```

- [ ] **Step 5: Run tests**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/productSizeController.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/pieceFields.js backend/src/controllers/productSizeController.js backend/tests/productSizeController.test.js
git commit -m "feat(product-sizes): piece price + weight settings, back-fill missing line weights

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Order API — pieces lines, shared math, audit metrics

**Files:**
- Create: `backend/src/services/orderLines.js`
- Modify: `backend/src/controllers/orderController.js`, `backend/src/services/auditService.js`
- Test: `backend/tests/orderController.test.js`

**Interfaces:**
- Consumes: `orderMath` (Task 1), `pieceFields` (Task 4).
- Produces: `buildLineRow(input, size) → row` (throws `LineError`); order API line payload per spec §4; `GET /orders` and `GET /orders/:id` lines carry `line_amount`, `line_kg`; orders carry `volume`; `GET /orders/:id` carries `invoice: { id, invoice_number } | null`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/orderController.test.js`:

```js
"use strict";

const db = require("../src/models");
const { createOrder, updateOrder, getOrderById, getAllOrders } = require("../src/controllers/orderController");
const { calculateOrderMetrics } = require("../src/services/auditService");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize } = require("./helpers/orderFactories");

const call = async (fn, req) => {
  const res = mockRes();
  await fn(req, res);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe("orders with pieces lines", () => {
  let customer;
  let plateType;
  let kgSize;
  let pcsSize;
  let bothSize;

  beforeEach(async () => {
    customer = await createCustomer();
    plateType = await createPlateType("500.00");
    kgSize = await createSize({ rate_per_kg: "150.00" });
    pcsSize = await createSize({ rate_per_kg: null, piece_price_amount: "375", piece_price_count: 1000 });
    bothSize = await createSize({ rate_per_kg: "180.00", piece_price_amount: "0.5", piece_price_count: 1, weight_kg: "100", weight_pieces_count: 10000 });
  });

  const base = () => ({ customer_id: customer.id, plate_type_id: plateType.id, order_date: "2026-09-10" });

  test("mixed order: stores snapshots, totals via shared math", async () => {
    const { status, body } = await call(createOrder, {
      body: {
        ...base(),
        round_off_amount: 5,
        product_sizes: [
          { product_size_id: kgSize.id, quantity_kg: 10 },
          { product_size_id: pcsSize.id, unit: "PIECES", quantity_pieces: "5000" },
          { product_size_id: bothSize.id, unit: "PIECES", quantity_pieces: 2000, price_amount: 2, price_pieces_count: 1 },
        ],
      },
    });
    expect(status).toBe(201);

    const lines = await db.OrderProductSize.findAll({ where: { order_id: body.data.id } });
    const pcsLine = lines.find((l) => l.product_size_id === pcsSize.id);
    expect(pcsLine.unit).toBe("PIECES");
    expect(Number(pcsLine.price_amount)).toBe(375);
    expect(pcsLine.price_pieces_count).toBe(1000);
    expect(pcsLine.weight_kg).toBeNull(); // size has no weight
    const bothLine = lines.find((l) => l.product_size_id === bothSize.id);
    expect(Number(bothLine.price_amount)).toBe(2); // custom price wins
    expect(bothLine.weight_source).toBe("SIZE"); // copied from size
    expect(lines.find((l) => l.product_size_id === kgSize.id).unit).toBe("KG");

    const { body: got } = await call(getOrderById, { params: { id: body.data.id } });
    // 10 × 150 + 5000 × 375/1000 + 2000 × 2 + plate 500 − 5
    expect(got.data.total_amount).toBe(1500 + 1875 + 4000 + 500 - 5);
    expect(got.data.volume).toEqual({ kgFromKgLines: 10, kgFromPieces: 20, kgSold: 30, piecesTotal: 7000, piecesWithoutWeight: 5000 });
    const gotPcs = got.data.orderProductSizes.find((l) => l.product_size_id === pcsSize.id);
    expect(gotPcs.line_amount).toBe(1875);
    expect(gotPcs.line_kg).toBeNull();
    expect(got.data.invoice).toBeNull();
  });

  test("measured weight is stored as MANUAL", async () => {
    const { body } = await call(createOrder, {
      body: { ...base(), product_sizes: [{ product_size_id: bothSize.id, unit: "PIECES", quantity_pieces: 1000, weight_kg: 11, weight_pieces_count: 1000 }] },
    });
    const [line] = await db.OrderProductSize.findAll({ where: { order_id: body.data.id } });
    expect(line.weight_source).toBe("MANUAL");
    expect(Number(line.weight_kg)).toBe(11);
  });

  test("echoed SIZE weight stays SIZE", async () => {
    const { body } = await call(createOrder, {
      body: { ...base(), product_sizes: [{ product_size_id: bothSize.id, unit: "PIECES", quantity_pieces: 1000, weight_kg: 100, weight_pieces_count: 10000, weight_source: "SIZE" }] },
    });
    const [line] = await db.OrderProductSize.findAll({ where: { order_id: body.data.id } });
    expect(line.weight_source).toBe("SIZE");
  });

  test("KG line on piece-only size → 400", async () => {
    const { status, body } = await call(createOrder, { body: { ...base(), product_sizes: [{ product_size_id: pcsSize.id, quantity_kg: 10 }] } });
    expect(status).toBe(400);
    expect(body.message).toMatch(/no rate per kg/i);
    expect(await db.Order.count()).toBe(0); // rolled back
  });

  test("PIECES line on kg-only size without a price → 400", async () => {
    const { status, body } = await call(createOrder, { body: { ...base(), product_sizes: [{ product_size_id: kgSize.id, unit: "PIECES", quantity_pieces: 10 }] } });
    expect(status).toBe(400);
    expect(body.message).toMatch(/no piece price/i);
  });

  test.each([["12.5"], ["abc"], [0], [""]])("quantity_pieces validation rejects %p", async (qty) => {
    const { status } = await call(createOrder, { body: { ...base(), product_sizes: [{ product_size_id: bothSize.id, unit: "PIECES", quantity_pieces: qty }] } });
    expect(status).toBe(400);
  });

  test("unknown unit → 400", async () => {
    const { status } = await call(createOrder, { body: { ...base(), product_sizes: [{ product_size_id: kgSize.id, unit: "BOX", quantity_kg: 1 }] } });
    expect(status).toBe(400);
  });

  test("update with old-style KG payload keeps total identical", async () => {
    const { body } = await call(createOrder, { body: { ...base(), product_sizes: [{ product_size_id: kgSize.id, quantity_kg: 12.35, rate_per_kg: 181.25 }] } });
    const before = (await call(getOrderById, { params: { id: body.data.id } })).body.data.total_amount;
    await call(updateOrder, { params: { id: body.data.id }, body: { product_sizes: [{ product_size_id: kgSize.id, quantity_kg: 12.35, rate_per_kg: 181.25 }] } });
    const after = (await call(getOrderById, { params: { id: body.data.id } })).body.data.total_amount;
    expect(after).toBe(before);
  });

  test("update can change a pieces price after the fact", async () => {
    const { body } = await call(createOrder, { body: { ...base(), product_sizes: [{ product_size_id: bothSize.id, unit: "PIECES", quantity_pieces: 1000 }] } });
    await call(updateOrder, {
      params: { id: body.data.id },
      body: { product_sizes: [{ product_size_id: bothSize.id, unit: "PIECES", quantity_pieces: 1000, price_amount: 2, price_pieces_count: 1, weight_kg: 100, weight_pieces_count: 10000, weight_source: "SIZE" }] },
    });
    const got = (await call(getOrderById, { params: { id: body.data.id } })).body.data;
    expect(got.total_amount).toBe(2000 + 500);
  });

  test("list returns volume per order and audit metrics are not NaN for pieces orders", async () => {
    const { body } = await call(createOrder, { body: { ...base(), product_sizes: [{ product_size_id: bothSize.id, unit: "PIECES", quantity_pieces: 5000 }] } });
    const list = (await call(getAllOrders, { query: {} })).body.data;
    expect(list[0].volume.kgSold).toBe(50);
    const metrics = await calculateOrderMetrics(db, body.data.id);
    expect(metrics.total_amount).toBe(2500 + 500);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/orderController.test.js`
Expected: FAIL (pieces lines rejected / stored as KG; no `volume`).

- [ ] **Step 3: Implement `backend/src/services/orderLines.js`**

```js
"use strict";

const { LineError, isBlank, parsePair } = require("./pieceFields");

/**
 * Turn one client order line + its product size into the row we store.
 * Snapshot rules (spec §4): values sent by the client win; otherwise prices
 * and weights are copied from the size. Throws LineError for 400s.
 */
const buildLineRow = (input, size) => {
  const unit = isBlank(input.unit) ? "KG" : input.unit;
  if (unit !== "KG" && unit !== "PIECES") throw new LineError(`Unknown unit "${unit}" — use KG or PIECES`);

  if (unit === "KG") {
    if (!input.quantity_kg) throw new LineError("Product size ID and quantity are required");
    const rate = input.rate_per_kg || size.rate_per_kg; // same fallback as before pieces existed
    if (isBlank(rate)) {
      throw new LineError(`${size.size_label} has no rate per kg — enter a rate for this line or choose Pcs`);
    }
    return { unit: "KG", quantity_kg: input.quantity_kg, rate_per_kg: rate };
  }

  const quantity = isBlank(input.quantity_pieces) ? NaN : Number(input.quantity_pieces);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new LineError("Quantity (pcs) must be a whole number, 1 or more");
  }

  const price = parsePair(input.price_amount, input.price_pieces_count, "Price", { positive: false });
  if (price.error) throw new LineError(price.error);
  let priceFields;
  if (price.value) {
    priceFields = { price_amount: price.value.amount, price_pieces_count: price.value.count };
  } else if (!isBlank(size.piece_price_amount)) {
    priceFields = { price_amount: size.piece_price_amount, price_pieces_count: size.piece_price_count };
  } else {
    throw new LineError(`${size.size_label} has no piece price — enter a price for this line`);
  }

  const weight = parsePair(input.weight_kg, input.weight_pieces_count, "Weight", { positive: true });
  if (weight.error) throw new LineError(weight.error);
  let weightFields = { weight_kg: null, weight_pieces_count: null, weight_source: null };
  if (weight.value) {
    // The client echoes SIZE for a weight it prefilled and the user didn't touch.
    weightFields = {
      weight_kg: weight.value.amount,
      weight_pieces_count: weight.value.count,
      weight_source: input.weight_source === "SIZE" ? "SIZE" : "MANUAL",
    };
  } else if (!isBlank(size.weight_kg)) {
    weightFields = { weight_kg: size.weight_kg, weight_pieces_count: size.weight_pieces_count, weight_source: "SIZE" };
  }

  return { unit: "PIECES", quantity_kg: null, rate_per_kg: null, quantity_pieces: quantity, ...priceFields, ...weightFields };
};

module.exports = { buildLineRow };
```

- [ ] **Step 4: Modify `backend/src/controllers/orderController.js`**

Imports — replace the first model import line with:

```js
const { Order, Customer, PlateType, ProductSize, OrderProductSize, Payment, Invoice, sequelize } = require("../models");
const { lineAmount, lineKg, orderTotal, paymentPosition, volumeSummary } = require("../services/orderMath");
const { buildLineRow } = require("../services/orderLines");
const { LineError } = require("../services/pieceFields");
```

Add this helper after the imports:

```js
/** Attach computed money + volume fields to a plain order (shared by list and detail). */
const withComputedFields = (orderData) => {
  const total = orderTotal(orderData);
  const position = paymentPosition(orderData, total);
  return {
    ...orderData,
    orderProductSizes: (orderData.orderProductSizes || []).map((line) => ({
      ...line,
      line_amount: lineAmount(line),
      line_kg: lineKg(line),
    })),
    volume: volumeSummary([orderData]),
    total_amount: parseFloat(total.toFixed(2)),
    totalReceivable: parseFloat((total - position.advanceReceived).toFixed(2)), // For backward compatibility
    payment_summary: {
      total_paid: position.totalPaid,
      advance_received: position.advanceReceived,
      total_payments: position.totalPaid + position.advanceReceived,
      remaining_balance: parseFloat(position.remaining.toFixed(2)),
      is_fully_paid: position.totalPaid + position.advanceReceived >= total,
    },
  };
};

/** Validate + create every line of an order inside `transaction`. Throws LineError. */
const createLines = async (orderId, productSizes, transaction) => {
  for (const ps of productSizes) {
    if (!ps.product_size_id) throw new LineError("Product size ID and quantity are required");
    const productSize = await ProductSize.findByPk(ps.product_size_id, { transaction });
    if (!productSize) throw new LineError("Invalid product size ID");
    const row = buildLineRow(ps, productSize);
    await OrderProductSize.create({ order_id: orderId, product_size_id: ps.product_size_id, ...row }, { transaction });
  }
};
```

In `createOrder`, replace everything from `// Create order product sizes` through the end of that `for` loop (the block that ends with `orderProductSizes.push(orderProductSize);\n    }`) with:

```js
    await createLines(order.id, product_sizes, transaction);
```

In `updateOrder`, inside `if (product_sizes && product_sizes.length > 0) {`, keep the `OrderProductSize.destroy(...)` call and replace the following `for` loop with:

```js
      await createLines(id, product_sizes, transaction);
```

In the `catch (err)` of **both** `createOrder` and `updateOrder`, make the first lines:

```js
    await transaction.rollback();
    if (err instanceof LineError) {
      return error(res, 400, err.message);
    }
```

(and delete the now-duplicate `await transaction.rollback();` that followed).

In `getAllOrders`, replace the whole `const ordersWithTotal = orders.map((order) => { ... });` block with:

```js
    const ordersWithTotal = orders.map((order) => withComputedFields(order.toJSON()));
```

In `getOrderById`, add to the `include` array:

```js
        { model: Invoice, as: "invoice", attributes: ["id", "invoice_number"], required: false },
```

and replace everything from `// Calculate total receivable` down to (and including) the `const orderWithTotal = { ... };` block with:

```js
    const orderWithTotal = withComputedFields(order.toJSON());
```

- [ ] **Step 5: Switch `calculateOrderMetrics` to the shared math**

In `backend/src/services/auditService.js`, add at the top (after `"use strict";`):

```js
const { orderTotal, paymentPosition } = require("./orderMath");
```

Inside `calculateOrderMetrics`, replace everything from `// Calculate total from product sizes` through `const outstanding = totalOrderAmount - totalReceived;` with:

```js
    const totalOrderAmount = orderTotal(orderData);
    const { totalReceived } = paymentPosition(orderData, totalOrderAmount);
    // Kept as total − received (not total − paid − advance) to match the
    // audit history already written.
    const outstanding = totalOrderAmount - totalReceived;
```

- [ ] **Step 6: Run tests**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/orderController.test.js && npm test`
Expected: PASS; full suite green.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/orderLines.js backend/src/controllers/orderController.js backend/src/services/auditService.js backend/tests/orderController.test.js
git commit -m "feat(orders): pieces order lines with snapshot pricing/weight; shared totals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Invoices — generation, PDF text, units on items

**Files:**
- Create: `backend/src/services/invoiceItemFormat.js`
- Modify: `backend/src/controllers/invoiceController.js`
- Test: `backend/tests/invoicePieces.test.js`

**Interfaces:**
- Consumes: `orderMath.orderTotal`, `orderMath.lineAmount`.
- Produces: `formatInvoiceRate(item) → string`, `formatInvoiceQty(item) → string` (PDF text, "Rs." prefix); invoice items carry `unit`, `price_amount`, `price_pieces_count`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/invoicePieces.test.js`:

```js
"use strict";

const db = require("../src/models");
const { generateInvoice } = require("../src/controllers/invoiceController");
const { formatInvoiceRate, formatInvoiceQty } = require("../src/services/invoiceItemFormat");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

describe("invoice item text", () => {
  test("legacy items (unit null) render exactly as before", () => {
    expect(formatInvoiceRate({ unit: null, unit_price: "181.25" })).toBe("Rs. 181.25");
    expect(formatInvoiceQty({ unit: null, quantity: "12.35" })).toBe("12.35");
    expect(formatInvoiceRate({ unit: null, unit_price: "-2000.00" })).toBe("Rs. 2000.00");
  });
  test("kg and pieces items", () => {
    expect(formatInvoiceRate({ unit: "KG", unit_price: "180.00" })).toBe("Rs. 180.00 / kg");
    expect(formatInvoiceQty({ unit: "KG", quantity: "50.00" })).toBe("50 kg");
    expect(formatInvoiceRate({ unit: "PIECES", price_amount: "375.0000", price_pieces_count: 1000 })).toBe("Rs. 375.00 / 1,000 pcs");
    expect(formatInvoiceRate({ unit: "PIECES", price_amount: "0.3750", price_pieces_count: 1 })).toBe("Rs. 0.375 / pc");
    expect(formatInvoiceQty({ unit: "PIECES", quantity: "5000.00" })).toBe("5,000 pcs");
  });
});

describe("generateInvoice with pieces lines", () => {
  test("mixed order invoice totals equal the order total to the paisa", async () => {
    const customer = await createCustomer();
    const plateType = await createPlateType("500.00");
    const size = await createSize({ rate_per_kg: "150.00" });
    const order = await createOrderWithLines({
      customer, plateType, round_off_amount: "0.00",
      lines: [
        { product_size_id: size.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "150.00" },
        { product_size_id: size.id, unit: "PIECES", quantity_pieces: 1001, price_amount: "1.0050", price_pieces_count: 1 },
      ],
    });

    const res = mockRes();
    await generateInvoice({ body: { customer_id: customer.id, order_ids: [order.id] } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const invoice = res.json.mock.calls[0][0].data;

    expect(Number(invoice.total_amount)).toBe(1500 + 1006.01 + 500);
    const items = await db.InvoiceItem.findAll({ where: { invoice_id: invoice.id } });
    const pcs = items.find((i) => i.unit === "PIECES");
    expect(Number(pcs.quantity)).toBe(1001);
    expect(Number(pcs.total_price)).toBe(1006.01);
    expect(Number(pcs.price_amount)).toBe(1.005);
    expect(pcs.price_pieces_count).toBe(1);
    expect(items.find((i) => i.unit === "KG")).toBeTruthy();
    const plate = items.find((i) => i.description.startsWith("Plate Charge"));
    expect(plate.unit).toBeNull();
    const sum = items.reduce((s, i) => s + Number(i.total_price), 0);
    expect(sum).toBeCloseTo(Number(invoice.total_amount), 2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/invoicePieces.test.js`
Expected: FAIL — module `invoiceItemFormat` missing.

- [ ] **Step 3: Implement `backend/src/services/invoiceItemFormat.js`**

```js
"use strict";

// PDF text for invoice items. unit NULL = created before piece orders existed
// (and plate-charge/advance rows) — rendered exactly as before.

const groupIN = (n) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 3 });

// 2–4 decimals: 375 → "375.00", 0.375 → "0.375"
const priceText = (amount) =>
  Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4, useGrouping: false });

const formatInvoiceRate = (item) => {
  if (item.unit === "PIECES") {
    const count = Number(item.price_pieces_count);
    return count === 1 ? `Rs. ${priceText(item.price_amount)} / pc` : `Rs. ${priceText(item.price_amount)} / ${groupIN(count)} pcs`;
  }
  const base = `Rs. ${Math.abs(parseFloat(item.unit_price)).toFixed(2)}`;
  return item.unit === "KG" ? `${base} / kg` : base;
};

const formatInvoiceQty = (item) => {
  if (item.unit === "PIECES") return `${groupIN(item.quantity)} pcs`;
  if (item.unit === "KG") return `${parseFloat(item.quantity)} kg`;
  return parseFloat(item.quantity).toString();
};

module.exports = { formatInvoiceRate, formatInvoiceQty };
```

Note: the legacy qty expectation `"12.35"` matches today's `quantity.toString()` of `parseFloat`.

- [ ] **Step 4: Modify `generateInvoice` in `invoiceController.js`**

Add imports at the top:

```js
const { orderTotal, lineAmount } = require("../services/orderMath");
const { formatInvoiceRate, formatInvoiceQty } = require("../services/invoiceItemFormat");
```

Replace the per-order total loop body (from `// Calculate product amount` through `const orderTotal = productAmount + plateCharge - roundOffAmount;`) with:

```js
      // Track advance separately (don't subtract it from the total amount)
      const advanceReceived = parseFloat(order.advance_received) || 0;
      totalAdvanceReceived += advanceReceived;

      const orderAmount = orderTotal(order);
```

and in the lines that follow, rename `orderTotal` → `orderAmount` (the `isNaN(orderTotal)` check and `totalAmount += orderTotal;`).

Replace the invoice-item loop `for (const item of order.orderProductSizes) { ... }` with:

```js
      for (const item of order.orderProductSizes) {
        const productSize = item.productSize;
        const description = `${productSize.size_label} (${order.order_date})`;
        const isPieces = item.unit === "PIECES";

        await InvoiceItem.create(
          {
            invoice_id: invoice.id,
            order_id: order.id,
            description,
            quantity: isPieces ? item.quantity_pieces : parseFloat(item.quantity_kg),
            // Pieces: rounded per-piece price, kept only for older readers of
            // unit_price — screens use the exact price_amount/price_pieces_count.
            unit_price: isPieces
              ? Math.round((parseFloat(item.price_amount) / item.price_pieces_count) * 100) / 100
              : parseFloat(item.rate_per_kg),
            total_price: lineAmount(item),
            unit: item.unit,
            price_amount: isPieces ? item.price_amount : null,
            price_pieces_count: isPieces ? item.price_pieces_count : null,
          },
          { transaction }
        );
      }
```

- [ ] **Step 5: Modify the PDF table in `generatePDF`**

Header row — replace the two header `doc.text` calls for Rate and Qty with:

```js
    doc.text("Rate", 200, tableHeaderY + 20, { align: "left", width: 175 });
    doc.text("Qty.", 375, tableHeaderY + 20, { align: "center", width: 75 });
```

Row — replace the two `doc.text` calls for unit price and quantity with:

```js
      doc.text(formatInvoiceRate(item), 200, y, { align: "left", width: 175 });
      doc.text(formatInvoiceQty(item), 375, y, { align: "center", width: 75 });
```

Delete the now-unused `const unitPrice = parseFloat(item.unit_price);` and `const quantity = parseFloat(item.quantity);` lines in that loop.

- [ ] **Step 6: Run tests**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/invoicePieces.test.js && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/invoiceItemFormat.js backend/src/controllers/invoiceController.js backend/tests/invoicePieces.test.js
git commit -m "feat(invoices): pieces lines on invoices and PDF with prices as entered

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Excel export

**Files:**
- Create: `backend/src/services/orderExport.js`
- Modify: `backend/src/controllers/exportController.js`
- Test: `backend/tests/orderExport.test.js`

**Interfaces:**
- Consumes: `orderMath`.
- Produces: `buildOrderExportRows(orders) → Array<object>` (data rows, blank row, totals row) — plain JSON orders (`order.toJSON()` shape).

- [ ] **Step 1: Write the failing test**

`backend/tests/orderExport.test.js`:

```js
"use strict";

const { buildOrderExportRows } = require("../src/services/orderExport");

const order = {
  id: "o1", order_date: "2026-09-10", created_at: "2026-09-10T00:00:00Z", status: "PENDING",
  custom_plate_charge: null, round_off_amount: "0.00", advance_received: "0.00",
  customer: { name: "Acme", metadata: {} },
  plateType: { type_name: "4 Colour", charge: "500.00" },
  payments: [],
  orderProductSizes: [
    { unit: "KG", quantity_kg: "10.00", rate_per_kg: "150.00", productSize: { size_label: "8x10", rate_per_kg: "150.00" } },
    { unit: "PIECES", quantity_kg: null, rate_per_kg: null, quantity_pieces: 5000, price_amount: "375.0000", price_pieces_count: 1000,
      weight_kg: "100.000", weight_pieces_count: 10000, weight_source: "SIZE",
      productSize: { size_label: "10x12", rate_per_kg: null, piece_price_amount: "375.0000", piece_price_count: 1000 } },
    { unit: "PIECES", quantity_kg: null, rate_per_kg: null, quantity_pieces: 2000, price_amount: "0.5000", price_pieces_count: 1,
      weight_kg: null, weight_pieces_count: null, weight_source: null,
      productSize: { size_label: "12x14", rate_per_kg: null, piece_price_amount: "0.5000", piece_price_count: 1 } },
  ],
};

describe("buildOrderExportRows", () => {
  const rows = buildOrderExportRows([order]);
  const [kgRow, pcsRow, unweighedRow] = rows;
  const totals = rows[rows.length - 1];

  test("kg line keeps kg columns; pieces columns blank", () => {
    expect(kgRow["Unit"]).toBe("KG");
    expect(kgRow["Quantity (kg)"]).toBe(10);
    expect(kgRow["Quantity (pcs)"]).toBe("");
    expect(kgRow["Product Line Total"]).toBe(1500);
  });

  test("pieces line: price as entered, est. kg, weight source", () => {
    expect(pcsRow["Unit"]).toBe("PIECES");
    expect(pcsRow["Quantity (kg)"]).toBe("");
    expect(pcsRow["Quantity (pcs)"]).toBe(5000);
    expect(pcsRow["Price"]).toBe("₹375 / 1000 pcs");
    expect(pcsRow["Est. kg"]).toBe(50);
    expect(pcsRow["Weight source"]).toBe("Size");
    expect(pcsRow["Product Line Total"]).toBe(1875);
    expect(unweighedRow["Est. kg"]).toBe("");
  });

  test("order total uses shared math", () => {
    expect(kgRow["Total Order Amount"]).toBe(1500 + 1875 + 1000 + 500);
  });

  test("totals row counts every line once", () => {
    expect(totals["Order ID"]).toBe("SUMMARY TOTALS");
    expect(totals["Quantity (kg)"]).toBe(10);
    expect(totals["Quantity (pcs)"]).toBe(7000);
    expect(totals["Est. kg"]).toBe(50);
    expect(totals["Total kg sold"]).toBe(60);
    expect(totals["Pcs without weight"]).toBe(2000);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/orderExport.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `backend/src/services/orderExport.js`**

Move the row-building out of `exportDashboardData` (from `const excelData = [];` through the final `excelData.push({ "Order ID": "SUMMARY TOTALS", ... })`) into this function, changed as follows:

```js
"use strict";

const { lineAmount, lineKg, orderTotal, plateCharge, volumeSummary } = require("./orderMath");

const priceText = (line) =>
  Number(line.price_pieces_count) === 1
    ? `₹${Number(line.price_amount)}/pc`
    : `₹${Number(line.price_amount)} / ${line.price_pieces_count} pcs`;

const round3 = (x) => Math.round(x * 1000) / 1000;

/** Dashboard Excel rows: one row per order line, a blank row, then totals. */
const buildOrderExportRows = (orders) => {
  const excelData = [];
  let grandTotalAmount = 0;
  let grandTotalReceivable = 0;

  for (const order of orders) {
    const lines = order.orderProductSizes || [];
    const productAmount = lines.reduce((sum, line) => sum + lineAmount(line), 0);
    const charge = plateCharge(order);
    const roundOffAmount = parseFloat(order.round_off_amount || 0);
    const totalOrderAmount = orderTotal(order);

    // Pre-existing semantics kept: export "paid" is the sum of ALL payments.
    const totalPaid = (order.payments || []).reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    const remainingAmount = totalOrderAmount - totalPaid;

    grandTotalAmount += totalOrderAmount;
    grandTotalReceivable += remainingAmount;

    let paymentStatusText = "PENDING";
    if (totalPaid >= totalOrderAmount) paymentStatusText = "PAID";
    else if (totalPaid > 0) paymentStatusText = "PARTIAL";

    const baseRowData = {
      "Order ID": order.id,
      "Order Date": new Date(order.order_date).toLocaleDateString(),
      "Customer Name": order.customer.name,
      "Company Name": order.customer.metadata?.company_name || "",
      "Customer Phone": order.customer.metadata?.phone || "",
      "Customer Email": order.customer.metadata?.email || "",
      "Order Status": order.status,
      "Payment Status": paymentStatusText,
      "Plate Type": order.plateType.type_name,
      "Plate Charge": charge,
      "Custom Plate Charge": order.custom_plate_charge ? "Yes" : "No",
      "Round Off Amount": roundOffAmount,
      "Product Amount": productAmount,
      "Total Order Amount": totalOrderAmount,
      "Advance Received": parseFloat(order.advance_received || 0),
      "Total Paid": totalPaid,
      "Remaining Amount": remainingAmount,
      "Created At": new Date(order.created_at).toLocaleDateString(),
    };

    if (lines.length === 0) {
      excelData.push({
        ...baseRowData,
        "Product Size": "", "Product Category": "", "Unit": "",
        "Quantity (kg)": 0, "Rate per kg": 0, "Quantity (pcs)": "", "Price": "", "Est. kg": "", "Weight source": "",
        "Custom Rate": "No", "Product Line Total": 0,
      });
      continue;
    }

    for (const item of lines) {
      const isPieces = item.unit === "PIECES";
      const kg = isPieces ? lineKg(item) : null;
      excelData.push({
        ...baseRowData,
        "Product Size": item.productSize.size_label,
        "Product Category": item.productSize.category || "",
        "Unit": isPieces ? "PIECES" : "KG",
        "Quantity (kg)": isPieces ? "" : parseFloat(item.quantity_kg),
        "Rate per kg": isPieces ? "" : parseFloat(item.rate_per_kg),
        "Quantity (pcs)": isPieces ? Number(item.quantity_pieces) : "",
        "Price": isPieces ? priceText(item) : "",
        "Est. kg": kg === null ? "" : round3(kg),
        "Weight source": !isPieces || !item.weight_source ? "" : item.weight_source === "MANUAL" ? "Measured" : "Size",
        "Custom Rate": isPieces
          ? (Number(item.price_amount) !== Number(item.productSize.piece_price_amount) ||
             Number(item.price_pieces_count) !== Number(item.productSize.piece_price_count) ? "Yes" : "No")
          : item.rate_per_kg !== item.productSize.rate_per_kg ? "Yes" : "No",
        "Product Line Total": lineAmount(item),
      });
    }
  }

  const volume = volumeSummary(orders);
  excelData.push({});
  excelData.push({
    "Order ID": "SUMMARY TOTALS",
    "Total Order Amount": grandTotalAmount,
    "Remaining Amount": grandTotalReceivable,
    "Quantity (kg)": volume.kgFromKgLines,
    "Quantity (pcs)": volume.piecesTotal,
    "Est. kg": volume.kgFromPieces,
    "Total kg sold": volume.kgSold,
    "Pcs without weight": volume.piecesWithoutWeight,
  });

  return excelData;
};

module.exports = { buildOrderExportRows };
```

- [ ] **Step 4: Use it in `exportDashboardData`**

In `backend/src/controllers/exportController.js`: add `const { buildOrderExportRows } = require("../services/orderExport");` to the imports, delete the moved block, and put in its place:

```js
    const excelData = buildOrderExportRows(orders.map((order) => order.toJSON()));
```

Leave the workbook/column-width code after it unchanged.

- [ ] **Step 5: Run tests**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/orderExport.test.js && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/orderExport.js backend/src/controllers/exportController.js backend/tests/orderExport.test.js
git commit -m "feat(export): pieces columns and kg-sold totals in the orders Excel export

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Rollout snapshot script (before/after, read-only)

**Files:**
- Create: `backend/scripts/piece-orders-snapshot.js`
- Test: `backend/tests/pieceOrdersSnapshot.test.js`

**Interfaces:**
- Consumes: `orderMath` (after mode).
- Produces: `takeSnapshot(sequelize, mode: "before" | "after") → object`; `compareSnapshots(a, b) → string[]` (differences, empty = identical). CLI: `--mode before|after --out FILE`, `--compare A B`.

- [ ] **Step 1: Write the failing test**

`backend/tests/pieceOrdersSnapshot.test.js`:

```js
"use strict";

const db = require("../src/models");
const { takeSnapshot, compareSnapshots } = require("../scripts/piece-orders-snapshot");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

describe("piece-orders snapshot", () => {
  beforeEach(async () => {
    const customer = await createCustomer();
    const plateType = await createPlateType("1500.00");
    const size = await createSize({ rate_per_kg: "181.25" });
    const order = await createOrderWithLines({
      customer, plateType, advance_received: "2000.00", round_off_amount: "5.00",
      lines: [{ product_size_id: size.id, unit: "KG", quantity_kg: "12.35", rate_per_kg: "181.25" }],
    });
    await db.Payment.create({ order_id: order.id, customer_id: customer.id, amount: "2000.00", payment_type: "ADVANCE", payment_date: "2026-09-01" });
    await db.Payment.create({ order_id: order.id, customer_id: customer.id, amount: "500.00", payment_type: "PARTIAL", payment_date: "2026-09-02" });
  });

  test("legacy formula and shared math agree on kg-only data", async () => {
    const before = await takeSnapshot(db.sequelize, "before");
    const after = await takeSnapshot(db.sequelize, "after");
    expect(compareSnapshots(before, after)).toEqual([]);
    expect(before.orders[0].total).toBe((12.35 * 181.25 + 1500 - 5).toFixed(2));
  });

  test("any change is reported", async () => {
    const before = await takeSnapshot(db.sequelize, "before");
    await db.sequelize.query(`UPDATE order_product_sizes SET rate_per_kg = 181.26`);
    const after = await takeSnapshot(db.sequelize, "after");
    const diffs = compareSnapshots(before, after);
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs.join("\n")).toMatch(/total|rate_per_kg/);
  });

  test("after mode refuses to certify when pieces lines already exist", async () => {
    const [line] = await db.OrderProductSize.findAll();
    const size = await createSize({ rate_per_kg: null, piece_price_amount: "1", piece_price_count: 1 });
    await db.OrderProductSize.create({ order_id: line.order_id, product_size_id: size.id, unit: "PIECES", quantity_pieces: 1, price_amount: "1", price_pieces_count: 1 });
    await expect(takeSnapshot(db.sequelize, "after")).rejects.toThrow(/pieces lines/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/pieceOrdersSnapshot.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `backend/scripts/piece-orders-snapshot.js`**

```js
#!/usr/bin/env node
"use strict";

/**
 * READ-ONLY rollout check for the piece-orders migration.
 *
 *   NODE_ENV=production node scripts/piece-orders-snapshot.js --mode before --out ~/yars-snap-before.json
 *   (run migration)
 *   NODE_ENV=production node scripts/piece-orders-snapshot.js --mode after  --out ~/yars-snap-after.json
 *   node scripts/piece-orders-snapshot.js --compare ~/yars-snap-before.json ~/yars-snap-after.json
 *
 * "before" computes totals with the pre-pieces formula; "after" with the new
 * shared orderMath. On kg-only data every value must be identical.
 */

const fs = require("fs");
const { orderTotal, paymentPosition } = require("../src/services/orderMath");

// The pre-pieces formula, copied verbatim from orderController (2026-09-30).
const legacyTotals = (order) => {
  let totalProductAmount = 0;
  order.orderProductSizes.forEach((ops) => {
    totalProductAmount += parseFloat(ops.quantity_kg) * parseFloat(ops.rate_per_kg || ops.productSize.rate_per_kg);
  });
  const plateCharge = parseFloat(order.custom_plate_charge || order.plateType?.charge || 0);
  const total = totalProductAmount + plateCharge - parseFloat(order.round_off_amount || 0);
  const advance = order.payments.filter((p) => p.payment_type === "ADVANCE");
  const other = order.payments.filter((p) => p.payment_type !== "ADVANCE");
  const totalPaid = other.reduce((s, p) => s + parseFloat(p.amount), 0);
  const advanceFromPayments = advance.reduce((s, p) => s + parseFloat(p.amount), 0);
  const advanceReceived = advanceFromPayments > 0 ? advanceFromPayments : parseFloat(order.advance_received || 0);
  return { total, remaining: total - totalPaid - advanceReceived };
};

const newTotals = (order) => {
  const total = orderTotal(order);
  return { total, remaining: paymentPosition(order, total).remaining };
};

const takeSnapshot = async (sequelize, mode) => {
  const q = (sql) => sequelize.query(sql).then(([rows]) => rows);

  if (mode === "after") {
    const [{ n }] = await q(`SELECT COUNT(*)::int AS n FROM order_product_sizes WHERE unit <> 'KG'`);
    if (n > 0) throw new Error(`${n} pieces lines exist — a before/after comparison is only meaningful right after migrating`);
  }

  const orders = await q(`SELECT o.id, o.custom_plate_charge, o.round_off_amount, o.advance_received, o.is_archived, pt.charge AS plate_charge
                          FROM orders o LEFT JOIN plate_types pt ON pt.id = o.plate_type_id ORDER BY o.id`);
  const lines = await q(`SELECT ops.id, ops.order_id, ops.product_size_id, ops.quantity_kg, ops.rate_per_kg, ps.rate_per_kg AS size_rate
                         FROM order_product_sizes ops JOIN product_sizes ps ON ps.id = ops.product_size_id ORDER BY ops.id`);
  const payments = await q(`SELECT id, order_id, amount, payment_type FROM payments ORDER BY id`);

  const compute = mode === "before" ? legacyTotals : newTotals;
  const orderRows = orders.map((o) => {
    const order = {
      custom_plate_charge: o.custom_plate_charge,
      round_off_amount: o.round_off_amount,
      advance_received: o.advance_received,
      plateType: { charge: o.plate_charge },
      orderProductSizes: lines
        .filter((l) => l.order_id === o.id)
        .map((l) => ({ unit: "KG", quantity_kg: l.quantity_kg, rate_per_kg: l.rate_per_kg, productSize: { rate_per_kg: l.size_rate } })),
      payments: payments.filter((p) => p.order_id === o.id),
    };
    const { total, remaining } = compute(order);
    const kg = order.orderProductSizes.reduce((s, l) => s + parseFloat(l.quantity_kg || 0), 0);
    return { id: o.id, is_archived: o.is_archived, total: total.toFixed(2), remaining: remaining.toFixed(2), kg: kg.toFixed(2) };
  });

  return {
    orders: orderRows,
    lines: lines.map(({ id, order_id, product_size_id, quantity_kg, rate_per_kg }) => ({ id, order_id, product_size_id, quantity_kg, rate_per_kg })),
    payments,
    sizes: await q(`SELECT id, size_label, rate_per_kg, is_archived FROM product_sizes ORDER BY id`),
    invoices: await q(`SELECT id, invoice_number, total_amount, tax_percent, tax_amount, final_amount, status, is_archived FROM invoices ORDER BY id`),
    invoiceItems: await q(`SELECT id, invoice_id, order_id, description, quantity, unit_price, total_price FROM invoice_items ORDER BY id`),
  };
};

const compareSnapshots = (a, b) => {
  const diffs = [];
  for (const key of Object.keys(a)) {
    const left = a[key];
    const right = b[key] || [];
    if (left.length !== right.length) diffs.push(`${key}: ${left.length} rows before, ${right.length} after`);
    const byId = new Map(right.map((r) => [r.id, r]));
    for (const row of left) {
      const other = byId.get(row.id);
      if (!other) { diffs.push(`${key} ${row.id}: missing after`); continue; }
      for (const field of Object.keys(row)) {
        if (JSON.stringify(row[field]) !== JSON.stringify(other[field])) {
          diffs.push(`${key} ${row.id}.${field}: ${JSON.stringify(row[field])} → ${JSON.stringify(other[field])}`);
        }
      }
    }
  }
  return diffs;
};

const main = async () => {
  const args = process.argv.slice(2);
  if (args[0] === "--compare") {
    const [a, b] = [args[1], args[2]].map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
    const diffs = compareSnapshots(a, b);
    if (diffs.length) {
      console.error(`❌ ${diffs.length} difference(s):\n${diffs.slice(0, 50).join("\n")}`);
      process.exit(1);
    }
    console.log(`✅ Identical: ${a.orders.length} orders, ${a.lines.length} lines, ${a.invoices.length} invoices, ${a.invoiceItems.length} invoice items, ${a.sizes.length} sizes.`);
    return;
  }
  const mode = args[args.indexOf("--mode") + 1];
  const out = args[args.indexOf("--out") + 1];
  if (!["before", "after"].includes(mode) || !out) throw new Error("Usage: --mode before|after --out FILE  |  --compare A B");
  const { sequelize } = require("../src/models");
  const snapshot = await takeSnapshot(sequelize, mode);
  fs.writeFileSync(out, JSON.stringify(snapshot, null, 2));
  console.log(`Wrote ${mode} snapshot (${snapshot.orders.length} orders) to ${out}`);
  await sequelize.close();
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { takeSnapshot, compareSnapshots };
```

- [ ] **Step 4: Run tests**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/pieceOrdersSnapshot.test.js`
Expected: PASS. (In "before" mode against a pre-migration schema the queries only touch pre-existing columns — `unit` is referenced only in "after" mode.)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/piece-orders-snapshot.js backend/tests/pieceOrdersSnapshot.test.js
git commit -m "chore(rollout): read-only before/after snapshot for the piece-orders migration

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Jarvis knowledge base + canonical query tests

**Files:**
- Modify: `backend/knowledge/schema.md`, `orders.md`, `dashboard.md`, `invoices.md`
- Test: `backend/tests/knowledgeQueries.test.js`

**Interfaces:**
- Consumes: `orderMath`, `assistantDb.runQuery` (existing).
- Produces: canonical SQL blocks in `schema.md` wrapped in `<!-- canonical:pending -->…<!-- /canonical:pending -->` and `<!-- canonical:volume -->…<!-- /canonical:volume -->`.

- [ ] **Step 1: Write the failing test**

`backend/tests/knowledgeQueries.test.js`:

```js
"use strict";

const fs = require("fs");
const path = require("path");
const db = require("../src/models");
const { runQuery, closePool } = require("../src/services/assistant/assistantDb");
const { orderTotal, paymentPosition, volumeSummary } = require("../src/services/orderMath");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

const schemaMd = fs.readFileSync(path.join(__dirname, "../knowledge/schema.md"), "utf8");
const canonical = (name) => {
  const m = schemaMd.match(new RegExp(`<!-- canonical:${name} -->([\\s\\S]*?)<!-- /canonical:${name} -->`));
  if (!m) throw new Error(`canonical:${name} block missing from schema.md`);
  return m[1].trim();
};

afterAll(async () => {
  await closePool();
});

describe("Jarvis canonical queries match the app", () => {
  let customerA;
  let customerB;

  beforeEach(async () => {
    customerA = await createCustomer("Alpha");
    customerB = await createCustomer("Beta");
    const plate = await createPlateType("500.00");
    const kgSize = await createSize({ rate_per_kg: "150.00" });
    const pcsSize = await createSize({ rate_per_kg: null, piece_price_amount: "375", piece_price_count: 1000 });

    const a = await createOrderWithLines({
      customer: customerA, plateType: plate, advance_received: "1000.00", round_off_amount: "5.00",
      lines: [
        { product_size_id: kgSize.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "150.00" },
        { product_size_id: pcsSize.id, unit: "PIECES", quantity_pieces: 5000, price_amount: "375", price_pieces_count: 1000, weight_kg: "100", weight_pieces_count: 10000, weight_source: "SIZE" },
      ],
    });
    await db.Payment.create({ order_id: a.id, customer_id: customerA.id, amount: "1000.00", payment_type: "ADVANCE", payment_date: "2026-09-01" });
    await db.Payment.create({ order_id: a.id, customer_id: customerA.id, amount: "700.00", payment_type: "PARTIAL", payment_date: "2026-09-05" });

    await createOrderWithLines({
      customer: customerB, plateType: plate,
      lines: [{ product_size_id: pcsSize.id, unit: "PIECES", quantity_pieces: 1001, price_amount: "1.005", price_pieces_count: 1 }],
    });
  });

  const appOrders = () =>
    db.Order.findAll({
      where: { is_archived: false },
      include: [
        { model: db.Customer, as: "customer" },
        { model: db.PlateType, as: "plateType" },
        { model: db.OrderProductSize, as: "orderProductSizes", include: [{ model: db.ProductSize, as: "productSize" }] },
        { model: db.Payment, as: "payments" },
      ],
    }).then((rows) => rows.map((r) => r.toJSON()));

  test("pending query (via the assistant's own guarded path) = app receivable per customer", async () => {
    const out = JSON.parse(await runQuery(canonical("pending")));
    const sqlPending = Object.fromEntries(out.rows.map((r) => [r.name, Number(r.pending)]));

    const expected = {};
    for (const order of await appOrders()) {
      const remaining = paymentPosition(order, orderTotal(order)).remaining;
      expected[order.customer.name] = (expected[order.customer.name] || 0) + remaining;
    }
    for (const [name, value] of Object.entries(expected)) {
      expect(sqlPending[name]).toBeCloseTo(value, 2);
    }
    // Alpha: 1500 + 1875 + 500 − 5 − 700 − 1000 = 2170; Beta: 1006.01 + 500
    expect(sqlPending.Alpha).toBeCloseTo(2170, 2);
    expect(sqlPending.Beta).toBeCloseTo(1506.01, 2);
  });

  test("volume query = app volume summary", async () => {
    const out = JSON.parse(await runQuery(canonical("volume")));
    const row = out.rows[0];
    const app = volumeSummary(await appOrders());
    expect(Number(row.kg_from_kg_lines)).toBeCloseTo(app.kgFromKgLines, 3);
    expect(Number(row.kg_from_pieces)).toBeCloseTo(app.kgFromPieces, 3);
    expect(Number(row.kg_sold)).toBeCloseTo(app.kgSold, 3);
    expect(Number(row.pieces_total)).toBe(app.piecesTotal);
    expect(Number(row.pieces_without_weight)).toBe(app.piecesWithoutWeight);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/knowledgeQueries.test.js`
Expected: FAIL — "canonical:pending block missing from schema.md".

- [ ] **Step 3: Update `backend/knowledge/schema.md`**

(a) Replace the "`orders` has **no** `total_amount` column" bullet's formula lines with:

```
- `orders` has **no** `total_amount` column — the API computes it:
  SUM(line amount) + plate charge (`COALESCE(orders.custom_plate_charge, plate_types.charge)`)
  − `COALESCE(orders.round_off_amount, 0)`, where **line amount** is exactly:
  `CASE WHEN ops.unit = 'PIECES' THEN ROUND(ops.quantity_pieces * ops.price_amount / ops.price_pieces_count, 2) ELSE ops.quantity_kg * COALESCE(ops.rate_per_kg, ps.rate_per_kg) END`
- **Units — never double count:** every order line is EITHER a kg line
  (`unit = 'KG'`: `quantity_kg` × rate) OR a pieces line (`unit = 'PIECES'`:
  `quantity_pieces` priced "N pieces cost ₹X" = `price_pieces_count` pieces
  cost `price_amount`). Kg sold = kg of KG lines + ESTIMATED kg of PIECES
  lines (`quantity_pieces × weight_kg / weight_pieces_count`); PIECES lines
  with NULL weight have unknown kg — always say how many pieces are
  unweighted when answering kg questions. Never add `quantity_kg` and
  pieces-estimated kg of the same line (a line is only ever one unit).
```

(b) Replace the pending query block (from `  WITH order_calc AS (` through `  GROUP BY c.name HAVING SUM(oc.balance) > 0 ORDER BY pending DESC`) with the same query wrapped in markers and with the new line-amount expression:

```
<!-- canonical:pending -->
  WITH order_calc AS (
    SELECT o.customer_id,
      COALESCE((SELECT SUM(CASE WHEN ops.unit = 'PIECES'
                                THEN ROUND(ops.quantity_pieces * ops.price_amount / ops.price_pieces_count, 2)
                                ELSE ops.quantity_kg * COALESCE(ops.rate_per_kg, ps.rate_per_kg) END)
                FROM order_product_sizes ops JOIN product_sizes ps ON ps.id = ops.product_size_id
                WHERE ops.order_id = o.id), 0)
      + COALESCE(o.custom_plate_charge, pt.charge, 0)
      - COALESCE(o.round_off_amount, 0)
      - COALESCE((SELECT SUM(p.amount) FROM payments p
                  WHERE p.order_id = o.id AND p.payment_type <> 'ADVANCE'), 0)
      - CASE WHEN COALESCE((SELECT SUM(p.amount) FROM payments p
                            WHERE p.order_id = o.id AND p.payment_type = 'ADVANCE'), 0) > 0
             THEN (SELECT SUM(p.amount) FROM payments p
                   WHERE p.order_id = o.id AND p.payment_type = 'ADVANCE')
             ELSE COALESCE(o.advance_received, 0) END AS balance
    FROM orders o
    LEFT JOIN plate_types pt ON pt.id = o.plate_type_id
    WHERE o.is_archived = false
  )
  SELECT c.name, ROUND(SUM(oc.balance), 2) AS pending
  FROM order_calc oc JOIN customers c ON c.id = oc.customer_id
  GROUP BY c.name HAVING SUM(oc.balance) > 0 ORDER BY pending DESC
<!-- /canonical:pending -->
- **For ANY kg sold / pieces sold / volume question, use exactly this query**
  (add date/customer filters on `o` as needed; never change the sums):

<!-- canonical:volume -->
  SELECT
    ROUND(COALESCE(SUM(ops.quantity_kg) FILTER (WHERE ops.unit = 'KG'), 0), 3) AS kg_from_kg_lines,
    ROUND(COALESCE(SUM(ops.quantity_pieces * ops.weight_kg / ops.weight_pieces_count)
          FILTER (WHERE ops.unit = 'PIECES' AND ops.weight_kg IS NOT NULL), 0), 3) AS kg_from_pieces,
    ROUND(COALESCE(SUM(ops.quantity_kg) FILTER (WHERE ops.unit = 'KG'), 0)
          + COALESCE(SUM(ops.quantity_pieces * ops.weight_kg / ops.weight_pieces_count)
            FILTER (WHERE ops.unit = 'PIECES' AND ops.weight_kg IS NOT NULL), 0), 3) AS kg_sold,
    COALESCE(SUM(ops.quantity_pieces) FILTER (WHERE ops.unit = 'PIECES'), 0) AS pieces_total,
    COALESCE(SUM(ops.quantity_pieces) FILTER (WHERE ops.unit = 'PIECES' AND ops.weight_kg IS NULL), 0) AS pieces_without_weight
  FROM order_product_sizes ops
  JOIN orders o ON o.id = ops.order_id
  WHERE o.is_archived = false
<!-- /canonical:volume -->
```

(c) Replace the `### product_sizes` paragraph with:

```
### product_sizes
`id`, `size_label TEXT` (e.g. "8x10"), `rate_per_kg DECIMAL(10,2) NULL` (default
₹/kg; NULL = sold only by pieces), `piece_price_amount DECIMAL(12,4) NULL` +
`piece_price_count INTEGER NULL` ("N pieces cost ₹X" — e.g. 1000 pcs cost
₹375 → per piece ₹0.375), `weight_kg DECIMAL(12,3) NULL` + `weight_pieces_count
INTEGER NULL` ("N pieces weigh W kg"), `is_archived`, timestamps. A size has at
least one of rate_per_kg / piece price.
```

(d) Replace the `### order_product_sizes (order line items)` paragraph with:

```
### order_product_sizes (order line items)
`id`, `order_id FK → orders`, `product_size_id FK → product_sizes`,
`unit ENUM('KG','PIECES')`, and either
- KG: `quantity_kg DECIMAL(10,2)`, `rate_per_kg DECIMAL(10,2)` (rate frozen for
  this order; may differ from the master rate), or
- PIECES: `quantity_pieces INTEGER`, `price_amount DECIMAL(12,4)` +
  `price_pieces_count INTEGER` (price frozen for this order), and optionally
  `weight_kg` + `weight_pieces_count` + `weight_source ENUM('SIZE','MANUAL')`
  (SIZE = copied from the size, MANUAL = measured for this order).
The other unit's columns are NULL (DB-enforced). No timestamps, no is_archived.
Line amount: see the CASE expression above.
```

(e) Replace the `### invoice_items` paragraph with:

```
### invoice_items
`id`, `invoice_id FK → invoices`, `order_id FK → orders NULL`,
`description TEXT`, `quantity DECIMAL(10,2)` (kg or pieces), `unit_price
DECIMAL(10,2)` (can be NEGATIVE — advance payments appear as negative lines with
description containing "Advance Payment"), `total_price DECIMAL(10,2)`,
`unit ENUM('KG','PIECES') NULL` (NULL for plate-charge/advance lines and for
items created before piece orders existed), `price_amount` + `price_pieces_count`
(pieces price as entered), timestamps.
```

- [ ] **Step 4: Update the walkthroughs**

`backend/knowledge/orders.md`:
- First paragraph: change "one or more product-size lines (kg × rate/kg)" to "one or more product-size lines, each sold by **Kg** (kg × rate/kg) or by **Pcs** (pieces × a price like "1,000 pcs cost ₹375")".
- Domain terms — replace the **Product size** bullet with:

```
- **Product size**: a bag size (e.g. "8x10") with an optional **Rate per kg**,
  an optional piece price ("**N piece(s) cost ₹X**") — at least one of the two —
  and an optional weight ("**N piece(s) weigh W kg**") used only to estimate
  the kg of pieces lines. Prices and weights are copied onto each order line
  when the order is saved; changing the size later affects only new orders
  (except: lines with no weight pick up a newly-set size weight — see below).
```

- Creating an order, step 8 — replace with:

```
8. Under **Product Sizes**: for each line pick **Size** (shows its prices, e.g.
   "8x10 (₹180.00/kg · ₹0.50/pc)"), then the unit toggle **Kg | Pcs** (only
   units the size has a price for are enabled).
   - **Kg**: enter **Quantity (kg)**, optionally override **Rate/kg**.
   - **Pcs**: enter **Quantity (pcs)** (whole number). **Price** "N pcs cost ₹X"
     is pre-filled from the size and can be changed for this order.
     **Weight** "N pcs weigh W kg" is pre-filled from the size; typing your own
     makes it a measured weight (shown as "measured"). If the size has no
     weight, an amber note says so and offers **Set weight for <size>** — saving
     it updates the size and fills in earlier pieces lines that had no weight.
     Skipping is fine; the order still saves.
   The line shows **Amount** (and "≈ N kg" for pieces) live. Tap **Add Product
   Size** for more lines; the trash button removes a line.
```

- Viewing / editing — append to step 3: "If the order is already on an invoice, the edit screen shows a warning: changes won't update that invoice — delete and regenerate the invoice to update it."
- Managing product sizes — replace step 2 with:

```
2. Fill **Size Label**, then any of: **Rate per kg**; **Piece price**
   "[N] piece(s) cost ₹[X]" (N defaults to 1; e.g. 1 piece costs ₹0.50, or 100
   pieces cost ₹250); **Weight** "[N] piece(s) weigh [W] kg". At least one of
   rate per kg / piece price is required. Tap **Save Product Size**. Saving a
   weight also fills it into earlier pieces order lines of that size that had
   no weight (the success message says how many).
```

- Rules — replace the bullet "Changing a size on a line pre-fills its rate…" with: "Changing a size on a line pre-fills its kg rate only if the line has no rate yet; a pieces line's price and weight reset to the new size's values. Saved orders keep their frozen prices and weights."

`backend/knowledge/dashboard.md` — replace the **Recent Orders** bullet with:

```
- **Recent Orders** section with a summary bar — **Kg sold** (kg from kg lines
  + estimated kg from pieces lines, each line counted once; an amber note shows
  "+ N pcs without weight (not in kg)" when some pieces lines have no weight,
  tapping it opens Product Sizes), **Pieces sold**, **Amount**, **Receivable** —
  then the order list, 5 per page, with a **View All** link to [Orders](/orders).
```

`backend/knowledge/invoices.md` — append to Notes:

```
- Invoice items show units: kg lines as "Rs. 180.00 / kg" × "50 kg", pieces
  lines with the price as entered ("Rs. 375.00 / 1,000 pcs" × "5,000 pcs").
  Invoices made before piece orders existed show no units. Estimated weights
  never appear on invoices.
- Editing an order after it is invoiced does NOT change the invoice; delete the
  invoice and generate it again to pick up the changes.
```

- [ ] **Step 5: Run tests**

Run: `cd backend && npx cross-env NODE_ENV=test jest tests/knowledgeQueries.test.js tests/knowledgeLoader.test.js && npm test`
Expected: PASS. If `runQuery` rejects the canonical SQL (sqlGuard is strict), adjust the SQL wording — never loosen the guard.

- [ ] **Step 6: Commit**

```bash
git add backend/knowledge/schema.md backend/knowledge/orders.md backend/knowledge/dashboard.md backend/knowledge/invoices.md backend/tests/knowledgeQueries.test.js
git commit -m "docs(assistant): Jarvis knows piece orders; canonical pending/volume SQL tested

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Frontend — Product Sizes form and list

**Files:**
- Modify: `frontend/src/components/productSizes/ProductSizeForm.jsx`, `ProductSizeList.jsx`, `frontend/src/pages/EditProductSize.jsx`

**Interfaces:**
- Consumes: `formatSizePricing`, `perPiecePriceHint`, `perPieceWeightHint` (Task 2); API from Task 4.

- [ ] **Step 1: Rewrite `ProductSizeForm.jsx` state + fields**

Replace the `useState`/`useEffect`/`handleChange`/`handleSubmit` block with:

```jsx
  const [formData, setFormData] = useState({
    size_label: "",
    rate_per_kg: "",
    piece_price_count: 1,
    piece_price_amount: "",
    weight_pieces_count: "",
    weight_kg: "",
  });
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (initialValues) {
      const v = (x) => (x === null || x === undefined ? "" : x);
      setFormData({
        size_label: initialValues.size_label || "",
        rate_per_kg: v(initialValues.rate_per_kg),
        piece_price_count: initialValues.piece_price_count ?? 1,
        piece_price_amount: v(initialValues.piece_price_amount),
        weight_pieces_count: v(initialValues.weight_pieces_count),
        weight_kg: v(initialValues.weight_kg),
      });
    }
  }, [initialValues]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const blank = (x) => x === "" || x === null || x === undefined;

  const handleSubmit = (e) => {
    e.preventDefault();
    const hasPiecePrice = !blank(formData.piece_price_amount);
    if (blank(formData.rate_per_kg) && !hasPiecePrice) {
      setLocalError("Enter a rate per kg or a piece price (or both).");
      return;
    }
    if (blank(formData.weight_kg) !== blank(formData.weight_pieces_count)) {
      setLocalError("Weight: enter both the number of pieces and the kg.");
      return;
    }
    setLocalError("");
    onSubmit({
      size_label: formData.size_label,
      rate_per_kg: blank(formData.rate_per_kg) ? null : formData.rate_per_kg,
      piece_price_amount: hasPiecePrice ? formData.piece_price_amount : null,
      piece_price_count: hasPiecePrice ? formData.piece_price_count : null,
      weight_kg: blank(formData.weight_kg) ? null : formData.weight_kg,
      weight_pieces_count: blank(formData.weight_pieces_count) ? null : formData.weight_pieces_count,
    });
  };
```

Show `localError || error` in the existing error alert (change `{error && (` to `{(localError || error) && (` and `{error}` inside it to `{localError || error}`).

Replace the **Rate per kg** `form-group` with these three groups:

```jsx
        <div className="form-group">
          <label htmlFor="rate_per_kg" className="form-label">
            <FaRupeeSign className="form-icon" /> Rate per kg
          </label>
          <input type="number" id="rate_per_kg" name="rate_per_kg" value={formData.rate_per_kg} onChange={handleChange}
            min="0" step="0.01" className="form-control" placeholder="Optional if a piece price is set" />
        </div>

        <div className="form-group">
          <label className="form-label">
            <FaRupeeSign className="form-icon" /> Piece price
          </label>
          <div className="flex items-center gap-2">
            <input type="number" name="piece_price_count" aria-label="Number of pieces" value={formData.piece_price_count}
              onChange={handleChange} min="1" step="1" className="form-control w-24" />
            <span className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">piece(s) cost ₹</span>
            <input type="number" name="piece_price_amount" aria-label="Price for those pieces" value={formData.piece_price_amount}
              onChange={handleChange} min="0" step="0.0001" className="form-control" placeholder="e.g. 0.50" />
          </div>
          {formData.piece_price_amount !== "" && Number(formData.piece_price_count) > 1 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{perPiecePriceHint(formData.piece_price_amount, formData.piece_price_count)}</p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">
            <FaWeightHanging className="form-icon" /> Weight
          </label>
          <div className="flex items-center gap-2">
            <input type="number" name="weight_pieces_count" aria-label="Number of pieces weighed" value={formData.weight_pieces_count}
              onChange={handleChange} min="1" step="1" className="form-control w-24" placeholder="10000" />
            <span className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">piece(s) weigh</span>
            <input type="number" name="weight_kg" aria-label="Weight in kg" value={formData.weight_kg}
              onChange={handleChange} min="0" step="0.001" className="form-control" placeholder="100" />
            <span className="text-sm text-gray-600 dark:text-gray-300">kg</span>
          </div>
          {formData.weight_kg !== "" && formData.weight_pieces_count !== "" && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{perPieceWeightHint(formData.weight_kg, formData.weight_pieces_count)}</p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Optional. Used only to estimate kg for orders taken in pieces.</p>
        </div>
```

Update imports:

```jsx
import { FaSave, FaTimes, FaRuler, FaRupeeSign, FaExclamationCircle, FaWeightHanging } from "react-icons/fa";
import { perPiecePriceHint, perPieceWeightHint } from "../../utils/formatters";
```

- [ ] **Step 2: `ProductSizeList.jsx` — pricing summary column**

Change the header `Rate per kg` → `Pricing`, the cell `{formatCurrency(productSize.rate_per_kg)}` → `{formatSizePricing(productSize)}`, and the import to `import { formatSizePricing } from "../../utils/formatters";`.

- [ ] **Step 3: `EditProductSize.jsx` — back-fill message**

Replace the two lines in `handleSubmit` that call `productSizeAPI.update` and `navigate` with:

```jsx
      const response = await productSizeAPI.update(id, formData);
      const filled = response.data.data?.backfilled_lines || 0;
      const message = filled > 0
        ? `Product size updated — weight added to ${filled} earlier order line${filled === 1 ? "" : "s"}`
        : "Product size updated successfully";
      navigate("/product-sizes", { state: { message } });
```

- [ ] **Step 4: Lint + build**

Run: `cd frontend && npx eslint src/components/productSizes src/pages/EditProductSize.jsx && npx vite build`
Expected: no new errors in these files; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/productSizes/ProductSizeForm.jsx frontend/src/components/productSizes/ProductSizeList.jsx frontend/src/pages/EditProductSize.jsx
git commit -m "feat(product-sizes): piece price and weight settings in the UI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Frontend — order form (unit toggle, pieces fields, weight reminder, invoiced warning)

**Files:**
- Create: `frontend/src/utils/orderFormLines.js`, `frontend/src/utils/orderFormLines.test.js`
- Create: `frontend/src/components/orders/OrderLineFields.jsx`
- Modify: `frontend/src/components/orders/OrderForm.jsx`, `frontend/src/pages/CreateOrder.jsx`, `frontend/src/pages/EditOrder.jsx`

**Interfaces:**
- Produces `orderFormLines.js`: `availableUnits(size) → ("KG"|"PIECES")[]`, `emptyLine()`, `lineFromOrderItem(item)`, `applySizeSelection(line, size)`, `applySizeWeight(line, size)`, `previewLine(line, size) → { amount: number|null, kg: number|null }`, `toPayloadLine(line)`.
- `OrderForm` gains prop `onProductSizeUpdated(size)`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/utils/orderFormLines.test.js`:

```js
import { describe, test, expect } from "vitest";
import { availableUnits, emptyLine, lineFromOrderItem, applySizeSelection, applySizeWeight, previewLine, toPayloadLine } from "./orderFormLines";

const kgOnly = { id: "k", size_label: "8x10", rate_per_kg: "180.00", piece_price_amount: null, piece_price_count: null, weight_kg: null, weight_pieces_count: null };
const pcsOnly = { id: "p", size_label: "10x12", rate_per_kg: null, piece_price_amount: "375.0000", piece_price_count: 1000, weight_kg: null, weight_pieces_count: null };
const both = { id: "b", size_label: "12x14", rate_per_kg: "150.00", piece_price_amount: "0.5000", piece_price_count: 1, weight_kg: "100.000", weight_pieces_count: 10000 };

describe("order form lines", () => {
  test("available units follow the size's prices", () => {
    expect(availableUnits(kgOnly)).toEqual(["KG"]);
    expect(availableUnits(pcsOnly)).toEqual(["PIECES"]);
    expect(availableUnits(both)).toEqual(["KG", "PIECES"]);
  });

  test("picking a piece-only size switches to PIECES and prefills price", () => {
    const line = applySizeSelection(emptyLine(), pcsOnly);
    expect(line.unit).toBe("PIECES");
    expect(line.price_amount).toBe(375);
    expect(line.price_pieces_count).toBe(1000);
    expect(line.weight_kg).toBe("");
  });

  test("picking a size with a weight prefills it as SIZE", () => {
    const line = applySizeSelection({ ...emptyLine(), unit: "PIECES" }, both);
    expect(line.weight_kg).toBe(100);
    expect(line.weight_source).toBe("SIZE");
  });

  test("changing size resets pieces price/weight to the new size", () => {
    const first = applySizeSelection({ ...emptyLine(), unit: "PIECES" }, both);
    const second = applySizeSelection(first, pcsOnly);
    expect(second.price_amount).toBe(375);
    expect(second.weight_kg).toBe("");
    expect(second.weight_source).toBeNull();
  });

  test("kg rate keeps the existing prefill-only-if-empty rule", () => {
    const line = applySizeSelection({ ...emptyLine(), rate_per_kg: 200 }, kgOnly);
    expect(line.rate_per_kg).toBe(200);
  });

  test("applySizeWeight fills an empty line weight only", () => {
    const line = { ...emptyLine(), unit: "PIECES", product_size_id: "p" };
    expect(applySizeWeight(line, { ...pcsOnly, weight_kg: "50.000", weight_pieces_count: 5000 }).weight_kg).toBe(50);
    const measured = { ...line, weight_kg: 2, weight_pieces_count: 100, weight_source: "MANUAL" };
    expect(applySizeWeight(measured, { ...pcsOnly, weight_kg: "50.000", weight_pieces_count: 5000 }).weight_kg).toBe(2);
  });

  test("preview: incomplete pieces line has no amount instead of crashing", () => {
    expect(previewLine({ ...emptyLine(), unit: "PIECES", quantity_pieces: "", price_amount: 1, price_pieces_count: 1 }, both)).toEqual({ amount: null, kg: null });
    expect(previewLine({ ...emptyLine(), unit: "PIECES", quantity_pieces: 5000, price_amount: 0.5, price_pieces_count: 1, weight_kg: 100, weight_pieces_count: 10000 }, both))
      .toEqual({ amount: 2500, kg: 50 });
  });

  test("round trip: saved KG item → form → payload keeps rate", () => {
    const line = lineFromOrderItem({ product_size_id: "k", unit: "KG", quantity_kg: "12.35", rate_per_kg: "181.25", productSize: kgOnly });
    expect(toPayloadLine(line)).toEqual({ product_size_id: "k", unit: "KG", quantity_kg: 12.35, rate_per_kg: 181.25 });
  });

  test("round trip: saved PIECES item with SIZE weight echoes SIZE", () => {
    const line = lineFromOrderItem({ product_size_id: "b", unit: "PIECES", quantity_pieces: 5000, price_amount: "0.5000", price_pieces_count: 1, weight_kg: "100.000", weight_pieces_count: 10000, weight_source: "SIZE" });
    expect(toPayloadLine(line)).toEqual({ product_size_id: "b", unit: "PIECES", quantity_pieces: 5000, price_amount: 0.5, price_pieces_count: 1, weight_kg: 100, weight_pieces_count: 10000, weight_source: "SIZE" });
  });

  test("payload omits weight when blank", () => {
    const payload = toPayloadLine({ ...emptyLine(), product_size_id: "p", unit: "PIECES", quantity_pieces: 10, price_amount: 1, price_pieces_count: 1 });
    expect(payload).not.toHaveProperty("weight_kg");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npm test`
Expected: FAIL — `./orderFormLines` missing.

- [ ] **Step 3: Implement `frontend/src/utils/orderFormLines.js`**

```js
import { lineAmount, lineKg } from "./orderMath";

const has = (v) => v !== null && v !== undefined && v !== "";
const num = (v) => (has(v) ? parseFloat(v) : "");

/** Units a size can be sold in — only those it has a price for. */
export const availableUnits = (size) => {
  if (!size) return ["KG", "PIECES"];
  const units = [];
  if (has(size.rate_per_kg)) units.push("KG");
  if (has(size.piece_price_amount)) units.push("PIECES");
  return units;
};

export const emptyLine = () => ({
  product_size_id: "",
  unit: "KG",
  quantity_kg: 1,
  rate_per_kg: 0,
  quantity_pieces: "",
  price_amount: "",
  price_pieces_count: "",
  weight_kg: "",
  weight_pieces_count: "",
  weight_source: null,
});

/** A saved order line (API shape) → form state. */
export const lineFromOrderItem = (item) => {
  if (item.unit === "PIECES") {
    return {
      ...emptyLine(),
      product_size_id: item.product_size_id,
      unit: "PIECES",
      quantity_pieces: item.quantity_pieces,
      price_amount: num(item.price_amount),
      price_pieces_count: item.price_pieces_count,
      weight_kg: num(item.weight_kg),
      weight_pieces_count: item.weight_pieces_count ?? "",
      weight_source: item.weight_source ?? null,
    };
  }
  return {
    ...emptyLine(),
    product_size_id: item.product_size_id,
    unit: "KG",
    quantity_kg: parseFloat(item.quantity_kg),
    rate_per_kg: parseFloat(item.rate_per_kg || item.productSize.rate_per_kg),
  };
};

const withSizeWeight = (line, size) =>
  has(size.weight_kg)
    ? { ...line, weight_kg: parseFloat(size.weight_kg), weight_pieces_count: size.weight_pieces_count, weight_source: "SIZE" }
    : line;

/** User picked a size on a line. */
export const applySizeSelection = (line, size) => {
  if (!size) return { ...line, product_size_id: "" };
  const changed = size.id !== line.product_size_id;
  let next = { ...line, product_size_id: size.id };

  const units = availableUnits(size);
  if (units.length && !units.includes(next.unit)) next.unit = units[0];

  // kg: pre-fill only if the line has no rate yet (unchanged behaviour).
  if (!next.rate_per_kg) next.rate_per_kg = has(size.rate_per_kg) ? parseFloat(size.rate_per_kg) : 0;

  // pieces: a new size means new price/weight — never keep the old size's.
  if (changed) {
    next = { ...next, price_amount: "", price_pieces_count: "", weight_kg: "", weight_pieces_count: "", weight_source: null };
  }
  if (!has(next.price_amount) && has(size.piece_price_amount)) {
    next = { ...next, price_amount: parseFloat(size.piece_price_amount), price_pieces_count: size.piece_price_count };
  }
  if (!has(next.weight_kg)) next = withSizeWeight(next, size);
  return next;
};

/** A weight was just saved on the size: fill this line only if it has none. */
export const applySizeWeight = (line, size) => (has(line.weight_kg) ? line : withSizeWeight(line, size));

const isWholePositive = (v) => has(v) && Number.isInteger(Number(v)) && Number(v) >= 1;

/** Live amount + kg for the form; null where the line is incomplete. */
export const previewLine = (line, size) => {
  if (line.unit === "PIECES") {
    const complete = isWholePositive(line.quantity_pieces) && has(line.price_amount) && isWholePositive(line.price_pieces_count);
    if (!complete) return { amount: null, kg: null };
    const weighed = has(line.weight_kg) && isWholePositive(line.weight_pieces_count);
    const mathLine = { ...line, weight_kg: weighed ? line.weight_kg : null, weight_pieces_count: weighed ? line.weight_pieces_count : null };
    return { amount: lineAmount(mathLine), kg: lineKg(mathLine) };
  }
  if (!size || !line.quantity_kg) return { amount: null, kg: null };
  return { amount: lineAmount({ ...line, rate_per_kg: line.rate_per_kg || size.rate_per_kg }, size), kg: parseFloat(line.quantity_kg) };
};

/** Form state → API payload line (only the chosen unit's fields). */
export const toPayloadLine = (line) => {
  if (line.unit !== "PIECES") {
    return { product_size_id: line.product_size_id, unit: "KG", quantity_kg: line.quantity_kg, rate_per_kg: line.rate_per_kg };
  }
  const payload = {
    product_size_id: line.product_size_id,
    unit: "PIECES",
    quantity_pieces: Number(line.quantity_pieces),
    price_amount: line.price_amount,
    price_pieces_count: line.price_pieces_count,
  };
  if (has(line.weight_kg) && has(line.weight_pieces_count)) {
    payload.weight_kg = line.weight_kg;
    payload.weight_pieces_count = line.weight_pieces_count;
    payload.weight_source = line.weight_source || "MANUAL";
  }
  return payload;
};
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npm test`
Expected: PASS.

- [ ] **Step 5: Create `frontend/src/components/orders/OrderLineFields.jsx`**

```jsx
import { useState } from "react";
import PropTypes from "prop-types";
import { FaTrash, FaExclamationTriangle } from "react-icons/fa";
import Dropdown from "../ui/Dropdown";
import { formatCurrency, formatKg, formatPiecePrice, perPieceWeightHint } from "../../utils/formatters";
import { availableUnits, applySizeSelection, applySizeWeight, previewLine } from "../../utils/orderFormLines";

const sizeOptionLabel = (size) => {
  const parts = [];
  if (size.rate_per_kg !== null && size.rate_per_kg !== undefined) parts.push(`${formatCurrency(size.rate_per_kg)}/kg`);
  if (size.piece_price_amount !== null && size.piece_price_amount !== undefined) parts.push(formatPiecePrice(size.piece_price_amount, size.piece_price_count));
  return `${size.size_label} (${parts.join(" · ")})`;
};

const OrderLineFields = ({ item, index, productSizes, onChange, onRemove, canRemove, onSaveSizeWeight }) => {
  const size = productSizes.find((ps) => ps.id === item.product_size_id);
  const units = availableUnits(size);
  const { amount, kg } = previewLine(item, size);
  const [weightDraft, setWeightDraft] = useState({ open: false, count: "", kg: "", saving: false, error: "" });

  const set = (patch) => onChange(index, { ...item, ...patch });
  const sizeHasWeight = size && size.weight_kg !== null && size.weight_kg !== undefined;
  const lineHasWeight = item.weight_kg !== "" && item.weight_kg !== null;

  const saveWeight = async () => {
    setWeightDraft((d) => ({ ...d, saving: true, error: "" }));
    try {
      const updated = await onSaveSizeWeight(size, { weight_pieces_count: weightDraft.count, weight_kg: weightDraft.kg });
      onChange(index, applySizeWeight(item, updated));
      setWeightDraft({ open: false, count: "", kg: "", saving: false, error: "" });
    } catch (err) {
      setWeightDraft((d) => ({ ...d, saving: false, error: err.response?.data?.message || "Could not save the weight" }));
    }
  };

  return (
    <div className="product-size-row">
      <div className="form-group">
        <label htmlFor={`product_size_${index}`}>Size</label>
        <Dropdown
          id={`product_size_${index}`}
          name={`product_size_${index}`}
          value={item.product_size_id}
          onChange={(e) => onChange(index, applySizeSelection(item, productSizes.find((ps) => ps.id === e.target.value)))}
          placeholder="Select Size"
          required
          options={[{ value: "", label: "Select Size" }, ...productSizes.map((s) => ({ value: s.id, label: sizeOptionLabel(s) }))]}
        />
      </div>

      <div className="form-group">
        <label>Unit</label>
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-emerald-900/30 overflow-hidden" role="group" aria-label="Unit">
          {[["KG", "Kg"], ["PIECES", "Pcs"]].map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={!units.includes(value)}
              onClick={() => set({ unit: value })}
              className={`px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                item.unit === value ? "bg-primary text-white" : "bg-white dark:bg-[#161d1a] text-gray-700 dark:text-emerald-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {item.unit === "KG" ? (
        <>
          <div className="form-group">
            <label htmlFor={`quantity_${index}`}>Quantity (kg)</label>
            <input type="number" id={`quantity_${index}`} value={item.quantity_kg}
              onChange={(e) => set({ quantity_kg: parseFloat(e.target.value) })}
              min="0.1" step="0.1" required className="form-control" />
          </div>
          <div className="form-group">
            <label htmlFor={`rate_${index}`}>
              Rate/kg
              {size && (
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">(Default: {formatCurrency(size.rate_per_kg || 0)})</span>
              )}
            </label>
            <input type="number" id={`rate_${index}`} value={item.rate_per_kg || ""}
              onChange={(e) => set({ rate_per_kg: e.target.value ? parseFloat(e.target.value) : null })}
              min="0" step="0.01" placeholder="Custom rate (optional)" className="form-control" />
          </div>
        </>
      ) : (
        <>
          <div className="form-group">
            <label htmlFor={`quantity_pcs_${index}`}>Quantity (pcs)</label>
            <input type="number" id={`quantity_pcs_${index}`} value={item.quantity_pieces}
              onChange={(e) => set({ quantity_pieces: e.target.value === "" ? "" : Number(e.target.value) })}
              min="1" step="1" required className="form-control" />
          </div>
          <div className="form-group">
            <label>Price</label>
            <div className="flex items-center gap-2">
              <input type="number" aria-label="Priced per number of pieces" value={item.price_pieces_count}
                onChange={(e) => set({ price_pieces_count: e.target.value === "" ? "" : Number(e.target.value) })}
                min="1" step="1" required className="form-control w-24" />
              <span className="text-sm whitespace-nowrap text-gray-600 dark:text-gray-300">pcs cost ₹</span>
              <input type="number" aria-label="Price for those pieces" value={item.price_amount}
                onChange={(e) => set({ price_amount: e.target.value === "" ? "" : parseFloat(e.target.value) })}
                min="0" step="0.0001" required className="form-control" />
            </div>
          </div>
          <div className="form-group">
            <label>Weight <span className="text-xs text-gray-500">(optional)</span></label>
            <div className="flex items-center gap-2">
              <input type="number" aria-label="Number of pieces weighed" value={item.weight_pieces_count}
                onChange={(e) => set({ weight_pieces_count: e.target.value === "" ? "" : Number(e.target.value), weight_source: "MANUAL" })}
                min="1" step="1" className="form-control w-24" />
              <span className="text-sm whitespace-nowrap text-gray-600 dark:text-gray-300">pcs weigh</span>
              <input type="number" aria-label="Weight in kg" value={item.weight_kg}
                onChange={(e) => set({ weight_kg: e.target.value === "" ? "" : parseFloat(e.target.value), weight_source: "MANUAL" })}
                min="0" step="0.001" className="form-control" />
              <span className="text-sm text-gray-600 dark:text-gray-300">kg</span>
            </div>
            {item.weight_source === "MANUAL" && lineHasWeight && <p className="text-xs text-gray-500 mt-1">Measured weight for this order</p>}
          </div>

          {size && !sizeHasWeight && !lineHasWeight && (
            <div className="sm:col-span-full rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-3 text-sm text-amber-800 dark:text-amber-300">
              <p className="flex items-start gap-2">
                <FaExclamationTriangle className="mt-0.5 flex-shrink-0" />
                <span>Weight not set for {size.size_label}, so this line&apos;s kg can&apos;t be calculated. Add it for the size, type a measured weight above, or skip.</span>
              </p>
              {!weightDraft.open ? (
                <button type="button" className="btn-sm mt-2" onClick={() => setWeightDraft((d) => ({ ...d, open: true }))}>
                  Set weight for {size.size_label}
                </button>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="number" aria-label="Pieces" value={weightDraft.count} onChange={(e) => setWeightDraft((d) => ({ ...d, count: e.target.value }))}
                    min="1" step="1" className="form-control w-24" placeholder="10000" />
                  <span>pcs weigh</span>
                  <input type="number" aria-label="Kg" value={weightDraft.kg} onChange={(e) => setWeightDraft((d) => ({ ...d, kg: e.target.value }))}
                    min="0" step="0.001" className="form-control w-28" placeholder="100" />
                  <span>kg</span>
                  {weightDraft.count && weightDraft.kg && <span className="text-xs">{perPieceWeightHint(weightDraft.kg, weightDraft.count)}</span>}
                  <button type="button" className="btn-sm" disabled={!weightDraft.count || !weightDraft.kg || weightDraft.saving} onClick={saveWeight}>
                    {weightDraft.saving ? "Saving..." : "Save to size"}
                  </button>
                  {weightDraft.error && <p className="w-full text-red-600">{weightDraft.error}</p>}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="form-group amount-column">
        <label>Amount</label>
        <div className="amount-display">
          {formatCurrency(amount ?? 0)}
          {item.unit === "PIECES" && amount !== null && (
            <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">{kg === null ? "kg: weight not set" : `≈ ${formatKg(kg)}`}</span>
          )}
        </div>
      </div>

      <button type="button" className="btn-icon remove-btn" onClick={() => onRemove(index)} disabled={!canRemove}>
        <FaTrash />
      </button>
    </div>
  );
};

OrderLineFields.propTypes = {
  item: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  productSizes: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  canRemove: PropTypes.bool.isRequired,
  onSaveSizeWeight: PropTypes.func.isRequired,
};

export default OrderLineFields;
```

- [ ] **Step 6: Wire it into `OrderForm.jsx`**

1. Imports: add
```jsx
import OrderLineFields from "./OrderLineFields";
import { emptyLine, lineFromOrderItem, previewLine, toPayloadLine } from "../../utils/orderFormLines";
import { productSizeAPI } from "../../services/api";
```
and remove `FaTrash` from the react-icons import.
2. Props: add `onProductSizeUpdated` to the destructuring and to `propTypes` as `PropTypes.func` (default `() => {}` in `defaultProps`).
3. Initial state: `product_sizes: [emptyLine()],`.
4. In the `initialValues` effect: `const productSizesData = initialValues.orderProductSizes?.map(lineFromOrderItem) || [emptyLine()];`
5. In the totals effect replace the `formData.product_sizes.forEach(...)` block with:
```jsx
    formData.product_sizes.forEach((item) => {
      const productSize = productSizes.find((ps) => ps.id === item.product_size_id);
      const { amount: lineTotal } = previewLine(item, productSize);
      if (lineTotal !== null) amount += lineTotal;
    });
```
6. Replace `handleProductSizeChange` with:
```jsx
  const handleLineChange = (index, nextLine) => {
    setFormData((prev) => {
      const product_sizes = [...prev.product_sizes];
      product_sizes[index] = nextLine;
      return { ...prev, product_sizes };
    });
  };

  const saveSizeWeight = async (size, weight) => {
    const response = await productSizeAPI.update(size.id, {
      size_label: size.size_label,
      rate_per_kg: size.rate_per_kg,
      piece_price_amount: size.piece_price_amount,
      piece_price_count: size.piece_price_count,
      ...weight,
    });
    const updated = response.data.data;
    onProductSizeUpdated(updated);
    return updated;
  };
```
7. `addProductSize`: append `emptyLine()`.
8. `handleSubmit`: `onSubmit({ ...formData, product_sizes: formData.product_sizes.map(toPayloadLine) });`
9. Replace the whole `{formData.product_sizes.map((item, index) => ( <div key={index} className="product-size-row"> … </div> ))}` block with:
```jsx
          {formData.product_sizes.map((item, index) => (
            <OrderLineFields
              key={index}
              item={item}
              index={index}
              productSizes={productSizes}
              onChange={handleLineChange}
              onRemove={removeProductSize}
              canRemove={formData.product_sizes.length > 1}
              onSaveSizeWeight={saveSizeWeight}
            />
          ))}
```

- [ ] **Step 7: Pages**

`CreateOrder.jsx` and `EditOrder.jsx`: pass to `<OrderForm … />`:
```jsx
onProductSizeUpdated={(updated) => setProductSizes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))}
```

`EditOrder.jsx`: directly above the "Form Card" `<div>`, add the invoiced warning:
```jsx
      {order?.invoice_id && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-4 text-sm text-amber-800 dark:text-amber-300">
          This order is on invoice #{order.invoice?.invoice_number || "—"}. Changes here won&apos;t update the invoice.
          Delete and regenerate the invoice to update it.
        </div>
      )}
```

Also change `EditOrder`'s `handleSubmit` catch to surface the server's 400 message: `setError(err.response?.data?.message || "Failed to update order. Please try again.");` — same in `CreateOrder` (`"Failed to create order. Please try again."`).

- [ ] **Step 8: Lint, test, build**

Run: `cd frontend && npm test && npx eslint src/utils/orderFormLines.js src/components/orders/OrderLineFields.jsx src/components/orders/OrderForm.jsx src/pages/CreateOrder.jsx src/pages/EditOrder.jsx && npx vite build`
Expected: tests pass; no new lint errors in these files; build succeeds.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/utils/orderFormLines.js frontend/src/utils/orderFormLines.test.js frontend/src/components/orders/OrderLineFields.jsx frontend/src/components/orders/OrderForm.jsx frontend/src/pages/CreateOrder.jsx frontend/src/pages/EditOrder.jsx
git commit -m "feat(orders-ui): Kg/Pcs lines, editable piece price and weight, weight reminder, invoiced warning

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Frontend — order display, invoice screens

**Files:**
- Modify: `frontend/src/pages/OrderDetails.jsx`, `frontend/src/components/orders/OrderList.jsx`, `frontend/src/components/invoices/GenerateInvoiceForm.jsx`, `frontend/src/components/invoices/InvoiceDetails.jsx`

**Interfaces:**
- Consumes: `lineAmount`, `volumeSummary` (orderMath); `formatLineQuantity`, `formatLineRate`, `formatLineKg`, `formatKg`, `formatNumber`, `formatInvoiceQty`, `formatInvoiceRate` (formatters).

- [ ] **Step 1: `OrderDetails.jsx`**

- Imports: `import { lineAmount } from "../utils/orderMath";` and add `formatLineQuantity, formatLineRate, formatLineKg` to the formatters import.
- `totalProductAmount`: `order.orderProductSizes.reduce((sum, item) => sum + lineAmount(item), 0);`
- Mobile card: amount → `{formatCurrency(lineAmount(item))}`; the sub-line `<span>{item.quantity_kg} kg × …/kg</span>` →
```jsx
<span>{formatLineQuantity(item)} × {formatLineRate(item)}</span>
{formatLineKg(item) && <span>{formatLineKg(item)}</span>}
```
- Desktop table headers: `Quantity (kg)` → `Quantity`, `Rate per kg` → `Rate`. Cells:
```jsx
<td className="p-4 align-middle text-gray-700 dark:text-gray-300">
  {formatLineQuantity(item)}
  {formatLineKg(item) && <span className="block text-xs text-gray-500 dark:text-gray-400">{formatLineKg(item)}</span>}
</td>
<td className="p-4 align-middle text-gray-700 dark:text-gray-300">{formatLineRate(item)}</td>
<td className="p-4 align-middle text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(lineAmount(item))}</td>
```

- [ ] **Step 2: `OrderList.jsx`**

- Imports: `import { lineAmount, volumeSummary } from "../../utils/orderMath";`, add `formatLineQuantity, formatLineRate, formatLineKg, formatKg, formatNumber` to formatters import, and `FaWeightHanging` to react-icons.
- `summary` memo: replace the `totalKg` accumulation with `const volume = volumeSummary(ordersForSummary);` and return `{ volume, totalAmount, totalReceivable }` (drop `totalKg`).
- Mobile expanded row: `({item.quantity_kg} kg)` → `({formatLineQuantity(item)}{formatLineKg(item) ? ` · ${formatLineKg(item)}` : ""})`; amount → `formatCurrency(lineAmount(item))`.
- Desktop expanded table: headers `Quantity`, `Rate`; cells `formatLineQuantity(item)` (+ kg sub-line as in OrderDetails), `formatLineRate(item)`, `formatCurrency(lineAmount(item))`.
- Summary strip: change grid to `grid-cols-2 lg:grid-cols-4`, and replace the **Quantity** card with two cards:
```jsx
            {/* Kg sold */}
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-[#0d1411] rounded-xl border border-gray-200/60 dark:border-emerald-900/30 p-3 sm:p-4">
              <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <FaWeightHanging className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-emerald-100/50 uppercase tracking-wide">Kg sold</p>
                <h3 className="text-lg font-bold text-gray-900 dark:text-emerald-100 font-display">{formatKg(summary.volume.kgSold)}</h3>
                {summary.volume.kgFromPieces > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatKg(summary.volume.kgFromKgLines)} ordered + ≈{formatKg(summary.volume.kgFromPieces)} from pcs</p>
                )}
                {summary.volume.piecesWithoutWeight > 0 && (
                  <Link to="/product-sizes" className="text-xs text-amber-600 dark:text-amber-400">
                    + {formatNumber(summary.volume.piecesWithoutWeight)} pcs without weight (not in kg)
                  </Link>
                )}
              </div>
            </div>

            {/* Pieces sold */}
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-[#0d1411] rounded-xl border border-gray-200/60 dark:border-emerald-900/30 p-3 sm:p-4">
              <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400">
                <FaBoxes className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-emerald-100/50 uppercase tracking-wide">Pieces sold</p>
                <h3 className="text-lg font-bold text-gray-900 dark:text-emerald-100 font-display">{formatNumber(summary.volume.piecesTotal)} pcs</h3>
              </div>
            </div>
```

- [ ] **Step 3: `GenerateInvoiceForm.jsx`**

Import `lineAmount` from `../../utils/orderMath` and replace the inner `for (const item of order.orderProductSizes) { … }` with:
```jsx
                for (const item of order.orderProductSizes) {
                  productAmount += lineAmount(item);
                }
```

- [ ] **Step 4: `InvoiceDetails.jsx`**

Import `formatInvoiceQty, formatInvoiceRate` from formatters; header `Unit Price` → `Rate`; cells:
```jsx
<td className="py-3 px-4 text-sm text-gray-900 dark:text-white text-right">{formatInvoiceQty(item)}</td>
<td className="py-3 px-4 text-sm text-gray-900 dark:text-white text-right">{formatInvoiceRate(item)}</td>
```
Update `backend/knowledge/invoices.md` step 2's table description to "(Description, Quantity, Rate, Amount)".

- [ ] **Step 5: Lint + build**

Run: `cd frontend && npx eslint src/pages/OrderDetails.jsx src/components/orders/OrderList.jsx src/components/invoices/GenerateInvoiceForm.jsx src/components/invoices/InvoiceDetails.jsx && npx vite build`
Expected: no new lint errors in these files; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/OrderDetails.jsx frontend/src/components/orders/OrderList.jsx frontend/src/components/invoices/GenerateInvoiceForm.jsx frontend/src/components/invoices/InvoiceDetails.jsx backend/knowledge/invoices.md
git commit -m "feat(orders-ui): show pieces lines, est. kg, and kg/pieces totals; invoice units

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Dashboard summary pills

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `volumeSummary`, `formatKg`, `formatNumber`.

- [ ] **Step 1: Implement**

- Imports: `import { volumeSummary } from "../utils/orderMath";`, add `formatKg, formatNumber` to the formatters import; add `FaCubes` to react-icons.
- `SummaryStatPill`: add optional props `sub` (node) and a `violet` entry in `colorClasses`:
```jsx
    violet: {
      bg: "bg-violet-50 dark:bg-[#151419]",
      icon: "bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400",
      border: "border-violet-200/50 dark:border-violet-500/25",
      text: "text-violet-700 dark:text-violet-300",
      glow: "dark:shadow-[0_0_20px_-8px_rgba(139,92,246,0.4)]",
    },
```
and after the value `<p>` render `{sub && <div className="mt-1 text-[11px] sm:text-xs text-gray-500 dark:text-emerald-100/60">{sub}</div>}`; add `sub: PropTypes.node` if the file uses propTypes (it doesn't — skip).
- `ordersSummary` memo: replace the `totalKg` accumulation with `const volume = volumeSummary(allOrders);` and return `{ volume, totalAmount, totalReceivable }`.
- Summary bar grid: `grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3`. Replace the **Quantity** pill with:
```jsx
              <SummaryStatPill
                icon={FaWeight}
                label="Kg sold"
                value={formatKg(ordersSummary.volume.kgSold)}
                color="blue"
                sub={
                  <>
                    {ordersSummary.volume.kgFromPieces > 0 && (
                      <span className="block">{formatKg(ordersSummary.volume.kgFromKgLines)} ordered + ≈{formatKg(ordersSummary.volume.kgFromPieces)} from pcs</span>
                    )}
                    {ordersSummary.volume.piecesWithoutWeight > 0 && (
                      <Link to="/product-sizes" className="block text-amber-600 dark:text-amber-400">
                        + {formatNumber(ordersSummary.volume.piecesWithoutWeight)} pcs without weight (not in kg)
                      </Link>
                    )}
                  </>
                }
              />
              <SummaryStatPill
                icon={FaCubes}
                label="Pieces sold"
                value={`${formatNumber(ordersSummary.volume.piecesTotal)} pcs`}
                color="violet"
                sub={ordersSummary.volume.kgFromPieces > 0 ? `≈ ${formatKg(ordersSummary.volume.kgFromPieces)}` : null}
              />
```
Leave Amount and Receivable pills as they are.

- [ ] **Step 2: Lint + build**

Run: `cd frontend && npx eslint src/pages/Dashboard.jsx && npx vite build`
Expected: no new errors; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard.jsx
git commit -m "feat(dashboard): Kg sold / Pieces sold pills with unweighted-pieces note

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Full verification, local walkthrough, review, handoff

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: All automated checks**

Run:
```bash
cd backend && npm test
cd ../frontend && npm test && npx vite build
```
Expected: backend all suites pass (≥ 120 + new); frontend vitest pass; build OK.

- [ ] **Step 2: Local stack on the test DB**

```bash
cd backend && NODE_ENV=test node scripts/create-user.js demo demo-pass Demo
cd backend && NODE_ENV=test PORT=5000 node src/server.js        # background
cd frontend && VITE_API_URL=http://localhost:5000/api npx vite --port 5173   # background
```
(Port 5173 because the backend's non-production CORS allowlist has 5173, not Vite's configured 8080.)

- [ ] **Step 3: Click-through at 390px width (browser automation), recording a GIF**

1. Log in as `demo`. Create plate type "Test Plate" ₹500.
2. Product Sizes → New: "8x10" rate ₹180/kg, "1 piece costs ₹0.50", no weight → list shows `₹180.00/kg · ₹0.50/pc · —`.
3. New: "10x12", no kg rate, "1000 pieces cost ₹375", "10000 pieces weigh 100 kg".
4. New Order: customer, plate; line 1 = 8x10 **Kg** 50 → Amount ₹9,000.00; line 2 = 8x10 **Pcs** 5000 → ₹2,500.00, amber "Weight not set" note; line 3 = 10x12 (Kg disabled) **Pcs** 2000 → ₹750.00 · ≈ 20 kg. Save.
5. Orders list: Kg sold = 70 kg (50 + 20), note "+ 5,000 pcs without weight"; Pieces sold 7,000 pcs.
6. Edit 8x10 size: "10000 pieces weigh 100 kg" → message "weight added to 1 earlier order line". Orders list now 120 kg, no amber note.
7. Order details: pcs lines show "≈ 50 kg", "≈ 20 kg"; total = 9000 + 2500 + 750 + 500 = ₹12,750.00.
8. Edit order: change 8x10 pcs price to "1 pcs cost ₹2" → total ₹20,250.00.
9. Generate invoice → invoice screen shows "₹0.50/pc"-style rates and "5,000 pcs"; download PDF, verify Rate/Qty columns fit on one line.
10. Edit the invoiced order → amber invoice warning visible.
11. Dashboard: Kg sold / Pieces sold pills match the Orders page.
12. Jarvis: "how many kg did we sell?" → matches the pill (needs a provider key in `.env.test`; skip if absent and note it).

- [ ] **Step 4: Whole-branch code review**

Dispatch a fresh reviewer on the most capable model over `git diff main...feature/piece-orders` with the spec and this plan; focus on the Review Focus list, money math, migration, and back-fill. Fix confirmed findings (TDD), re-run Step 1.

- [ ] **Step 5: Update `HANDOFF.md`**

Add under **Modules**: a "Piece orders (2026-09-30)" paragraph — units per line, shared `orderMath` on both sides + vectors, snapshot rule, back-fill rule, canonical SQL markers in `schema.md`, migration `20260930000001`. Add to **Tests**: `frontend: npm test (vitest)`. Update the "Last updated" line.

- [ ] **Step 6: Commit**

```bash
git add HANDOFF.md
git commit -m "docs: handoff for piece-based orders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Production rollout (each step needs the owner's go-ahead)

- [ ] **Step 1: Pre-flight (read-only)**

```bash
gcloud auth list    # dk7696822@gmail.com credentialed
cd frontend && npx firebase-tools login:list
cd backend && NODE_ENV=production npx sequelize db:migrate:status   # only 20260930000001 pending
```

- [ ] **Step 2: Full backup** — ask first.

```bash
pg_dump --version   # must be ≥ the Supabase server major version
# if local pg_dump is missing/broken, use Docker:
docker run --rm -e PGPASSWORD="$DB_PASSWORD" postgres:17-alpine pg_dump -h "$DB_HOSTNAME" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" > ~/yars-full-backup-2026-09-30.sql
```
(Load `DB_*` from `backend/.env` into the shell without echoing them.) Verify the file is non-empty and contains `CREATE TABLE public.order_product_sizes`.

- [ ] **Step 3: Before snapshot** (read-only)

```bash
cd backend && NODE_ENV=production node scripts/piece-orders-snapshot.js --mode before --out ~/yars-snap-before.json
```

- [ ] **Step 4: Migrate** — ask first.

```bash
cd backend && NODE_ENV=production npx sequelize db:migrate
```
Expected: `20260930000001-add-piece-orders: migrated`. If it fails, nothing changed (single transaction) — stop and investigate.

- [ ] **Step 5: After snapshot + compare**

```bash
cd backend && NODE_ENV=production node scripts/piece-orders-snapshot.js --mode after --out ~/yars-snap-after.json
node scripts/piece-orders-snapshot.js --compare ~/yars-snap-before.json ~/yars-snap-after.json
```
Expected: `✅ Identical: …`. **Any difference → stop**, run `NODE_ENV=production npx sequelize db:migrate:undo`, investigate before any deploy.

- [ ] **Step 6: Deploy backend** — ask first.

```bash
gcloud builds submit backend/ --tag asia-south1-docker.pkg.dev/yars-dashboard/yars-backend-repo/yars-backend --project yars-dashboard --account dk7696822@gmail.com
gcloud run deploy yars-backend --image asia-south1-docker.pkg.dev/yars-dashboard/yars-backend-repo/yars-backend --region asia-south1 --project yars-dashboard --account dk7696822@gmail.com
curl -s https://yars-backend-848592267490.asia-south1.run.app/api/health
```

- [ ] **Step 7: Deploy frontend** — ask first.

```bash
cd frontend && npm run build && npx firebase-tools deploy --only hosting --project yars-dashboard
```

- [ ] **Step 8: Read-only production checks**

- Assistant role sees new columns: `psql "$ASSISTANT_DB_URL" -c "SELECT unit, COUNT(*) FROM order_product_sizes GROUP BY unit"` (or via Docker psql) → only `KG`.
- Owner opens https://yars-dashboard.web.app: Dashboard Amount/Receivable unchanged vs before deploy; Kg sold equals the old "Quantity".
- Owner's first real pieces order: verify its total and est. kg together.

- [ ] **Step 9: Merge + record**

With the owner's OK: merge `feature/piece-orders` into `main` (`git checkout main && git merge --no-ff feature/piece-orders`), keep the backup/snapshot files in `~`, update memory notes.

**Rollback:** Cloud Run `gcloud run services update-traffic yars-backend --to-revisions yars-backend-00017-cpt=100 --region asia-south1 --project yars-dashboard --account dk7696822@gmail.com`; Firebase: Hosting → Release history → Rollback (or rebuild/deploy from `main`); DB: `db:migrate:undo` only while no pieces lines/piece-only sizes exist (the `down` refuses otherwise — old code runs fine on the new schema).
