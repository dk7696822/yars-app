# UX Redesign Part 2 — Every Remaining Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Expenses, History, Stock & purchasing, Login, Jarvis and Not-found onto the Midnight Forest & Brass kit, then delete every legacy stylesheet, component and dependency.

**Architecture:** Screens only — every page keeps its existing endpoint and payload (contracts captured from the current pages). Logic (filters, grouping, labels, form validation, payload building) goes into pure modules tested first with Vitest; pages are thin React on `src/ui/` + TanStack Query hooks per feature folder.

**Tech Stack:** React 19, Vite 6, Tailwind 3, TanStack Query 5, motion, lucide-react, Vitest. Backend: Jarvis knowledge docs and the audit-list date filter (read-only).

**Spec:** `docs/superpowers/specs/2026-09-30-ux-redesign-2-rest-design.md`

## Global Constraints

- **Screens only.** No schema, stock, money or endpoint changes. Backend changes: `backend/knowledge/*.md`, plus one read-only fix — the audit list's date filter uses India days and accepts a comma list of types (Task 4).
- Reuse the part-1 kit (`src/ui/*`), helpers (`parseNumber`, `todayIST`, `addDays`, `groupByDay`, `inr`, `formatNumber`, `mobileStatus`, `mobileDigits`, `errorText`), `FORM_PAGE`, `StickyFooter`, `PageHeader`, `ConfirmDialog`, `ActionSheet`, `SearchPicker`, `Chips`, `Tabs`, `Pair`, `Stepper`, `useSteps`, `ReviewBlock`.
- Every number the user types goes through `parseNumber`; every ₹ figure through `inr`/`Money`; every stored date is a `YYYY-MM-DD` string from `todayIST()`/`DateField` (never `toISOString()` of a local date).
- Destructive actions only under ⋯ or at the end of an edit form, always through `ConfirmDialog`; server error messages shown verbatim via `errorText`.
- Multi-step forms: Back on every step, data kept, tappable progress, Edit on review.
- Stage files by explicit path; commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Frontend baseline: 159 tests, lint 0 errors (3 warnings); backend 284 tests.

## Review Focus

1. **Expense edit keeps the server's total** — the server recalculates `total_cost = quantity × unit_cost` on update, so the form shows the total read-only (pinned in Task 2 tests).
2. **Stock issue larger than stock on hand** — the form warns before saving and shows the server's "Insufficient stock…" message verbatim (Task 8).
3. **Receiving more than ordered** — allowed (server records over-receipt); the form warns per line (Task 7 `isOverReceipt` test).
4. **History entries with missing metadata** (older rows, PAYMENT UPDATE without amount) — never blank or crash; fall back to new/old values or "<Entity> <action>" (Task 4 tests).
5. **Deleting something still in use** (expense category with expenses, item with stock, supplier with POs, attribute in use) — the server refuses with a message that must reach the user, and nothing disappears from the list (Tasks 3, 6, 9: `NameListEditor` / forms show `errorText`).

---

## File structure

- `src/lib/queryKeys.js` — add keys for expenses, history, stock, items, inventory categories/attributes, purchase orders, stock issues, suppliers, assistant.
- `src/services/inventoryAPI.js` — add `purchaseOrderAPI.cancel`.
- `src/ui/Tag.jsx` — small tone badge `{label, tone}`; `src/ui/NameListEditor.jsx` + `src/ui/nameList.js` (+test) — add / rename / delete list of names.
- `src/features/expenses/` — `expenseList.js`(+test), `expenseForm.js`(+test), `api.js`, `ExpensesPage.jsx`, `ExpenseFormPage.jsx`, `ExpenseCategoriesPage.jsx`, `CategoryPicker.jsx`.
- `src/features/history/` — `describeAudit.js`(+test), `HistoryPage.jsx`; backend `services/auditFilters.js`(+test).
- `src/features/inventory/` (stock, items, purchasing, issues, suppliers share one hooks file) — `labels.js`(+test), `itemForm.js`(+test), `poDraft.js`(+test), `receiveForm.js`(+test), `issueForm.js`(+test), `supplierForm.js`(+test), `recentItems.js`, `api.js`, `ItemPicker.jsx`, `SupplierPicker.jsx`, `OrderPicker.jsx`, `StockPage.jsx`, `StockItemPage.jsx`, `ItemsPage.jsx`, `ItemFormPage.jsx`, `InventoryCategoriesPage.jsx`, `ItemAttributesPage.jsx`, `PurchaseOrdersPage.jsx`, `NewPurchaseOrderPage.jsx`, `PurchaseOrderPage.jsx`, `ReceivePage.jsx`, `StockIssuesPage.jsx`, `NewStockIssuePage.jsx`, `SuppliersPage.jsx`, `SupplierPage.jsx`, `SupplierFormPage.jsx`.
- `src/features/auth/LoginPage.jsx`, `src/features/assistant/AssistantPage.jsx`, `src/utils/relativeTime.js`(+test), `src/app/NotFoundPage.jsx`.
- Rewritten: `components/auth/ProtectedRoute.jsx`, `components/theme/ThemeToggle.jsx`, `context/ToastContext.jsx`, `App.jsx`, `app/routeMeta.js`(+test).
- Deleted at the end: every `src/pages/*` still present, `components/{common,expenses,history}`, old `components/ui/*`, `app/Legacy.jsx`, `styles/*.css` (all), unused `assets/styles/index.css` rules, unused tailwind palettes, deps `react-datepicker`, `react-icons` (and `class-variance-authority`/`clsx`/`tailwind-merge`/`lib/utils.js`/`hooks/useApi.js` if unused).

---
### Task 1: Foundation — query keys, Tag, NameListEditor, PO cancel client

**Files:**
- Modify: `frontend/src/lib/queryKeys.js`, `frontend/src/services/inventoryAPI.js`
- Create: `frontend/src/ui/Tag.jsx`, `frontend/src/ui/nameList.js`, `frontend/src/ui/nameList.test.js`, `frontend/src/ui/NameListEditor.jsx`

**Interfaces (Produces):**
- `keys.expenses.{all,list(p),detail(id),categories}`, `keys.history.list(p)`, `keys.stock.{all,list(p),summary,item(id),movements(id,p)}`, `keys.items.{all,list(p),picker,detail(id)}`, `keys.inventory.{categories,attributes}`, `keys.purchaseOrders.{all,list(p),detail(id)}`, `keys.stockIssues.{all,list(p)}`, `keys.suppliers.{all,list(p),picker,detail(id)}`, `keys.assistant.conversations`
- `purchaseOrderAPI.cancel(id)` → axios promise (POST `/purchase-orders/:id/cancel`)
- `<Tag label tone>`; `cleanName(text) → string`; `<NameListEditor items onAdd(name) onRename(item,name) onDelete(item) addPlaceholder noun emptyText addLabel? renderExtra?(item) renderBelow?(item)>` — async callbacks; a rejected call shows `errorText(err)`.

- [ ] **Step 1: Failing test**

`frontend/src/ui/nameList.test.js`:

```js
import { describe, expect, test } from "vitest";
import { cleanName } from "./nameList";

describe("cleanName", () => {
  test("trims and collapses spaces", () => {
    expect(cleanName("  Blue   Bags ")).toBe("Blue Bags");
    expect(cleanName("   ")).toBe("");
    expect(cleanName(null)).toBe("");
  });
});
```

Run: `cd frontend && npx vitest run src/ui/nameList.test.js` → Expected: FAIL (module missing).

- [ ] **Step 2: Implement**

`frontend/src/ui/nameList.js`:

```js
/** A name as it should be saved: trimmed, single spaces. */
export const cleanName = (text) => String(text ?? "").trim().replace(/\s+/g, " ");
```

`frontend/src/ui/Tag.jsx`:

```jsx
import PropTypes from "prop-types";
import { TONE_CLASS } from "../utils/statusMeta";

/** A small status badge: tone is good | warn | critical | info | muted. */
export default function Tag({ label, tone = "muted" }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone] || TONE_CLASS.muted}`}>{label}</span>;
}

Tag.propTypes = { label: PropTypes.node.isRequired, tone: PropTypes.string };
```

`frontend/src/ui/NameListEditor.jsx`:

```jsx
import { useState } from "react";
import PropTypes from "prop-types";
import { Pencil, Trash2, Check, X } from "lucide-react";
import TextInput from "./TextInput";
import Button from "./Button";
import IconButton from "./IconButton";
import ConfirmDialog from "./ConfirmDialog";
import { cleanName } from "./nameList";
import { errorText } from "../lib/errors";

/**
 * Add / rename / delete a list of names (categories, attributes, values).
 * Callbacks are async; when one fails the server's message is shown and the
 * list stays as it was (e.g. "Cannot delete this category as it is being used…").
 */
export default function NameListEditor({ items, onAdd, onRename, onDelete, addPlaceholder, noun, emptyText, addLabel = "Add", renderExtra, renderBelow }) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(null); // { item, name }
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      return true;
    } catch (err) {
      setError(errorText(err, "That didn't work. Try again."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    const name = cleanName(draft);
    if (!name) return setError(`Enter the ${noun} name`);
    if (await run(() => onAdd(name))) setDraft("");
  };
  const rename = async () => {
    const name = cleanName(editing.name);
    if (!name) return setError(`Enter the ${noun} name`);
    if (await run(() => onRename(editing.item, name))) setEditing(null);
  };
  const remove = async () => {
    const item = removing;
    setRemoving(null);
    await run(() => onDelete(item));
  };

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="flex gap-2">
        <TextInput value={draft} onChange={(e) => { setDraft(e.target.value); setError(""); }} placeholder={addPlaceholder} aria-label={addPlaceholder} />
        <Button type="submit" loading={busy && !editing} disabled={!draft.trim()}>{addLabel}</Button>
      </form>
      {error && <p role="alert" className="text-sm text-status-critical">{error}</p>}
      {items.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-ink-2">{emptyText}</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-surface">
          {items.map((item) => (
            <li key={item.id} className="border-b border-line/60 last:border-0">
              {editing?.item.id === item.id ? (
                <div className="flex items-center gap-2 px-3 py-2">
                  <TextInput autoFocus value={editing.name} aria-label={`New name for ${item.name}`}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); rename(); } if (e.key === "Escape") setEditing(null); }} />
                  <IconButton label="Save name" onClick={rename} disabled={busy}><Check className="h-4 w-4" /></IconButton>
                  <IconButton label="Cancel rename" onClick={() => setEditing(null)} className="bg-transparent"><X className="h-4 w-4" /></IconButton>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-4 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{item.name}</span>
                  {renderExtra?.(item)}
                  <IconButton label={`Rename ${item.name}`} onClick={() => { setEditing({ item, name: item.name }); setError(""); }} className="h-9 w-9 bg-transparent text-ink-2"><Pencil className="h-4 w-4" /></IconButton>
                  <IconButton label={`Delete ${item.name}`} onClick={() => setRemoving(item)} className="h-9 w-9 bg-transparent text-ink-2"><Trash2 className="h-4 w-4" /></IconButton>
                </div>
              )}
              {renderBelow?.(item)}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={Boolean(removing)} title={`Delete ${removing?.name || ""}?`} confirmLabel="Delete" cancelLabel="Keep it"
        message="It will no longer be offered. If it's still in use it won't be deleted, and you'll see why." onConfirm={remove} onClose={() => setRemoving(null)} />
    </div>
  );
}

NameListEditor.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, name: PropTypes.string.isRequired })).isRequired,
  onAdd: PropTypes.func.isRequired, onRename: PropTypes.func.isRequired, onDelete: PropTypes.func.isRequired,
  addPlaceholder: PropTypes.string.isRequired, noun: PropTypes.string.isRequired, emptyText: PropTypes.string.isRequired,
  addLabel: PropTypes.string, renderExtra: PropTypes.func, renderBelow: PropTypes.func,
};
```

In `frontend/src/lib/queryKeys.js`, add inside `keys` (after `catalog`):

```js
  expenses: { all: ["expenses"], list: (p) => ["expenses", "list", p], detail: (id) => ["expenses", "detail", id], categories: ["expenses", "categories"] },
  history: { list: (p) => ["history", p] },
  stock: { all: ["stock"], list: (p) => ["stock", "list", p], summary: ["stock", "summary"], item: (id) => ["stock", "item", id], movements: (id, p) => ["stock", "movements", id, p] },
  items: { all: ["items"], list: (p) => ["items", "list", p], picker: ["items", "picker"], detail: (id) => ["items", "detail", id] },
  inventory: { categories: ["inventory", "categories"], attributes: ["inventory", "attributes"] },
  purchaseOrders: { all: ["purchase-orders"], list: (p) => ["purchase-orders", "list", p], detail: (id) => ["purchase-orders", "detail", id] },
  stockIssues: { all: ["stock-issues"], list: (p) => ["stock-issues", "list", p] },
  suppliers: { all: ["suppliers"], list: (p) => ["suppliers", "list", p], picker: ["suppliers", "picker"], detail: (id) => ["suppliers", "detail", id] },
  assistant: { conversations: ["assistant", "conversations"] },
```

In `frontend/src/services/inventoryAPI.js`, inside `purchaseOrderAPI` after `delete`, add:

```js
  cancel: (id) => api.post(`/purchase-orders/${id}/cancel`),
```

Run: `cd frontend && npx vitest run 2>&1 | grep -E "^ +Tests" && npx eslint src/ui src/lib src/services`
Expected: all pass (160); no lint errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/ui/Tag.jsx frontend/src/ui/nameList.js frontend/src/ui/nameList.test.js frontend/src/ui/NameListEditor.jsx frontend/src/lib/queryKeys.js frontend/src/services/inventoryAPI.js
git commit -m "feat(ui): tag badge, name-list editor, query keys for the remaining areas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Expenses — list and form

**Files:**
- Create: `frontend/src/features/expenses/expenseList.js`, `expenseList.test.js`, `expenseForm.js`, `expenseForm.test.js`, `api.js`, `CategoryPicker.jsx`, `ExpensesPage.jsx`, `ExpenseFormPage.jsx`
- Modify: `frontend/src/App.jsx`, `frontend/src/app/routeMeta.js`, `frontend/src/app/routeMeta.test.js`, `backend/knowledge/expenses.md`

**Interfaces:**
- Consumes: `expenseAPI` (`getAll(params)` → `res.data.data = { expenses, total_expense, count }`; `getById`, `create`, `update`, `delete`), `expenseCategoryAPI` (`getAll` → `res.data.data = Category[]`, `create({name})`), `exportAPI.downloadExpensesData(params)`.
- Produces: `EXPENSE_CHIPS`, `expenseParams({chip, categoryId, search}, today)`, `expenseTotals(expenses) → {total, unpaid, count}`, `groupExpenses(expenses, today)`; `emptyExpense(today)`, `formFromExpense(e)`, `expenseTotal(form) → number|null`, `validateExpense(form)`, `toExpensePayload(form)`; hooks `useExpenses(params)`, `useExpense(id)`, `useExpenseCategories()`, `useSaveExpense(id?)`, `useDeleteExpense()`, `useCategoryMutations() → {add(name), rename(item,name), remove(item)}`; `<CategoryPicker open onClose onPick(category)>`.

- [ ] **Step 1: Failing tests**

`frontend/src/features/expenses/expenseList.test.js`:

```js
import { describe, expect, test } from "vitest";
import { expenseParams, expenseTotals, groupExpenses } from "./expenseList";

describe("expenseParams", () => {
  test("period chips become date ranges (India dates)", () => {
    expect(expenseParams({ chip: "this_month" }, "2026-09-30")).toEqual({ from_date: "2026-09-01", to_date: "2026-09-30" });
    expect(expenseParams({ chip: "last_month" }, "2026-09-30")).toEqual({ from_date: "2026-08-01", to_date: "2026-08-31" });
    expect(expenseParams({ chip: "last_month" }, "2026-01-15")).toEqual({ from_date: "2025-12-01", to_date: "2025-12-31" });
    expect(expenseParams({ chip: "all" }, "2026-09-30")).toEqual({});
  });
  test("unpaid, category and search", () => {
    expect(expenseParams({ chip: "unpaid", categoryId: "c1", search: "  diesel " }, "2026-09-30")).toEqual({ payment_status: "UNPAID", category_id: "c1", search: "diesel" });
  });
});

describe("expenseTotals", () => {
  test("exact paise sums; unpaid separately", () => {
    const e = [{ total_cost: "0.10", payment_status: "PAID" }, { total_cost: "0.20", payment_status: "UNPAID" }, { total_cost: "1500.00", payment_status: "UNPAID" }];
    expect(expenseTotals(e)).toEqual({ total: 1500.3, unpaid: 1500.2, count: 3 });
  });
});

describe("groupExpenses", () => {
  test("grouped by bill date", () => {
    const e = [{ id: 1, bill_date: "2026-09-30" }, { id: 2, bill_date: "2026-09-30" }, { id: 3, bill_date: "2026-09-29" }];
    expect(groupExpenses(e, "2026-09-30").map((g) => [g.label, g.rows.length])).toEqual([["Today", 2], ["Yesterday", 1]]);
  });
});
```

`frontend/src/features/expenses/expenseForm.test.js`:

```js
import { describe, expect, test } from "vitest";
import { emptyExpense, formFromExpense, expenseTotal, validateExpense, toExpensePayload } from "./expenseForm";

const form = (o) => ({ ...emptyExpense("2026-09-30"), category_id: "c1", description: "Diesel", vendor: "HP Pump", unit_cost: "450", ...o });

describe("expense form", () => {
  test("required fields with plain messages", () => {
    expect(validateExpense(emptyExpense("2026-09-30"))).toEqual({
      category_id: "Choose a category", description: "Enter what it was for", vendor: "Enter who was paid", unit_cost: "Enter the cost",
    });
    expect(validateExpense(form())).toEqual({});
  });
  test("numbers: whole quantity, cost more than 0 with 2 decimals", () => {
    expect(validateExpense(form({ quantity: "1.5" }))).toEqual({ quantity: "Whole numbers only" });
    expect(validateExpense(form({ unit_cost: "0" }))).toEqual({ unit_cost: "Must be more than 0" });
    expect(validateExpense(form({ unit_cost: "12.345" }))).toEqual({ unit_cost: "Use at most 2 decimals" });
  });
  test("the total is always quantity × cost — the server recalculates it the same way on edit", () => {
    expect(expenseTotal(form({ quantity: "3", unit_cost: "12.5" }))).toBe(37.5);
    expect(expenseTotal(form({ unit_cost: "" }))).toBeNull();
  });
  test("payload", () => {
    expect(toExpensePayload(form({ quantity: "2", unit_cost: "1,250.50", description: " Diesel ", due_date: "" }))).toEqual({
      bill_date: "2026-09-30", category_id: "c1", description: "Diesel", vendor: "HP Pump", quantity: 2, unit_cost: 1250.5, total_cost: 2501, due_date: null, payment_status: "UNPAID",
    });
  });
  test("editing starts from the saved values", () => {
    expect(formFromExpense({ bill_date: "2026-09-01", category_id: "c1", category: { name: "Fuel" }, description: "D", vendor: "V", quantity: 2, unit_cost: "450.00", due_date: null, payment_status: "PAID" }))
      .toEqual({ bill_date: "2026-09-01", category_id: "c1", category_name: "Fuel", description: "D", vendor: "V", quantity: "2", unit_cost: "450", due_date: "", payment_status: "PAID" });
  });
});
```

Run: `cd frontend && npx vitest run src/features/expenses` → Expected: FAIL (modules missing).

- [ ] **Step 2: Implement the logic**

`frontend/src/features/expenses/expenseList.js`:

```js
import { addDays } from "../../utils/istDate";
import { groupByDay } from "../../utils/dayGroups";

export const EXPENSE_CHIPS = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
];

const monthStart = (d) => `${d.slice(0, 7)}-01`;

/** Screen filters → the /expenses query (dates are India dates). */
export const expenseParams = ({ chip = "this_month", categoryId, search }, today) => {
  const p = {};
  if (chip === "this_month") Object.assign(p, { from_date: monthStart(today), to_date: today });
  if (chip === "last_month") {
    const lastDay = addDays(monthStart(today), -1);
    Object.assign(p, { from_date: monthStart(lastDay), to_date: lastDay });
  }
  if (chip === "unpaid") p.payment_status = "UNPAID";
  if (categoryId) p.category_id = categoryId;
  if (search && search.trim()) p.search = search.trim();
  return p;
};

const paise = (x) => Math.round(Number(x) * 100);

/** Exact totals in paise, back to rupees. */
export const expenseTotals = (expenses) => {
  let total = 0;
  let unpaid = 0;
  for (const e of expenses) {
    const p = paise(e.total_cost);
    total += p;
    if (e.payment_status === "UNPAID") unpaid += p;
  }
  return { total: total / 100, unpaid: unpaid / 100, count: expenses.length };
};

export const groupExpenses = (expenses, today) => groupByDay(expenses, today, (e) => e.bill_date);
```

`frontend/src/features/expenses/expenseForm.js`:

```js
import { parseNumber } from "../../utils/numberInput";
import { isISODate } from "../../utils/istDate";

export const emptyExpense = (today) => ({
  bill_date: today, category_id: "", category_name: "", description: "", vendor: "", quantity: "1", unit_cost: "", due_date: "", payment_status: "UNPAID",
});

export const formFromExpense = (e) => ({
  bill_date: e.bill_date,
  category_id: e.category_id,
  category_name: e.category?.name || "",
  description: e.description || "",
  vendor: e.vendor || "",
  quantity: String(e.quantity ?? 1),
  unit_cost: e.unit_cost === null || e.unit_cost === undefined ? "" : String(Number(e.unit_cost)),
  due_date: e.due_date || "",
  payment_status: e.payment_status || "UNPAID",
});

/** Quantity × cost, to the paisa. The server stores (and on edit recalculates) exactly this. */
export const expenseTotal = (f) => {
  const q = parseNumber(f.quantity, { whole: true }).value;
  const u = parseNumber(f.unit_cost).value;
  return q === null || u === null ? null : Math.round(q * u * 100) / 100;
};

export const validateExpense = (f) => {
  const e = {};
  if (!isISODate(f.bill_date)) e.bill_date = "Choose the bill date";
  if (!f.category_id) e.category_id = "Choose a category";
  if (!f.description.trim()) e.description = "Enter what it was for";
  if (!f.vendor.trim()) e.vendor = "Enter who was paid";
  const q = parseNumber(f.quantity, { whole: true });
  if (q.error || q.value === null) e.quantity = q.error || "Enter the quantity";
  const u = parseNumber(f.unit_cost);
  if (u.error || u.value === null) e.unit_cost = u.error || "Enter the cost";
  if (f.due_date && !isISODate(f.due_date)) e.due_date = "Choose a valid date";
  return e;
};

export const toExpensePayload = (f) => ({
  bill_date: f.bill_date,
  category_id: f.category_id,
  description: f.description.trim(),
  vendor: f.vendor.trim(),
  quantity: parseNumber(f.quantity, { whole: true }).value,
  unit_cost: parseNumber(f.unit_cost).value,
  total_cost: expenseTotal(f),
  due_date: f.due_date || null,
  payment_status: f.payment_status,
});
```

Run: `cd frontend && npx vitest run src/features/expenses` → Expected: PASS.

- [ ] **Step 3: Hooks and picker**

`frontend/src/features/expenses/api.js`:

```js
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expenseAPI, expenseCategoryAPI } from "../../services/api";
import { keys } from "../../lib/queryKeys";

const body = (res) => res.data.data;
const notFound = (err) => err?.response?.status === 404;
const refresh = (qc) => qc.invalidateQueries({ queryKey: keys.expenses.all });

export const useExpenses = (params) =>
  useQuery({ queryKey: keys.expenses.list(params), queryFn: () => expenseAPI.getAll(params).then(body), placeholderData: (previous) => previous });

export const useExpense = (id) =>
  useQuery({ queryKey: keys.expenses.detail(id), queryFn: () => expenseAPI.getById(id).then(body), enabled: Boolean(id), retry: (n, err) => !notFound(err) && n < 1 });

export const useExpenseCategories = () =>
  useQuery({ queryKey: keys.expenses.categories, queryFn: () => expenseCategoryAPI.getAll().then(body), staleTime: 5 * 60_000 });

export const useSaveExpense = (id) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload) => (id ? expenseAPI.update(id, payload) : expenseAPI.create(payload)).then(body), onSuccess: () => refresh(qc) });
};

export const useDeleteExpense = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => expenseAPI.delete(id), onSuccess: () => refresh(qc) });
};

/** For NameListEditor and the picker's "＋ New category". */
export const useCategoryMutations = () => {
  const qc = useQueryClient();
  return {
    add: async (name) => { const created = body(await expenseCategoryAPI.create({ name })); await refresh(qc); return created; },
    rename: async (item, name) => { await expenseCategoryAPI.update(item.id, { name }); await refresh(qc); },
    remove: async (item) => { await expenseCategoryAPI.delete(item.id); await refresh(qc); },
  };
};
```

`frontend/src/features/expenses/CategoryPicker.jsx`:

```jsx
import { useState } from "react";
import PropTypes from "prop-types";
import SearchPicker from "../../ui/SearchPicker";
import Button from "../../ui/Button";
import { useExpenseCategories, useCategoryMutations } from "./api";
import { cleanName } from "../../ui/nameList";
import { errorText } from "../../lib/errors";

export default function CategoryPicker({ open, onClose, onPick }) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const categories = useExpenseCategories();
  const { add } = useCategoryMutations();
  const term = query.trim().toLowerCase();
  const items = (categories.data || []).filter((c) => c.name.toLowerCase().includes(term));
  const exact = (categories.data || []).some((c) => c.name.toLowerCase() === term);

  const create = async () => {
    setCreating(true);
    setError("");
    try {
      const c = await add(cleanName(query));
      onPick(c);
      setQuery("");
    } catch (err) {
      setError(errorText(err, "Couldn't add the category."));
    } finally {
      setCreating(false);
    }
  };

  return (
    <SearchPicker open={open} title="Choose category" query={query} onQuery={(q) => { setQuery(q); setError(""); }} placeholder="Search categories"
      loading={categories.isPending} error={error || (categories.isError ? "Couldn't load categories." : undefined)}
      items={items} getKey={(c) => c.id} renderItem={(c) => <span className="font-semibold text-ink">{c.name}</span>}
      onPick={(c) => { onPick(c); setQuery(""); }} onClose={onClose}
      empty={term ? `No category called “${query.trim()}”` : "No categories yet"}
      footer={term && !exact ? <Button variant="secondary" block loading={creating} onClick={create}>＋ New category “{cleanName(query)}”</Button> : null} />
  );
}

CategoryPicker.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onPick: PropTypes.func.isRequired };
```

- [ ] **Step 4: Pages**

`frontend/src/features/expenses/ExpensesPage.jsx`:

```jsx
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Ellipsis } from "lucide-react";
import { useExpenses, useExpenseCategories } from "./api";
import { EXPENSE_CHIPS, expenseParams, expenseTotals, groupExpenses } from "./expenseList";
import PageHeader from "../../ui/PageHeader";
import TextInput from "../../ui/TextInput";
import Chips from "../../ui/Chips";
import IconButton from "../../ui/IconButton";
import ActionSheet from "../../ui/ActionSheet";
import Tag from "../../ui/Tag";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import { todayIST } from "../../utils/istDate";
import { exportAPI } from "../../services/api";
import { useToast } from "../../context/ToastContext";

const PERIOD_LABEL = { this_month: "This month", last_month: "Last month", all: "All time", unpaid: "Unpaid" };

export default function ExpensesPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const chip = params.get("chip") || "this_month";
  const categoryId = params.get("cat") || "";
  const search = params.get("q") || "";
  const term = useDebounced(search.trim());
  const [menuOpen, setMenuOpen] = useState(false);
  const today = todayIST();
  const query = useMemo(() => expenseParams({ chip, categoryId, search: term }, today), [chip, categoryId, term, today]);
  const list = useExpenses(query);
  const categories = useExpenseCategories();
  const expenses = useMemo(() => list.data?.expenses || [], [list.data]);
  const totals = useMemo(() => expenseTotals(expenses), [expenses]);
  const groups = useMemo(() => groupExpenses(expenses, today), [expenses, today]);

  const setParam = (key, value, fallback = "") =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== fallback) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });

  const download = async () => {
    try {
      await exportAPI.downloadExpensesData(query);
    } catch {
      toast.error("Couldn't download the Excel file. Try again.");
    }
  };

  const categoryChips = [{ value: "", label: "All categories" }, ...(categories.data || []).map((c) => ({ value: c.id, label: c.name }))];

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Expenses" actions={<>
        <IconButton label="More expense actions" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>
        <Link to="/expenses/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>
      </>} />

      <div className="mt-3 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setParam("q", e.target.value)} placeholder="Search description or vendor" aria-label="Search expenses" enterKeyHint="search" />
        <Chips label="Period" options={EXPENSE_CHIPS} value={chip} onChange={(v) => setParam("chip", v, "this_month")} />
        {categoryChips.length > 1 && <Chips label="Category" options={categoryChips} value={categoryId} onChange={(v) => setParam("cat", v)} />}
      </div>

      <section aria-label="Total" className="mt-4 rounded-3xl bg-gradient-to-b from-raised to-surface p-4 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
        <p className="text-sm text-ink-2">{PERIOD_LABEL[chip]}{categoryId && categories.data ? ` · ${categories.data.find((c) => c.id === categoryId)?.name || ""}` : ""}</p>
        <Money value={totals.total} className="block text-3xl font-bold text-ink" />
        <p className="mt-1 text-sm text-ink-2">
          {totals.count} expense{totals.count === 1 ? "" : "s"}
          {totals.unpaid > 0 && <> · <span className="font-semibold text-status-warn">Unpaid <Money value={totals.unpaid} /></span></>}
        </p>
      </section>

      <div className={`mt-4 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? (
          <ListSkeleton />
        ) : list.isError && expenses.length === 0 ? (
          <ErrorState title="Couldn't load expenses." onRetry={() => list.refetch()} />
        ) : expenses.length === 0 ? (
          <EmptyState title="No expenses here" body={chip === "all" && !categoryId && !term ? "Add your first expense to start tracking." : "Try another period, category or search."}
            action={<Link to="/expenses/new" className={buttonClass()}>Add an expense</Link>} />
        ) : (
          groups.map((g) => (
            <section key={g.date} aria-labelledby={`exp-day-${g.date}`} className="mb-3">
              <h2 id={`exp-day-${g.date}`} className="sticky top-0 z-[1] bg-canvas/95 px-1 py-2 text-xs font-semibold text-ink-2 backdrop-blur">{g.label}</h2>
              <ul className="overflow-hidden rounded-2xl bg-surface">
                {g.rows.map((e) => (
                  <li key={e.id} className="border-b border-line/60 last:border-0">
                    <Link to={`/expenses/edit/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{e.description || "No description"}</span>
                        <span className="block truncate text-xs text-ink-2">{e.vendor || "No vendor"} · {e.category?.name || "Uncategorised"}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <Money value={Number(e.total_cost)} className="text-sm font-bold text-ink" />
                        {e.payment_status === "UNPAID" && <Tag label="Unpaid" tone="warn" />}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <ActionSheet open={menuOpen} title="Expenses" onClose={() => setMenuOpen(false)}
        actions={[{ label: "Download Excel of this list", onSelect: download }, { label: "Expense categories", onSelect: () => navigate("/expense-categories") }]} />
    </div>
  );
}
```

`frontend/src/features/expenses/ExpenseFormPage.jsx`:

```jsx
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useExpense, useSaveExpense, useDeleteExpense } from "./api";
import { emptyExpense, formFromExpense, expenseTotal, validateExpense, toExpensePayload } from "./expenseForm";
import CategoryPicker from "./CategoryPicker";
import Field from "../../ui/Field";
import TextInput from "../../ui/TextInput";
import NumberInput from "../../ui/NumberInput";
import DateField from "../../ui/DateField";
import Chips from "../../ui/Chips";
import Button from "../../ui/Button";
import StickyFooter from "../../ui/StickyFooter";
import PageHeader from "../../ui/PageHeader";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { FORM_PAGE, INPUT, INPUT_INVALID, buttonClass } from "../../ui/styles";
import { todayIST } from "../../utils/istDate";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

const PAID_OPTIONS = [{ value: "UNPAID", label: "Unpaid" }, { value: "PAID", label: "Paid" }];

export default function ExpenseFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const existing = useExpense(id);
  const save = useSaveExpense(id);
  const remove = useDeleteExpense();
  const initial = useMemo(() => (isEdit ? (existing.data ? formFromExpense(existing.data) : null) : emptyExpense(todayIST())), [isEdit, existing.data]);
  const [edited, setEdited] = useState(null);
  const [shown, setShown] = useState(false);
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isEdit && existing.isPending) return <PageSkeleton />;
  if (isEdit && existing.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {existing.error?.response?.status === 404
          ? <EmptyState title="This expense doesn't exist" body="It may have been deleted." action={<Link to="/expenses" className={buttonClass({ variant: "secondary" })}>All expenses</Link>} />
          : <ErrorState title="Couldn't load this expense." onRetry={() => existing.refetch()} />}
      </div>
    );
  }

  const f = edited ?? initial;
  const set = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));
  const errors = shown ? validateExpense(f) : {};
  const total = expenseTotal(f);
  const back = () => navigate("/expenses", { replace: true });

  const submit = (e) => {
    e.preventDefault();
    if (Object.keys(validateExpense(f)).length) {
      setShown(true);
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    save.mutate(toExpensePayload(f), { onSuccess: () => { toast.success(isEdit ? "Expense updated" : "Expense added"); back(); } });
  };

  const deleteExpense = () =>
    remove.mutate(id, {
      onSuccess: () => { toast.success("Expense deleted"); back(); },
      onError: (err) => toast.error(errorText(err, "Couldn't delete the expense. Try again.")),
    });

  return (
    <form onSubmit={submit} noValidate className={`${FORM_PAGE} pt-4`}>
      <PageHeader title={isEdit ? "Edit expense" : "New expense"} />
      <div className="space-y-5 pb-6 sm:mt-4">
        <Field label="Bill date" htmlFor="ex-date" error={errors.bill_date}>
          <DateField value={f.bill_date} onChange={(bill_date) => set({ bill_date })} />
        </Field>
        <Field label="Category" htmlFor="ex-category" error={errors.category_id}>
          <button type="button" onClick={() => setPicking(true)} className={`${INPUT} flex items-center justify-between gap-2 text-left ${errors.category_id ? INPUT_INVALID : ""}`}>
            {f.category_id ? <span className="truncate font-semibold">{f.category_name}</span> : <span className="text-ink-2">Choose a category</span>}
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
          </button>
        </Field>
        <Field label="What was it for" htmlFor="ex-desc" error={errors.description}>
          <TextInput value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. Diesel for the machine" />
        </Field>
        <Field label="Paid to" htmlFor="ex-vendor" error={errors.vendor}>
          <TextInput value={f.vendor} onChange={(e) => set({ vendor: e.target.value })} placeholder="Shop or person" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" htmlFor="ex-qty" error={errors.quantity}>
            <NumberInput whole value={f.quantity} onChange={(quantity) => set({ quantity })} />
          </Field>
          <Field label="Cost each" htmlFor="ex-cost" error={errors.unit_cost}>
            <NumberInput prefix="₹" value={f.unit_cost} onChange={(unit_cost) => set({ unit_cost })} />
          </Field>
        </div>
        <div className="flex items-baseline justify-between rounded-2xl bg-surface px-4 py-3">
          <span className="text-sm text-ink-2">Total (quantity × cost)</span>
          {total === null ? <span className="text-ink-2">—</span> : <Money value={total} className="text-lg font-bold text-ink" />}
        </div>
        <div>
          <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">Payment</p>
          <Chips label="Payment status" options={PAID_OPTIONS} value={f.payment_status} onChange={(payment_status) => set({ payment_status })} />
        </div>
        <Field label="Pay by" htmlFor="ex-due" optional error={errors.due_date} hint={f.due_date ? undefined : "For bills to be paid later"}>
          <DateField quick={false} value={f.due_date} onChange={(due_date) => set({ due_date })} />
        </Field>
        {f.due_date && <button type="button" onClick={() => set({ due_date: "" })} className="-mt-3 text-sm font-semibold text-brass">Clear pay-by date</button>}
        {isEdit && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete expense</Button>}
      </div>
      <StickyFooter>
        {save.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(save.error, "Couldn't save. Check your connection and try again.")}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={back}>Cancel</Button>
          <Button type="submit" block size="lg" loading={save.isPending}>{isEdit ? "Save changes" : "Save expense"}</Button>
        </div>
      </StickyFooter>
      <CategoryPicker open={picking} onClose={() => setPicking(false)} onPick={(c) => { set({ category_id: c.id, category_name: c.name }); setPicking(false); }} />
      <ConfirmDialog open={confirmDelete} title="Delete this expense?" message="It will be removed from your expenses and totals." confirmLabel="Delete expense" cancelLabel="Keep it"
        busy={remove.isPending} onConfirm={deleteExpense} onClose={() => setConfirmDelete(false)} />
    </form>
  );
}
```

- [ ] **Step 5: Routes, titles, knowledge**

In `frontend/src/app/routeMeta.test.js` add cases (before the `/nowhere` line):

```js
    ["/expenses", { title: "Expenses", back: null, hideNav: false }],
    ["/expenses/new", { title: "New expense", back: null, hideNav: true }],
    ["/expenses/edit/e1", { title: "Edit expense", back: null, hideNav: true }],
    ["/expense-categories", { title: "Expense categories", back: null, hideNav: false }],
```

Run: `cd frontend && npx vitest run src/app` → Expected: FAIL (old titles "New Expense"/"Edit Expense"/"Expense Categories"; new/edit not hideNav).

In `frontend/src/app/routeMeta.js` replace the four legacy expense entries (`/expense-categories`, `/expenses/new`, `/expenses/edit`, `/expenses`) with, placed above the `// Not redesigned yet` comment:

```js
  [/^\/expenses\/new$/, { title: "New expense", hideNav: true }],
  [/^\/expenses\/edit\/[^/]+$/, { title: "Edit expense", hideNav: true }],
  [/^\/expenses/, { title: "Expenses" }],
  [/^\/expense-categories/, { title: "Expense categories" }],
```

Run: `cd frontend && npx vitest run src/app` → Expected: PASS.

In `frontend/src/App.jsx`: replace the `Expenses`, `CreateExpense`, `EditExpense` lazy imports with
`const ExpensesPage = lazy(() => import("./features/expenses/ExpensesPage"));` and
`const ExpenseFormPage = lazy(() => import("./features/expenses/ExpenseFormPage"));`, and the expenses routes with:

```jsx
                        <Route path="expenses">
                          <Route index element={<ExpensesPage />} />
                          <Route path="new" element={<ExpenseFormPage />} />
                          <Route path="edit/:id" element={<ExpenseFormPage />} />
                        </Route>
```

Replace the whole of `backend/knowledge/expenses.md` with:

```md
# Expenses

What it is: money spent running the factory — each expense has a bill date, a
category, what it was for, who was paid, quantity × cost each (the total is
always quantity × cost), paid or unpaid, and an optional pay-by date.

## Seeing expenses
[Expenses](/expenses) lists expenses grouped by bill date, newest first. Chips:
**This month** (default) · **Last month** · **All** · **Unpaid**, plus one chip
per category; search matches the description or who was paid. The card at the
top shows the total for what is listed, how many, and how much is unpaid.
**⋯ → Download Excel of this list** exports exactly the listed expenses.

## Adding or editing an expense
1. Tap **New** (or tap an expense to edit it).
2. Fill **Bill date** (Today / Yesterday shortcuts), **Category** (search;
   **＋ New category** adds one on the spot), **What was it for**, **Paid to**,
   **Quantity** and **Cost each** — the total is worked out. Choose **Paid** or
   **Unpaid** and, optionally, a **Pay by** date.
3. Tap **Save expense**. On an existing expense, **Delete expense** asks first.

## Categories
**⋯ → Expense categories** (or [Expense categories](/expense-categories)):
add, rename or delete. A category still used by expenses can't be deleted —
the app says so.
```

Run: `cd frontend && npx eslint src/features/expenses src/app src/App.jsx && npx vitest run 2>&1 | grep -E "^ +Tests"` → Expected: clean; pass.

Visual check on the UX copy: `/expenses` defaults to This month with the total; switching chips and a category changes list and total together; Unpaid tag shows; an expense saves with the total = quantity × cost; delete asks first; "＋ New category" in the picker adds and selects.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/expenses frontend/src/App.jsx frontend/src/app/routeMeta.js frontend/src/app/routeMeta.test.js backend/knowledge/expenses.md
git commit -m "feat(expenses): expenses by day with period/category chips and totals; one-page expense form

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Expense categories page

**Files:**
- Create: `frontend/src/features/expenses/ExpenseCategoriesPage.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:** Consumes `useExpenseCategories`, `useCategoryMutations` (Task 2), `NameListEditor` (Task 1).

- [ ] **Step 1: Page**

`frontend/src/features/expenses/ExpenseCategoriesPage.jsx`:

```jsx
import { Link } from "react-router-dom";
import { useExpenseCategories, useCategoryMutations } from "./api";
import PageHeader from "../../ui/PageHeader";
import NameListEditor from "../../ui/NameListEditor";
import { ErrorState, ListSkeleton } from "../../ui/States";

export default function ExpenseCategoriesPage() {
  const categories = useExpenseCategories();
  const { add, rename, remove } = useCategoryMutations();
  return (
    <div className="mx-auto max-w-xl px-4 py-4 sm:px-6">
      <PageHeader title="Expense categories" subtitle={<Link to="/expenses" className="text-brass">← Expenses</Link>} />
      <div className="mt-4">
        {categories.isPending ? <ListSkeleton rows={4} /> : categories.isError ? <ErrorState title="Couldn't load categories." onRetry={() => categories.refetch()} /> : (
          <NameListEditor items={categories.data} onAdd={add} onRename={rename} onDelete={remove} noun="category"
            addPlaceholder="New category, e.g. Diesel" emptyText="No categories yet — add the kinds of spending you track." />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Routes**

In `frontend/src/App.jsx`: replace the `ExpenseCategories`, `CreateExpenseCategory`, `EditExpenseCategory` lazy imports with `const ExpenseCategoriesPage = lazy(() => import("./features/expenses/ExpenseCategoriesPage"));` and the expense-categories routes with:

```jsx
                        <Route path="expense-categories">
                          <Route index element={<ExpenseCategoriesPage />} />
                          <Route path="new" element={<Navigate to="/expense-categories" replace />} />
                          <Route path="edit/:id" element={<Navigate to="/expense-categories" replace />} />
                        </Route>
```

Run: `cd frontend && npx eslint src/features/expenses src/App.jsx && npx vitest run 2>&1 | grep -E "^ +Tests"` → Expected: clean; pass.

Visual check: add a category, rename it, delete it; deleting a category that has expenses shows "Cannot delete this category as it is being used by expenses" and it stays.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/expenses/ExpenseCategoriesPage.jsx frontend/src/App.jsx
git commit -m "feat(expenses): expense categories — add, rename, delete in place

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: History timeline (+ India-day date filter on the server)

The audit list's date filter today reads `from_date`/`to_date` as UTC days (the
server runs in UTC), so "this month" would miss or include events between
00:00 and 05:30 India time. That would show wrong history, so this task fixes
the filter on the server — a read-only query change, no data touched — and
lets `entity_type` take a comma list so the Stock chip is one paged stream.

**Files:**
- Create: `backend/src/services/auditFilters.js`, `backend/tests/auditFilters.test.js`
- Modify: `backend/src/controllers/auditLogController.js` (getAllAuditLogs builds `where` via `auditWhere`)
- Create: `frontend/src/features/history/describeAudit.js`, `describeAudit.test.js`, `HistoryPage.jsx`
- Modify: `frontend/src/App.jsx`, `frontend/src/app/routeMeta.js`, `backend/knowledge/history.md`

**Interfaces:**
- Produces (backend): `auditWhere(query) → where` (throws `AuditFilterError` with a message for a bad date)
- Produces (frontend): `describeAudit(row) → { kind: "payment"|"order"|"stock"|"other", title, detail, link|null, impact|null, tone }`, `impactText(impact) → string`, `HISTORY_TYPES`, `HISTORY_PERIODS`, `historyParams({type, period}, today)`, `dayOfIST(ts) → "YYYY-MM-DD"`, `timeIST(ts) → "3:05 pm"`

- [ ] **Step 1: Failing backend test**

`backend/tests/auditFilters.test.js`:

```js
"use strict";

const { Op } = require("sequelize");
const { auditWhere, AuditFilterError } = require("../src/services/auditFilters");

describe("auditWhere", () => {
  test("dates are India days: 00:00 IST to the next 00:00 IST", () => {
    const w = auditWhere({ from_date: "2026-09-01", to_date: "2026-09-30" });
    expect(w.created_at[Op.gte].toISOString()).toBe("2026-08-31T18:30:00.000Z");
    expect(w.created_at[Op.lt].toISOString()).toBe("2026-09-30T18:30:00.000Z");
  });
  test("one type or a comma list", () => {
    expect(auditWhere({ entity_type: "payment" })).toEqual({ entity_type: "PAYMENT" });
    expect(auditWhere({ entity_type: "PURCHASE_ORDER,GOODS_RECEIPT,STOCK_ISSUE" }).entity_type[Op.in]).toEqual(["PURCHASE_ORDER", "GOODS_RECEIPT", "STOCK_ISSUE"]);
  });
  test("action and entity id pass through; nothing given → no filter", () => {
    expect(auditWhere({ action: "update", entity_id: "x" })).toEqual({ action: "UPDATE", entity_id: "x" });
    expect(auditWhere({})).toEqual({});
  });
  test("a bad date is a clear 400, not a server error", () => {
    expect(() => auditWhere({ from_date: "2026-13-01" })).toThrow(AuditFilterError);
    expect(() => auditWhere({ to_date: "yesterday" })).toThrow("Dates must look like 2026-09-30");
  });
});
```

Run: `cd backend && npm test -- auditFilters` → Expected: FAIL (module missing).

- [ ] **Step 2: Implement and wire**

`backend/src/services/auditFilters.js`:

```js
"use strict";

const { Op } = require("sequelize");
const { addDays } = require("./dashboard/dateRanges");

class AuditFilterError extends Error {}

const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;

/** 00:00 India time on that day. The server runs in UTC, so this is spelled out. */
const istStart = (d) => new Date(`${d}T00:00:00+05:30`);

/** /audit-logs query → Sequelize where. Dates are whole India days. */
const auditWhere = ({ entity_type, action, from_date, to_date, entity_id } = {}) => {
  const where = {};
  if (entity_type) {
    const types = String(entity_type).toUpperCase().split(",").map((t) => t.trim()).filter(Boolean);
    where.entity_type = types.length === 1 ? types[0] : { [Op.in]: types };
  }
  if (action) where.action = String(action).toUpperCase();
  if (entity_id) where.entity_id = entity_id;
  if (from_date || to_date) {
    for (const d of [from_date, to_date]) if (d && !isDate(d)) throw new AuditFilterError("Dates must look like 2026-09-30");
    where.created_at = {};
    if (from_date) where.created_at[Op.gte] = istStart(from_date);
    if (to_date) where.created_at[Op.lt] = istStart(addDays(to_date, 1));
  }
  return where;
};

module.exports = { auditWhere, AuditFilterError };
```

In `backend/src/controllers/auditLogController.js` `getAllAuditLogs`: add `const { auditWhere, AuditFilterError } = require("../services/auditFilters");` at the top; replace everything from `const where = {};` through the closing brace of the `if (from_date || to_date) {…}` block with:

```js
    let where;
    try {
      where = auditWhere({ entity_type, action, from_date, to_date, entity_id });
    } catch (err) {
      if (err instanceof AuditFilterError) return error(res, 400, err.message);
      throw err;
    }
```

Run: `cd backend && npm test -- auditFilters && npm test 2>&1 | tail -5` → Expected: PASS; whole suite green.

- [ ] **Step 3: Failing frontend test**

`frontend/src/features/history/describeAudit.test.js`:

```js
import { describe, expect, test } from "vitest";
import { describeAudit, impactText, historyParams, dayOfIST, timeIST } from "./describeAudit";

const row = (o) => ({ id: "a1", entity_id: "e1", old_values: null, new_values: null, metadata: null, created_at: "2026-09-30T06:00:00.000Z", ...o });

describe("describeAudit — payments", () => {
  test("recorded, with the order figures before → after", () => {
    const d = describeAudit(row({ entity_type: "PAYMENT", action: "CREATE", metadata: {
      customer_name: "Bombay Saree Centre", order_id: "o1", amount: 5000, payment_type: "PARTIAL",
      before_metrics: { total_amount: 12000, total_received: 2000, outstanding: 10000 },
      after_metrics: { total_amount: 12000, total_received: 7000, outstanding: 5000 } } }));
    expect(d).toMatchObject({ kind: "payment", title: "Payment ₹5,000 recorded", detail: "Bombay Saree Centre", link: "/orders/o1", tone: "good" });
    expect(impactText(d.impact)).toBe("Received ₹2,000 → ₹7,000 · Due ₹10,000 → ₹5,000");
  });
  test("refund and advance say so", () => {
    expect(describeAudit(row({ entity_type: "PAYMENT", action: "CREATE", metadata: { amount: 300, payment_type: "REFUND", order_id: "o1" } })).title).toBe("Refund ₹300 recorded");
    expect(describeAudit(row({ entity_type: "PAYMENT", action: "CREATE", metadata: { amount: 300, payment_type: "ADVANCE", order_id: "o1" } })).title).toBe("Advance ₹300 recorded");
  });
  test("edited shows old → new amount from the saved values", () => {
    const d = describeAudit(row({ entity_type: "PAYMENT", action: "UPDATE", old_values: { amount: 400, payment_type: "PARTIAL", order_id: "o1" }, new_values: { amount: 500, payment_type: "PARTIAL", order_id: "o1" }, metadata: { customer_name: "A" } }));
    expect(d).toMatchObject({ title: "Payment edited ₹400 → ₹500", link: "/orders/o1", tone: "info" });
    expect(describeAudit(row({ entity_type: "PAYMENT", action: "UPDATE", old_values: { amount: 400 }, new_values: { amount: 400 } })).title).toBe("Payment edited");
  });
  test("deleted; an invoice-only payment links to the invoice", () => {
    const d = describeAudit(row({ entity_type: "PAYMENT", action: "DELETE", metadata: { amount: "250.50", invoice_id: "i1", order_id: null } }));
    expect(d).toMatchObject({ title: "Payment ₹250.50 deleted", link: "/invoices/i1", tone: "critical" });
  });
  test("a missing amount is left out, never ₹NaN", () => {
    expect(describeAudit(row({ entity_type: "PAYMENT", action: "CREATE", metadata: {} })).title).toBe("Payment recorded");
  });
  test("overpaid due reads as extra", () => {
    expect(impactText({ received: [100, 600], due: [0, -500] })).toBe("Received ₹100 → ₹600 · Due ₹0 → ₹500 extra");
    expect(impactText(null)).toBe("");
  });
});

describe("describeAudit — orders", () => {
  test("created / status change / edited / deleted", () => {
    expect(describeAudit(row({ entity_type: "ORDER", action: "CREATE", metadata: { customer_name: "B", status: "PENDING" } })))
      .toMatchObject({ kind: "order", title: "Order created", detail: "B", link: "/orders/e1" });
    expect(describeAudit(row({ entity_type: "ORDER", action: "UPDATE", metadata: { previous_status: "PENDING", new_status: "DELIVERED", is_soft_delete: false } })).title)
      .toBe("Order status Pending → Delivered");
    expect(describeAudit(row({ entity_type: "ORDER", action: "UPDATE", metadata: { previous_status: "PENDING", new_status: "PENDING" } })).title).toBe("Order edited");
    expect(describeAudit(row({ entity_type: "ORDER", action: "DELETE", metadata: { is_soft_delete: true, customer_name: "B" } })))
      .toMatchObject({ title: "Order deleted", link: null, tone: "critical" });
  });
});

describe("describeAudit — stock", () => {
  test("purchase order, receipt, issues", () => {
    expect(describeAudit(row({ entity_type: "PURCHASE_ORDER", action: "CREATE", new_values: { po_number: "PO-0001" }, metadata: { supplier_name: "Raj Traders", item_count: 3, total_value: 15000 } })))
      .toMatchObject({ kind: "stock", title: "Purchase order PO-0001 created", detail: "Raj Traders · 3 items · ₹15,000", link: "/purchase-orders/e1" });
    expect(describeAudit(row({ entity_type: "GOODS_RECEIPT", action: "CREATE", new_values: { receipt_number: "GR-0002", purchase_order_id: "p9" }, metadata: { item_count: 1, total_value: 800 } })))
      .toMatchObject({ title: "Material received · GR-0002", detail: "1 item · ₹800", link: "/purchase-orders/p9" });
    expect(describeAudit(row({ entity_type: "STOCK_ISSUE", action: "CREATE", new_values: { issue_number: "SI-0003", issue_type: "WASTAGE", order_id: null }, metadata: { issue_type: "WASTAGE", item_count: 2 } })))
      .toMatchObject({ title: "Wastage recorded · SI-0003", detail: "2 items", link: null });
    expect(describeAudit(row({ entity_type: "STOCK_ISSUE", action: "CREATE", new_values: { issue_number: "SI-0004", issue_type: "ADJUSTMENT_OUT", order_id: "o5" }, metadata: { issue_type: "ADJUSTMENT_OUT", item_count: 1, reason: "Count correction" } })))
      .toMatchObject({ title: "Stock removed (adjustment) · SI-0004", detail: "1 item · Count correction", link: "/orders/o5" });
  });
  test("anything unknown still shows", () => {
    expect(describeAudit(row({ entity_type: "SUPPLIER", action: "ARCHIVE" }))).toMatchObject({ kind: "other", title: "Supplier archive", link: null });
  });
});

describe("filters and times", () => {
  test("type and period → query", () => {
    expect(historyParams({ type: "all", period: "all" }, "2026-09-30")).toEqual({});
    expect(historyParams({ type: "stock", period: "this_month" }, "2026-09-30"))
      .toEqual({ entity_type: "PURCHASE_ORDER,GOODS_RECEIPT,STOCK_ISSUE", from_date: "2026-09-01", to_date: "2026-09-30" });
    expect(historyParams({ type: "payments", period: "last_month" }, "2026-03-10")).toEqual({ entity_type: "PAYMENT", from_date: "2026-02-01", to_date: "2026-02-28" });
  });
  test("India day and time", () => {
    expect(dayOfIST("2026-09-30T19:00:00.000Z")).toBe("2026-10-01");
    expect(timeIST("2026-09-30T09:35:00.000Z")).toBe("3:05 pm");
  });
});
```

Run: `cd frontend && npx vitest run src/features/history` → Expected: FAIL (module missing).

- [ ] **Step 4: Implement**

`frontend/src/features/history/describeAudit.js`:

```js
import { inr } from "../../utils/dashboardFormat";
import { addDays, todayIST } from "../../utils/istDate";
import { ORDER_STATUS } from "../../utils/statusMeta";

export const HISTORY_TYPES = [
  { value: "all", label: "All" },
  { value: "payments", label: "Payments" },
  { value: "orders", label: "Orders" },
  { value: "stock", label: "Stock" },
];
export const HISTORY_PERIODS = [
  { value: "all", label: "Any time" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
];
const TYPE_PARAM = { payments: "PAYMENT", orders: "ORDER", stock: "PURCHASE_ORDER,GOODS_RECEIPT,STOCK_ISSUE" };

const monthStart = (d) => `${d.slice(0, 7)}-01`;

export const historyParams = ({ type = "all", period = "all" }, today) => {
  const p = {};
  if (TYPE_PARAM[type]) p.entity_type = TYPE_PARAM[type];
  if (period === "this_month") Object.assign(p, { from_date: monthStart(today), to_date: today });
  if (period === "last_month") {
    const last = addDays(monthStart(today), -1);
    Object.assign(p, { from_date: monthStart(last), to_date: last });
  }
  return p;
};

export const dayOfIST = (ts) => todayIST(new Date(ts));
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
export const timeIST = (ts) => timeFmt.format(new Date(ts)).toLowerCase().replace(/\s+/g, " ");

const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const money = (v) => (num(v) === null ? null : inr(num(v)));
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const join = (...parts) => parts.filter(Boolean).join(" · ");
const statusLabel = (s) => ORDER_STATUS[s]?.label || s;
const PAYMENT_WORD = { REFUND: "Refund", ADVANCE: "Advance" };
const ISSUE_TITLE = { ISSUE: "Stock issued", WASTAGE: "Wastage recorded", ADJUSTMENT_IN: "Stock added (adjustment)", ADJUSTMENT_OUT: "Stock removed (adjustment)" };
const ENTITY_WORD = { PAYMENT: "Payment", ORDER: "Order", PURCHASE_ORDER: "Purchase order", GOODS_RECEIPT: "Goods receipt", STOCK_ISSUE: "Stock issue" };
const titleCase = (s) => String(s || "").toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const impactOf = (m) => {
  const b = m?.before_metrics;
  const a = m?.after_metrics;
  if (!b || !a) return null;
  const vals = [b.total_received, a.total_received, b.outstanding, a.outstanding].map(num);
  if (vals.some((v) => v === null)) return null;
  return { received: [vals[0], vals[1]], due: [vals[2], vals[3]] };
};

const dueWord = (v) => (v < 0 ? `${inr(-v)} extra` : inr(v));

/** The order's figures as they were when it happened: "Received ₹a → ₹b · Due ₹c → ₹d". */
export const impactText = (impact) =>
  impact ? `Received ${inr(impact.received[0])} → ${inr(impact.received[1])} · Due ${dueWord(impact.due[0])} → ${dueWord(impact.due[1])}` : "";

const describePayment = (r) => {
  const m = r.metadata || {};
  const v = r.new_values || r.old_values || {};
  const word = PAYMENT_WORD[m.payment_type || v.payment_type] || "Payment";
  const orderId = m.order_id ?? v.order_id;
  const invoiceId = m.invoice_id ?? v.invoice_id;
  const link = orderId ? `/orders/${orderId}` : invoiceId ? `/invoices/${invoiceId}` : null;
  const base = { kind: "payment", detail: m.customer_name || "", link, impact: impactOf(m) };
  if (r.action === "UPDATE") {
    const before = money(r.old_values?.amount);
    const after = money(r.new_values?.amount);
    return { ...base, tone: "info", title: before && after && before !== after ? `${word} edited ${before} → ${after}` : `${word} edited` };
  }
  const amount = money(m.amount ?? v.amount);
  const verb = r.action === "DELETE" ? "deleted" : "recorded";
  return { ...base, tone: r.action === "DELETE" ? "critical" : "good", title: amount ? `${word} ${amount} ${verb}` : `${word} ${verb}` };
};

const describeOrder = (r) => {
  const m = r.metadata || {};
  const base = { kind: "order", detail: m.customer_name || "", link: `/orders/${r.entity_id}`, impact: null, tone: "info" };
  if (r.action === "DELETE" || m.is_soft_delete) return { ...base, title: "Order deleted", link: null, tone: "critical" };
  if (r.action === "CREATE") return { ...base, title: "Order created", tone: "good" };
  if (m.previous_status && m.new_status && m.previous_status !== m.new_status)
    return { ...base, title: `Order status ${statusLabel(m.previous_status)} → ${statusLabel(m.new_status)}` };
  return { ...base, title: "Order edited" };
};

const counts = (m) => join(num(m.item_count) !== null ? plural(num(m.item_count), "item") : "", money(m.total_value));

const describeStock = (r) => {
  const m = r.metadata || {};
  const v = r.new_values || {};
  const base = { kind: "stock", impact: null, tone: "info" };
  if (r.entity_type === "PURCHASE_ORDER")
    return { ...base, title: `Purchase order ${v.po_number ? `${v.po_number} ` : ""}${r.action === "CREATE" ? "created" : String(r.action || "").toLowerCase()}`, detail: join(m.supplier_name, counts(m)), link: `/purchase-orders/${r.entity_id}` };
  if (r.entity_type === "GOODS_RECEIPT")
    return { ...base, tone: "good", title: join("Material received", v.receipt_number), detail: counts(m), link: v.purchase_order_id ? `/purchase-orders/${v.purchase_order_id}` : null };
  const type = m.issue_type || v.issue_type;
  return { ...base, title: join(ISSUE_TITLE[type] || "Stock issue", v.issue_number), detail: join(counts(m), m.reason), link: v.order_id ? `/orders/${v.order_id}` : null };
};

/** One audit row → one plain sentence. Unknown shapes still show ("<Entity> <action>"). */
export const describeAudit = (r) => {
  if (r.entity_type === "PAYMENT") return describePayment(r);
  if (r.entity_type === "ORDER") return describeOrder(r);
  if (["PURCHASE_ORDER", "GOODS_RECEIPT", "STOCK_ISSUE"].includes(r.entity_type)) return describeStock(r);
  return { kind: "other", title: `${ENTITY_WORD[r.entity_type] || titleCase(r.entity_type)} ${String(r.action || "").toLowerCase()}`.trim(), detail: "", link: null, impact: null, tone: "muted" };
};
```

Run: `cd frontend && npx vitest run src/features/history` → Expected: PASS.

- [ ] **Step 5: Page**

`frontend/src/features/history/HistoryPage.jsx`:

```jsx
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronRight, IndianRupee, ClipboardList, Package, Circle } from "lucide-react";
import { auditLogAPI } from "../../services/api";
import { keys } from "../../lib/queryKeys";
import { describeAudit, impactText, HISTORY_TYPES, HISTORY_PERIODS, historyParams, dayOfIST, timeIST } from "./describeAudit";
import PageHeader from "../../ui/PageHeader";
import Chips from "../../ui/Chips";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { groupByDay } from "../../utils/dayGroups";
import { todayIST } from "../../utils/istDate";

const ICON = { payment: IndianRupee, order: ClipboardList, stock: Package, other: Circle };
const TONE_DOT = { good: "bg-status-good/15 text-status-good", critical: "bg-status-critical/15 text-status-critical", info: "bg-brass/15 text-brass", muted: "bg-raised text-ink-2" };

function Entry({ row }) {
  const d = describeAudit(row);
  const Icon = ICON[d.kind];
  const impact = impactText(d.impact);
  const inner = (
    <>
      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${TONE_DOT[d.tone]}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{d.title}</span>
        {d.detail && <span className="block truncate text-xs text-ink-2">{d.detail}</span>}
        {impact && <span className="mt-1 block font-num text-xs tabular-nums text-ink-2">{impact} <span className="opacity-70">(at that time)</span></span>}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-xs text-ink-2">{timeIST(row.created_at)}{d.link && <ChevronRight className="h-4 w-4" aria-hidden="true" />}</span>
    </>
  );
  const cls = "flex items-start gap-3 px-4 py-3";
  return d.link
    ? <Link to={d.link} className={`${cls} hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass`}>{inner}</Link>
    : <div className={cls}>{inner}</div>;
}

export default function HistoryPage() {
  const [params, setParams] = useSearchParams();
  const type = params.get("type") || "all";
  const period = params.get("period") || "all";
  const today = todayIST();
  const query = useMemo(() => historyParams({ type, period }, today), [type, period, today]);
  const list = useInfiniteQuery({
    queryKey: keys.history.list(query),
    queryFn: ({ pageParam }) => auditLogAPI.getAll({ ...query, page: pageParam, limit: 30 }).then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    placeholderData: (previous) => previous,
  });
  const sentinel = useInfiniteSentinel(list);
  const rows = useMemo(() => (list.data?.pages || []).flatMap((p) => p.logs), [list.data]);
  const groups = useMemo(() => groupByDay(rows, today, (r) => dayOfIST(r.created_at)), [rows, today]);
  const set = (key, value) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (value === "all") next.delete(key); else next.set(key, value);
    return next;
  }, { replace: true });

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="History" subtitle="Every payment, order and stock change, newest first" />
      <div className="mt-3 space-y-2">
        <Chips label="What" options={HISTORY_TYPES} value={type} onChange={(v) => set("type", v)} />
        <Chips label="When" options={HISTORY_PERIODS} value={period} onChange={(v) => set("period", v)} />
      </div>
      <div className={`mt-4 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? <ListSkeleton /> : list.isError && rows.length === 0 ? (
          <ErrorState title="Couldn't load history." onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing here yet" body="Try another type or time." />
        ) : (
          <>
            {groups.map((g) => (
              <section key={g.date} aria-labelledby={`h-day-${g.date}`} className="mb-3">
                <h2 id={`h-day-${g.date}`} className="sticky top-0 z-[1] bg-canvas/95 px-1 py-2 text-xs font-semibold text-ink-2 backdrop-blur">{g.label}</h2>
                <ul className="overflow-hidden rounded-2xl bg-surface">
                  {g.rows.map((r) => <li key={r.id} className="border-b border-line/60 last:border-0"><Entry row={r} /></li>)}
                </ul>
              </section>
            ))}
            <div ref={sentinel} className="py-4 text-center text-xs text-ink-2">
              {list.isFetchingNextPage ? "Loading more…" : list.hasNextPage ? "" : `That's everything · ${list.data.pages[0].pagination.total} entries`}
              {list.isError && rows.length > 0 && <button type="button" onClick={() => list.fetchNextPage()} className="ml-2 font-semibold text-brass">Couldn't load more — retry</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Route, title, knowledge**

`frontend/src/App.jsx`: replace `const History = lazy(() => import("./pages/History"));` with `const HistoryPage = lazy(() => import("./features/history/HistoryPage"));` and `<Route path="history" element={old(<History />)} />` with `<Route path="history" element={<HistoryPage />} />`. (`routeMeta` already titles `/history` "History"; move that line above the `// Not redesigned yet` comment.)

Replace `backend/knowledge/history.md` with:

```md
# History

What it is: a timeline of everything that changed money or stock — payments
recorded, edited or deleted; orders created, edited, moved to a new status or
deleted; purchase orders, material received, stock issued, wastage and
adjustments.

## Using it
[History](/history) shows entries grouped by India date, newest first, each as
one sentence ("Payment ₹5,000 recorded", "Order status Pending → Delivered").
Chips: **All · Payments · Orders · Stock** and **Any time · This month · Last
month**. Scroll down to load older entries.

A payment entry also shows the order's Received and Due as they were just
before and just after it — "(at that time)"; today's figures are on the order.
Tap an entry to open its order, invoice or purchase order.
```

Run: `cd frontend && npx eslint src/features/history src/App.jsx src/app && npx vitest run 2>&1 | grep -E "^ +Tests"` → Expected: clean; pass.

Visual check: `/history` lists 728 entries in day groups; Payments chip shows only payments; This month starts at 1 Sep IST; tapping a payment opens its order.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/auditFilters.js backend/tests/auditFilters.test.js backend/src/controllers/auditLogController.js backend/knowledge/history.md frontend/src/features/history frontend/src/App.jsx frontend/src/app/routeMeta.js
git commit -m "feat(history): one-sentence timeline by India day; audit date filter uses India days

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Stock — labels, inventory hooks, Stock and Item stock pages

**Files:**
- Create: `frontend/src/features/inventory/labels.js`, `labels.test.js`, `api.js`, `StockPage.jsx`, `StockItemPage.jsx`
- Modify: `frontend/src/App.jsx`, `frontend/src/app/routeMeta.js`, `frontend/src/app/routeMeta.test.js`

**Interfaces (Produces, used by Tasks 6–9):**
- `UNITS` (options), `UNIT_LABEL`, `qtyText(n)`, `qty(n, unit)`, `attributesText(item)`, `PO_STATUS`, `ISSUE_TYPES`, `ISSUE_TYPE_OPTIONS`, `MOVEMENT`, `poActions(po) → {canReceive, canCancel, canDelete}`, `QTY_DP = 3`
- Hooks: `usePaged(key, fetchPage, params, limit)` (infinite; `fetchPage(params)` → `{rows, pagination}`), `useStockList(params)`, `useStockSummary()`, `useItemStock(id)`, `useMovements(id, params)`, `useItemsPicker()`, `useItem(id)`, `useItemList(params)`, `useInvCategories()`, `useAttributes()`, `useSupplierList(params)`, `useSuppliersPicker()`, `useSupplier(id)`, `usePoList(params)`, `usePo(id)`, `useIssueList(params)`, `refreshStock(qc)` (invalidates stock, items, purchase orders, stock issues, suppliers)

- [ ] **Step 1: Failing test**

`frontend/src/features/inventory/labels.test.js`:

```js
import { describe, expect, test } from "vitest";
import { qty, qtyText, attributesText, poActions, PO_STATUS, ISSUE_TYPES } from "./labels";

describe("inventory labels", () => {
  test("quantities keep up to 3 decimals with Indian grouping", () => {
    expect(qtyText("1250.500")).toBe("1,250.5");
    expect(qtyText(0)).toBe("0");
    expect(qty("12.345", "KG")).toBe("12.345 kg");
    expect(qty(3, "ROLL")).toBe("3 rolls");
    expect(qty(1, "ROLL")).toBe("1 roll");
    expect(qty(2, "BOX")).toBe("2 box");
  });
  test("attributes read as one line", () => {
    expect(attributesText({ attributes: [{ attribute_name: "GSM", value: "70" }, { attribute_name: "Colour", value: "Red" }] })).toBe("GSM 70 · Colour Red");
    expect(attributesText({})).toBe("");
  });
  test("what a purchase order allows — cancel and delete only before anything is received", () => {
    const po = (status, received) => ({ status, items: [{ quantity_received: received }] });
    expect(poActions(po("PENDING", "0.000"))).toEqual({ canReceive: true, canCancel: true, canDelete: true });
    expect(poActions(po("PARTIALLY_RECEIVED", "5.000"))).toEqual({ canReceive: true, canCancel: false, canDelete: false });
    expect(poActions(po("RECEIVED", "10.000"))).toEqual({ canReceive: false, canCancel: false, canDelete: false });
    expect(poActions(po("CANCELLED", "0"))).toEqual({ canReceive: false, canCancel: false, canDelete: true });
  });
  test("every status and type has a label", () => {
    expect(Object.keys(PO_STATUS)).toEqual(["PENDING", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"]);
    expect(Object.keys(ISSUE_TYPES)).toEqual(["ISSUE", "WASTAGE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"]);
  });
});
```

Run: `cd frontend && npx vitest run src/features/inventory` → Expected: FAIL.

- [ ] **Step 2: Implement labels and hooks**

`frontend/src/features/inventory/labels.js`:

```js
export const QTY_DP = 3; // quantities are DECIMAL(12,3)

export const UNITS = [
  { value: "KG", label: "Kg" },
  { value: "PCS", label: "Pcs" },
  { value: "METRE", label: "Metre" },
  { value: "ROLL", label: "Roll" },
  { value: "LITRE", label: "Litre" },
];
export const UNIT_LABEL = { KG: ["kg", "kg"], PCS: ["pc", "pcs"], METRE: ["m", "m"], ROLL: ["roll", "rolls"], LITRE: ["L", "L"] };

const qfmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: QTY_DP });
export const qtyText = (n) => qfmt.format(Number(n) || 0);
export const qty = (n, unit) => {
  const words = UNIT_LABEL[unit];
  const v = Number(n) || 0;
  return `${qtyText(v)} ${words ? words[v === 1 ? 0 : 1] : String(unit || "").toLowerCase()}`.trim();
};

export const attributesText = (item) => (item?.attributes || []).map((a) => `${a.attribute_name} ${a.value}`).join(" · ");

export const PO_STATUS = {
  PENDING: { label: "Ordered", tone: "info" },
  PARTIALLY_RECEIVED: { label: "Part received", tone: "warn" },
  RECEIVED: { label: "Received", tone: "good" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
};

export const ISSUE_TYPES = {
  ISSUE: { label: "Issue", tone: "info", hint: "Material used for production" },
  WASTAGE: { label: "Wastage", tone: "critical", hint: "Material spoiled or thrown away" },
  ADJUSTMENT_IN: { label: "Add stock", tone: "good", hint: "Stock count found more than the app shows" },
  ADJUSTMENT_OUT: { label: "Remove stock", tone: "warn", hint: "Stock count found less than the app shows" },
};
export const ISSUE_TYPE_OPTIONS = Object.entries(ISSUE_TYPES).map(([value, t]) => ({ value, label: t.label }));

export const MOVEMENT = {
  RECEIPT: { label: "Received", sign: "+" },
  ISSUE: { label: "Issued", sign: "−" },
  WASTAGE: { label: "Wastage", sign: "−" },
  ADJUSTMENT_IN: { label: "Added (count)", sign: "+" },
  ADJUSTMENT_OUT: { label: "Removed (count)", sign: "−" },
};

/** The server allows cancel/delete only while nothing has been received, and receiving only on open orders. */
export const poActions = (po) => {
  const received = (po.items || []).some((l) => Number(l.quantity_received) > 0);
  const open = po.status === "PENDING" || po.status === "PARTIALLY_RECEIVED";
  return { canReceive: open, canCancel: po.status !== "CANCELLED" && !received, canDelete: !received };
};
```

`frontend/src/features/inventory/api.js`:

```js
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { stockAPI, inventoryItemAPI, inventoryCategoryAPI, itemAttributesAPI, supplierAPI, purchaseOrderAPI, stockIssueAPI } from "../../services/inventoryAPI";
import { keys } from "../../lib/queryKeys";

const notFound = (err) => err?.response?.status === 404;
const retry = (n, err) => !notFound(err) && n < 1;

/** A paged list (the server pages at most 100). New filters keep the old list dimmed until they load. */
export const usePaged = (key, fetchPage, params, limit = 50) =>
  useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchPage({ ...params, page: pageParam, limit }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    placeholderData: (previous) => previous,
  });

export const rowsOf = (q) => (q.data?.pages || []).flatMap((p) => p.rows);

export const useStockList = (params) => usePaged(keys.stock.list(params), stockAPI.getStock, params);
export const useStockSummary = () => useQuery({ queryKey: keys.stock.summary, queryFn: stockAPI.getSummary });
export const useItemStock = (id) => useQuery({ queryKey: keys.stock.item(id), queryFn: () => stockAPI.getItemStock(id), enabled: Boolean(id), retry });
export const useMovements = (id, params) => usePaged(keys.stock.movements(id, params), (p) => stockAPI.getItemMovements(id, p), params, 30);

export const useItemsPicker = () => useQuery({ queryKey: keys.items.picker, queryFn: inventoryItemAPI.getAllForPicker });
export const useItemList = (params) => usePaged(keys.items.list(params), inventoryItemAPI.getAll, params);
export const useItem = (id) => useQuery({ queryKey: keys.items.detail(id), queryFn: () => inventoryItemAPI.getById(id), enabled: Boolean(id), retry });
export const useInvCategories = () => useQuery({ queryKey: keys.inventory.categories, queryFn: () => inventoryCategoryAPI.getAll() });
export const useAttributes = () => useQuery({ queryKey: keys.inventory.attributes, queryFn: itemAttributesAPI.getAll });

export const useSupplierList = (params) => usePaged(keys.suppliers.list(params), supplierAPI.getAll, params);
export const useSuppliersPicker = () => useQuery({ queryKey: keys.suppliers.picker, queryFn: supplierAPI.getAllForPicker });
export const useSupplier = (id) => useQuery({ queryKey: keys.suppliers.detail(id), queryFn: () => supplierAPI.getById(id), enabled: Boolean(id), retry });

export const usePoList = (params) => usePaged(keys.purchaseOrders.list(params), purchaseOrderAPI.getAll, params, 30);
export const usePo = (id) => useQuery({ queryKey: keys.purchaseOrders.detail(id), queryFn: () => purchaseOrderAPI.getById(id), enabled: Boolean(id), retry });
export const useIssueList = (params) => usePaged(keys.stockIssues.list(params), stockIssueAPI.getAll, params, 30);

/** After anything that moves stock or changes a master list: refresh every inventory screen. */
export const refreshStock = (qc) =>
  Promise.all([keys.stock.all, keys.items.all, keys.purchaseOrders.all, keys.stockIssues.all, keys.suppliers.all, keys.inventory.categories, keys.inventory.attributes]
    .map((queryKey) => qc.invalidateQueries({ queryKey })));
```

Run: `cd frontend && npx vitest run src/features/inventory` → Expected: PASS.

- [ ] **Step 3: Stock page**

`frontend/src/features/inventory/StockPage.jsx`:

```jsx
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Ellipsis, ChevronRight } from "lucide-react";
import { useStockList, useStockSummary, rowsOf } from "./api";
import { qty, attributesText } from "./labels";
import PageHeader from "../../ui/PageHeader";
import TextInput from "../../ui/TextInput";
import Chips from "../../ui/Chips";
import IconButton from "../../ui/IconButton";
import ActionSheet from "../../ui/ActionSheet";
import Tag from "../../ui/Tag";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { inventoryExportAPI } from "../../services/inventoryAPI";
import { useToast } from "../../context/ToastContext";

const CHIPS = [{ value: "all", label: "All" }, { value: "low", label: "Low stock" }];

function Summary() {
  const s = useStockSummary();
  if (s.isPending) return <div className="h-28 animate-pulse rounded-3xl bg-surface" />;
  if (s.isError) return <ErrorState title="Couldn't load the stock summary." onRetry={() => s.refetch()} />;
  const d = s.data;
  return (
    <section aria-label="Stock summary" className="rounded-3xl bg-gradient-to-b from-raised to-surface p-4 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
      <p className="text-sm text-ink-2">Stock value</p>
      <Money value={Number(d.total_stock_value)} className="block text-3xl font-bold text-ink" />
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div><dt className="text-ink-2">Low stock</dt><dd className={`font-num text-base font-bold tabular-nums ${d.low_stock_count > 0 ? "text-status-warn" : "text-ink"}`}>{d.low_stock_count} of {d.item_count}</dd></div>
        <div><dt className="text-ink-2">Received this month</dt><dd><Money value={Number(d.received_value_this_month)} className="text-base font-bold text-ink" /></dd></div>
        <div><dt className="text-ink-2">Used this month</dt><dd><Money value={Number(d.consumed_value_this_month)} className="text-base font-bold text-ink" /></dd></div>
      </dl>
    </section>
  );
}

export default function StockPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const chip = params.get("chip") || "all";
  const search = params.get("q") || "";
  const term = useDebounced(search.trim());
  const query = useMemo(() => ({ ...(term ? { search: term } : {}), ...(chip === "low" ? { low_stock_only: "true" } : {}) }), [term, chip]);
  const list = useStockList(query);
  const sentinel = useInfiniteSentinel(list);
  const rows = rowsOf(list);
  const setParam = (key, value, fallback = "") => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (value && value !== fallback) next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });

  const exportExcel = async () => {
    try {
      const res = await inventoryExportAPI.download();
      const url = URL.createObjectURL(res.data);
      const a = Object.assign(document.createElement("a"), { href: url, download: "inventory.xlsx" });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't download the Excel file. Try again.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Stock" actions={<>
        <IconButton label="More stock actions" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>
        <Link to="/stock-issues/new" className={buttonClass({ size: "sm" })}>Issue stock</Link>
      </>} />
      <div className="mt-3"><Summary /></div>
      <div className="mt-4 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setParam("q", e.target.value)} placeholder="Search item name or code" aria-label="Search stock" enterKeyHint="search" />
        <Chips label="Show" options={CHIPS} value={chip} onChange={(v) => setParam("chip", v, "all")} />
      </div>
      <div className={`mt-4 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? <ListSkeleton /> : list.isError && rows.length === 0 ? <ErrorState title="Couldn't load stock." onRetry={() => list.refetch()} /> : rows.length === 0 ? (
          <EmptyState title={chip === "low" ? "Nothing is low" : "No items here"} body={chip === "low" ? "Every item is above its reorder level." : "Add items, then receive material against a purchase order."}
            action={<Link to="/inventory-items/new" className={buttonClass({ variant: "secondary" })}>Add an item</Link>} />
        ) : (
          <>
            <ul className="overflow-hidden rounded-2xl bg-surface">
              {rows.map((r) => (
                <li key={r.id} className="border-b border-line/60 last:border-0">
                  <Link to={`/stock/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-ink">{r.name}</span>{r.is_low_stock && <Tag label="Low" tone="warn" />}</span>
                      <span className="block truncate text-xs text-ink-2">{[r.category?.name, attributesText(r)].filter(Boolean).join(" · ") || "—"}</span>
                      {Number(r.on_order) > 0 && <span className="block text-xs text-ink-2">On order {qty(r.on_order, r.unit)}</span>}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-num text-sm font-bold tabular-nums text-ink">{qty(r.in_stock, r.unit)}</span>
                      <Money value={Number(r.stock_value)} className="text-xs text-ink-2" />
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <div ref={sentinel} className="py-3 text-center text-xs text-ink-2">{list.isFetchingNextPage ? "Loading more…" : ""}</div>
          </>
        )}
      </div>
      <ActionSheet open={menuOpen} title="Stock" onClose={() => setMenuOpen(false)} actions={[
        { label: "Download Excel of all stock", onSelect: exportExcel },
        { label: "Purchase orders", onSelect: () => navigate("/purchase-orders") },
        { label: "Stock issues", onSelect: () => navigate("/stock-issues") },
        { label: "Items", onSelect: () => navigate("/inventory-items") },
        { label: "Suppliers", onSelect: () => navigate("/suppliers") },
      ]} />
    </div>
  );
}
```

- [ ] **Step 4: Item stock page**

`frontend/src/features/inventory/StockItemPage.jsx`:

```jsx
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useItemStock, useMovements, rowsOf } from "./api";
import { qty, qtyText, attributesText, MOVEMENT, UNIT_LABEL } from "./labels";
import Tabs, { TabPanel } from "../../ui/Tabs";
import Tag from "../../ui/Tag";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { shortDate } from "../../utils/dashboardFormat";

const TABS = [{ value: "batches", label: "Batches" }, { value: "moves", label: "Movements" }, { value: "details", label: "Details" }];

function Movements({ itemId, unit }) {
  const list = useMovements(itemId, {});
  const sentinel = useInfiniteSentinel(list);
  const rows = rowsOf(list);
  if (list.isPending) return <ListSkeleton rows={4} />;
  if (list.isError && rows.length === 0) return <ErrorState title="Couldn't load movements." onRetry={() => list.refetch()} />;
  if (rows.length === 0) return <EmptyState title="No movements yet" />;
  return (
    <>
      <ul className="overflow-hidden rounded-2xl bg-surface">
        {rows.map((m, i) => {
          const meta = MOVEMENT[m.movement_type] || { label: m.movement_type, sign: "" };
          const n = Math.abs(Number(m.quantity));
          return (
            <li key={m.id || i} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{meta.label}</span>
                <span className="block truncate text-xs text-ink-2">{shortDate(String(m.movement_date).slice(0, 10))}{m.notes ? ` · ${m.notes}` : ""}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className={`block font-num text-sm font-bold tabular-nums ${meta.sign === "+" ? "text-status-good" : "text-ink"}`}>{meta.sign}{qty(n, unit)}</span>
                {m.total_cost !== null && m.total_cost !== undefined && <Money value={Math.abs(Number(m.total_cost))} className="text-xs text-ink-2" />}
              </span>
            </li>
          );
        })}
      </ul>
      <div ref={sentinel} className="py-3 text-center text-xs text-ink-2">{list.isFetchingNextPage ? "Loading more…" : ""}</div>
    </>
  );
}

export default function StockItemPage() {
  const { itemId } = useParams();
  const [tab, setTab] = useState("batches");
  const q = useItemStock(itemId);
  if (q.isPending) return <PageSkeleton />;
  if (q.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {q.error?.response?.status === 404
          ? <EmptyState title="This item doesn't exist" body="It may have been deleted." action={<Link to="/stock" className={buttonClass({ variant: "secondary" })}>All stock</Link>} />
          : <ErrorState title="Couldn't load this item." onRetry={() => q.refetch()} />}
      </div>
    );
  }
  const { item, in_stock, stock_value, batches } = q.data;
  const low = Number(in_stock) <= Number(item.reorder_level) && Number(item.reorder_level) > 0;
  const unit = UNIT_LABEL[item.unit]?.[1] || item.unit;
  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <section className="rounded-3xl bg-gradient-to-b from-raised to-surface p-4 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-ink">{item.name}</h1>
            <p className="truncate text-sm text-ink-2">{[item.category?.name, attributesText(item)].filter(Boolean).join(" · ")}</p>
          </div>
          {low && <Tag label="Low stock" tone="warn" />}
        </div>
        <p className="mt-3 font-num text-3xl font-bold tabular-nums text-ink">{qty(in_stock, item.unit)}</p>
        <p className="text-sm text-ink-2">Worth <Money value={Number(stock_value)} className="font-semibold text-ink" /> · Reorder at {qtyText(item.reorder_level)} {unit}</p>
        <div className="mt-3 flex gap-2">
          <Link to={`/stock-issues/new?item=${item.id}`} className={buttonClass({ size: "sm" })}>Issue stock</Link>
          <Link to={`/purchase-orders/new?item=${item.id}`} className={buttonClass({ size: "sm", variant: "secondary" })}>Order more</Link>
        </div>
      </section>
      <div className="mt-4"><Tabs label="Item stock" tabs={TABS} value={tab} onChange={setTab} /></div>
      <TabPanel value={tab}>
        {tab === "batches" && (batches.length === 0 ? <EmptyState title="No stock on hand" body="Receive material against a purchase order to add stock." /> : (
          <>
            <p className="mb-2 px-1 text-xs text-ink-2">Used oldest first. Each batch keeps the rate it was bought at.</p>
            <ul className="overflow-hidden rounded-2xl bg-surface">
              {batches.map((b) => (
                <li key={b.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{shortDate(b.received_date)}{b.receipt_number ? ` · ${b.receipt_number}` : ""}</span>
                    <span className="block truncate text-xs text-ink-2">{b.supplier?.name || "Stock count"} · <Money value={Number(b.rate)} /> per {UNIT_LABEL[item.unit]?.[0] || item.unit}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-num text-sm font-bold tabular-nums text-ink">{qtyText(b.quantity_remaining)} of {qty(b.quantity_received, item.unit)}</span>
                    <Money value={Number(b.value)} className="text-xs text-ink-2" />
                  </span>
                </li>
              ))}
            </ul>
          </>
        ))}
        {tab === "moves" && <Movements itemId={item.id} unit={item.unit} />}
        {tab === "details" && (
          <dl className="divide-y divide-line/60 overflow-hidden rounded-2xl bg-surface text-sm">
            {[["Code", item.item_code || "—"], ["Category", item.category?.name || "—"], ["Unit", unit], ["Reorder level", `${qtyText(item.reorder_level)} ${unit}`],
              ["Reorder up to", item.reorder_target ? `${qtyText(item.reorder_target)} ${unit}` : "—"], ["Details", attributesText(item) || "—"], ["Notes", item.notes || "—"]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 px-4 py-3"><dt className="text-ink-2">{k}</dt><dd className="text-right font-medium text-ink">{v}</dd></div>
            ))}
            <div className="px-4 py-3"><Link to={`/inventory-items/edit/${item.id}`} className="font-semibold text-brass">Edit item</Link></div>
          </dl>
        )}
      </TabPanel>
    </div>
  );
}
```

- [ ] **Step 5: Routes and titles**

`routeMeta.test.js` add:

```js
    ["/stock", { title: "Stock", back: null, hideNav: false }],
    ["/stock/abc", { title: "Item stock", back: "/stock", hideNav: false }],
```

Run: `cd frontend && npx vitest run src/app` → Expected: FAIL (`/stock/abc` title is "Stock", no back).

In `routeMeta.js` replace `[/^\/stock/, { title: "Stock" }],` (keep it below the `stock-issues` lines) with:

```js
  [/^\/stock\/[^/]+$/, { title: "Item stock", back: "/stock" }],
  [/^\/stock$/, { title: "Stock" }],
```

`App.jsx`: replace the `Stock` / `StockItemDetail` lazy imports with `StockPage` / `StockItemPage` from `./features/inventory/…`, and the stock routes with `<Route index element={<StockPage />} />` and `<Route path=":itemId" element={<StockItemPage />} />`.

Run: `cd frontend && npx vitest run 2>&1 | grep -E "^ +Tests" && npx eslint src/features/inventory src/App.jsx src/app` → Expected: pass; clean.

Visual check: `/stock` summary numbers equal the old page's; Low stock chip; item page tabs; movements page further on scroll.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/inventory frontend/src/App.jsx frontend/src/app/routeMeta.js frontend/src/app/routeMeta.test.js
git commit -m "feat(stock): stock list with summary card; item stock with batches, movements, details

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: Items, item categories, attributes

**Files:**
- Create: `frontend/src/features/inventory/itemForm.js`, `itemForm.test.js`, `ItemsPage.jsx`, `ItemFormPage.jsx`, `InventoryCategoriesPage.jsx`, `ItemAttributesPage.jsx`
- Modify: `frontend/src/App.jsx`, `frontend/src/app/routeMeta.js`, `frontend/src/app/routeMeta.test.js`

**Interfaces:**
- Consumes: Task 5 hooks and labels; `NameListEditor`, `cleanName` (Task 1).
- Produces: `emptyItem()`, `formFromItem(item)`, `validateItem(form)`, `toItemPayload(form)`.

- [ ] **Step 1: Failing test**

`frontend/src/features/inventory/itemForm.test.js`:

```js
import { describe, expect, test } from "vitest";
import { emptyItem, formFromItem, validateItem, toItemPayload } from "./itemForm";

const f = (o) => ({ ...emptyItem(), name: "PP Granules", category_id: "c1", ...o });

describe("item form", () => {
  test("name and category are required", () => {
    expect(validateItem(emptyItem())).toEqual({ name: "Enter the item name", category_id: "Choose a category" });
    expect(validateItem(f())).toEqual({});
  });
  test("reorder numbers: up to 3 decimals, 0 allowed, blank reorder level means 0", () => {
    expect(validateItem(f({ reorder_level: "12.3456" }))).toEqual({ reorder_level: "Use at most 3 decimals" });
    expect(validateItem(f({ reorder_target: "abc" }))).toEqual({ reorder_target: "Enter a number" });
    expect(toItemPayload(f({ reorder_level: "" })).reorder_level).toBe(0);
  });
  test("payload trims and sends one value per attribute", () => {
    expect(toItemPayload(f({ name: "  PP  Granules ", item_code: " ", unit: "KG", reorder_level: "500", reorder_target: "1,000", notes: "", selections: { a1: "v1", a2: "" } }))).toEqual({
      name: "PP Granules", item_code: null, category_id: "c1", unit: "KG", reorder_level: 500, reorder_target: 1000, notes: null, attribute_value_ids: ["v1"],
    });
  });
  test("editing starts from the saved item", () => {
    expect(formFromItem({ name: "X", item_code: "X1", category_id: "c1", category: { name: "Raw" }, unit: "PCS", reorder_level: "10.000", reorder_target: null, notes: null,
      attributes: [{ attribute_id: "a1", value_id: "v9" }] })).toEqual({
      name: "X", item_code: "X1", category_id: "c1", unit: "PCS", reorder_level: "10", reorder_target: "", notes: "", selections: { a1: "v9" },
    });
  });
});
```

Run: `cd frontend && npx vitest run src/features/inventory/itemForm.test.js` → Expected: FAIL.

- [ ] **Step 2: Implement**

`frontend/src/features/inventory/itemForm.js`:

```js
import { parseNumber } from "../../utils/numberInput";
import { cleanName } from "../../ui/nameList";
import { QTY_DP } from "./labels";

const qtyOpts = { dp: QTY_DP, allowZero: true };
const numText = (v) => (v === null || v === undefined || v === "" ? "" : String(Number(v)));

export const emptyItem = () => ({ name: "", item_code: "", category_id: "", unit: "KG", reorder_level: "", reorder_target: "", notes: "", selections: {} });

export const formFromItem = (item) => ({
  name: item.name || "",
  item_code: item.item_code || "",
  category_id: item.category_id || "",
  unit: item.unit || "KG",
  reorder_level: numText(item.reorder_level),
  reorder_target: numText(item.reorder_target),
  notes: item.notes || "",
  selections: Object.fromEntries((item.attributes || []).map((a) => [a.attribute_id, a.value_id])),
});

export const validateItem = (f) => {
  const e = {};
  if (!cleanName(f.name)) e.name = "Enter the item name";
  if (!f.category_id) e.category_id = "Choose a category";
  const level = parseNumber(f.reorder_level, qtyOpts);
  if (level.error) e.reorder_level = level.error;
  const target = parseNumber(f.reorder_target, qtyOpts);
  if (target.error) e.reorder_target = target.error;
  return e;
};

export const toItemPayload = (f) => ({
  name: cleanName(f.name),
  item_code: f.item_code.trim() || null,
  category_id: f.category_id,
  unit: f.unit,
  reorder_level: parseNumber(f.reorder_level, qtyOpts).value ?? 0,
  reorder_target: parseNumber(f.reorder_target, qtyOpts).value,
  notes: f.notes.trim() || null,
  attribute_value_ids: Object.values(f.selections).filter(Boolean),
});
```

Run: `cd frontend && npx vitest run src/features/inventory` → Expected: PASS.

- [ ] **Step 3: Items list**

`frontend/src/features/inventory/ItemsPage.jsx`:

```jsx
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Ellipsis } from "lucide-react";
import { useItemList, useInvCategories, rowsOf } from "./api";
import { qty, attributesText, UNIT_LABEL } from "./labels";
import PageHeader from "../../ui/PageHeader";
import TextInput from "../../ui/TextInput";
import Chips from "../../ui/Chips";
import IconButton from "../../ui/IconButton";
import ActionSheet from "../../ui/ActionSheet";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";

export default function ItemsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const search = params.get("q") || "";
  const categoryId = params.get("cat") || "";
  const term = useDebounced(search.trim());
  const query = useMemo(() => ({ ...(term ? { search: term } : {}), ...(categoryId ? { category_id: categoryId } : {}) }), [term, categoryId]);
  const list = useItemList(query);
  const categories = useInvCategories();
  const sentinel = useInfiniteSentinel(list);
  const rows = rowsOf(list);
  const setParam = (key, value) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (value) next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });
  const catChips = [{ value: "", label: "All" }, ...(categories.data || []).map((c) => ({ value: c.id, label: c.name }))];

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Items" subtitle="Materials you buy and use" actions={<>
        <IconButton label="More item actions" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>
        <Link to="/inventory-items/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>
      </>} />
      <div className="mt-3 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setParam("q", e.target.value)} placeholder="Search name or code" aria-label="Search items" enterKeyHint="search" />
        {catChips.length > 1 && <Chips label="Category" options={catChips} value={categoryId} onChange={(v) => setParam("cat", v)} />}
      </div>
      <div className={`mt-4 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? <ListSkeleton /> : list.isError && rows.length === 0 ? <ErrorState title="Couldn't load items." onRetry={() => list.refetch()} /> : rows.length === 0 ? (
          <EmptyState title="No items here" body={term || categoryId ? "Try another search or category." : "Add the materials you buy, like PP granules or ink."}
            action={<Link to="/inventory-items/new" className={buttonClass()}>Add an item</Link>} />
        ) : (
          <>
            <ul className="overflow-hidden rounded-2xl bg-surface">
              {rows.map((it) => (
                <li key={it.id} className="border-b border-line/60 last:border-0">
                  <Link to={`/inventory-items/edit/${it.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{it.name}{it.item_code ? <span className="font-normal text-ink-2"> · {it.item_code}</span> : null}</span>
                      <span className="block truncate text-xs text-ink-2">{[it.category?.name, attributesText(it)].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-ink-2">
                      <span className="block font-semibold text-ink">{UNIT_LABEL[it.unit]?.[1] || it.unit}</span>
                      Reorder at {qty(it.reorder_level, it.unit)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div ref={sentinel} className="py-3 text-center text-xs text-ink-2">{list.isFetchingNextPage ? "Loading more…" : ""}</div>
          </>
        )}
      </div>
      <ActionSheet open={menuOpen} title="Items" onClose={() => setMenuOpen(false)} actions={[
        { label: "Item categories", onSelect: () => navigate("/inventory-categories") },
        { label: "Item details (GSM, colour…)", onSelect: () => navigate("/item-attributes") },
      ]} />
    </div>
  );
}
```

- [ ] **Step 4: Item form**

`frontend/src/features/inventory/ItemFormPage.jsx`:

```jsx
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useItem, useInvCategories, useAttributes, refreshStock } from "./api";
import { emptyItem, formFromItem, validateItem, toItemPayload } from "./itemForm";
import { UNITS, UNIT_LABEL } from "./labels";
import { inventoryItemAPI } from "../../services/inventoryAPI";
import Field from "../../ui/Field";
import TextInput from "../../ui/TextInput";
import NumberInput from "../../ui/NumberInput";
import Chips from "../../ui/Chips";
import Button from "../../ui/Button";
import StickyFooter from "../../ui/StickyFooter";
import PageHeader from "../../ui/PageHeader";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { FORM_PAGE, INPUT, buttonClass } from "../../ui/styles";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function ItemFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const existing = useItem(id);
  const categories = useInvCategories();
  const attributes = useAttributes();
  const initial = useMemo(() => (isEdit ? (existing.data ? formFromItem(existing.data) : null) : emptyItem()), [isEdit, existing.data]);
  const [edited, setEdited] = useState(null);
  const [shown, setShown] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useMutation({
    mutationFn: (payload) => (isEdit ? inventoryItemAPI.update(id, payload) : inventoryItemAPI.create(payload)),
    onSuccess: () => refreshStock(qc),
  });
  const remove = useMutation({ mutationFn: () => inventoryItemAPI.delete(id), onSuccess: () => refreshStock(qc) });

  if ((isEdit && existing.isPending) || categories.isPending || attributes.isPending) return <PageSkeleton />;
  if (isEdit && existing.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {existing.error?.response?.status === 404
          ? <EmptyState title="This item doesn't exist" body="It may have been deleted." action={<Link to="/inventory-items" className={buttonClass({ variant: "secondary" })}>All items</Link>} />
          : <ErrorState title="Couldn't load this item." onRetry={() => existing.refetch()} />}
      </div>
    );
  }
  if (categories.isError || attributes.isError) return <div className="px-4 py-6"><ErrorState title="Couldn't load categories." onRetry={() => { categories.refetch(); attributes.refetch(); }} /></div>;

  const f = edited ?? initial;
  const set = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));
  const errors = shown ? validateItem(f) : {};
  const back = () => navigate("/inventory-items", { replace: true });
  const unitWord = UNIT_LABEL[f.unit]?.[1] || "";

  const submit = (e) => {
    e.preventDefault();
    if (Object.keys(validateItem(f)).length) {
      setShown(true);
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    save.mutate(toItemPayload(f), { onSuccess: () => { toast.success(isEdit ? "Item updated" : "Item added"); back(); } });
  };
  const deleteItem = () => remove.mutate(undefined, {
    onSuccess: () => { toast.success("Item deleted"); back(); },
    onError: (err) => { setConfirmDelete(false); toast.error(errorText(err, "Couldn't delete the item. Try again.")); },
  });
  const catOptions = (categories.data || []).map((c) => ({ value: c.id, label: c.name }));

  return (
    <form onSubmit={submit} noValidate className={`${FORM_PAGE} pt-4`}>
      <PageHeader title={isEdit ? "Edit item" : "New item"} />
      <div className="space-y-5 pb-6 sm:mt-4">
        <Field label="Name" htmlFor="it-name" error={errors.name}><TextInput value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. PP granules" /></Field>
        <Field label="Code" htmlFor="it-code" optional><TextInput value={f.item_code} onChange={(e) => set({ item_code: e.target.value })} placeholder="Your own short code" /></Field>
        <div>
          <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">Category</p>
          {catOptions.length ? <Chips label="Category" options={catOptions} value={f.category_id} onChange={(category_id) => set({ category_id })} />
            : <p className="text-sm text-ink-2">No categories yet. <Link to="/inventory-categories" className="font-semibold text-brass">Add one</Link></p>}
          {errors.category_id && <p role="alert" className="mt-1.5 text-xs font-medium text-status-critical">{errors.category_id}</p>}
        </div>
        <div>
          <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">Counted in</p>
          <Chips label="Unit" options={UNITS} value={f.unit} onChange={(unit) => set({ unit })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reorder at" htmlFor="it-reorder" error={errors.reorder_level} hint="Shown as low stock at or below this">
            <NumberInput value={f.reorder_level} onChange={(reorder_level) => set({ reorder_level })} suffix={unitWord} placeholder="0" />
          </Field>
          <Field label="Order up to" htmlFor="it-target" optional error={errors.reorder_target}>
            <NumberInput value={f.reorder_target} onChange={(reorder_target) => set({ reorder_target })} suffix={unitWord} />
          </Field>
        </div>
        {(attributes.data || []).filter((a) => a.values.length).map((a) => (
          <div key={a.id}>
            <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">{a.name} <span className="font-normal">(optional)</span></p>
            <Chips label={a.name} options={[{ value: "", label: "None" }, ...a.values.map((v) => ({ value: v.id, label: v.value }))]}
              value={f.selections[a.id] || ""} onChange={(v) => set({ selections: { ...f.selections, [a.id]: v } })} />
          </div>
        ))}
        <Field label="Notes" htmlFor="it-notes" optional>
          <textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} className={`${INPUT} h-auto py-2`} />
        </Field>
        {isEdit && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete item</Button>}
      </div>
      <StickyFooter>
        {save.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(save.error, "Couldn't save. Check your connection and try again.")}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={back}>Cancel</Button>
          <Button type="submit" block size="lg" loading={save.isPending}>{isEdit ? "Save changes" : "Save item"}</Button>
        </div>
      </StickyFooter>
      <ConfirmDialog open={confirmDelete} title="Delete this item?" message="An item with stock on hand or on an open purchase order can't be deleted — you'll see why."
        confirmLabel="Delete item" cancelLabel="Keep it" busy={remove.isPending} onConfirm={deleteItem} onClose={() => setConfirmDelete(false)} />
    </form>
  );
}
```

- [ ] **Step 5: Categories and attributes pages**

`frontend/src/features/inventory/InventoryCategoriesPage.jsx`:

```jsx
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useInvCategories, refreshStock } from "./api";
import { inventoryCategoryAPI } from "../../services/inventoryAPI";
import PageHeader from "../../ui/PageHeader";
import NameListEditor from "../../ui/NameListEditor";
import { ErrorState, ListSkeleton } from "../../ui/States";

export default function InventoryCategoriesPage() {
  const qc = useQueryClient();
  const categories = useInvCategories();
  const after = () => refreshStock(qc);
  return (
    <div className="mx-auto max-w-xl px-4 py-4 sm:px-6">
      <PageHeader title="Item categories" subtitle={<Link to="/inventory-items" className="text-brass">← Items</Link>} />
      <div className="mt-4">
        {categories.isPending ? <ListSkeleton rows={4} /> : categories.isError ? <ErrorState title="Couldn't load categories." onRetry={() => categories.refetch()} /> : (
          <NameListEditor items={categories.data} noun="category" addPlaceholder="New category, e.g. Raw material" emptyText="No categories yet."
            onAdd={async (name) => { await inventoryCategoryAPI.create({ name }); await after(); }}
            onRename={async (c, name) => { await inventoryCategoryAPI.update(c.id, { name }); await after(); }}
            onDelete={async (c) => { await inventoryCategoryAPI.delete(c.id); await after(); }} />
        )}
      </div>
    </div>
  );
}
```

`frontend/src/features/inventory/ItemAttributesPage.jsx`:

```jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useAttributes, refreshStock } from "./api";
import { itemAttributesAPI } from "../../services/inventoryAPI";
import PageHeader from "../../ui/PageHeader";
import NameListEditor from "../../ui/NameListEditor";
import { ErrorState, ListSkeleton } from "../../ui/States";

export default function ItemAttributesPage() {
  const qc = useQueryClient();
  const attributes = useAttributes();
  const [open, setOpen] = useState(null);
  const after = () => refreshStock(qc);
  return (
    <div className="mx-auto max-w-xl px-4 py-4 sm:px-6">
      <PageHeader title="Item details" subtitle={<>Like GSM or colour · <Link to="/inventory-items" className="text-brass">← Items</Link></>} />
      <div className="mt-4">
        {attributes.isPending ? <ListSkeleton rows={4} /> : attributes.isError ? <ErrorState title="Couldn't load item details." onRetry={() => attributes.refetch()} /> : (
          <NameListEditor items={attributes.data} noun="detail" addPlaceholder="New detail, e.g. GSM" emptyText="No details yet."
            onAdd={async (name) => { await itemAttributesAPI.create({ name }); await after(); }}
            onRename={async (a, name) => { await itemAttributesAPI.update(a.id, { name }); await after(); }}
            onDelete={async (a) => { await itemAttributesAPI.delete(a.id); await after(); }}
            renderExtra={(a) => (
              <button type="button" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}
                className="flex h-9 items-center gap-1 rounded-full px-2 text-xs font-semibold text-brass hover:bg-raised">
                {a.values.length} value{a.values.length === 1 ? "" : "s"}<ChevronDown className={`h-4 w-4 transition ${open === a.id ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
            )}
            renderBelow={(a) => open === a.id && (
              <div className="bg-canvas/40 px-4 pb-4 pt-1">
                <NameListEditor items={a.values.map((v) => ({ id: v.id, name: v.value }))} noun="value" addPlaceholder={`New ${a.name} value`} emptyText="No values yet."
                  onAdd={async (value) => { await itemAttributesAPI.createValue(a.id, { value }); await after(); }}
                  onRename={async (v, value) => { await itemAttributesAPI.updateValue(v.id, { value }); await after(); }}
                  onDelete={async (v) => { await itemAttributesAPI.deleteValue(v.id); await after(); }} />
              </div>
            )} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Routes and titles**

`routeMeta.test.js` add:

```js
    ["/inventory-items", { title: "Items", back: null, hideNav: false }],
    ["/inventory-items/new", { title: "New item", back: null, hideNav: true }],
    ["/inventory-items/edit/i1", { title: "Edit item", back: null, hideNav: true }],
    ["/inventory-categories", { title: "Item categories", back: null, hideNav: false }],
    ["/item-attributes", { title: "Item details", back: null, hideNav: false }],
```

Run → FAIL. In `routeMeta.js` replace the three `inventory-items` entries and the `inventory-categories` / `item-attributes` entries with:

```js
  [/^\/inventory-items\/new$/, { title: "New item", hideNav: true }],
  [/^\/inventory-items\/edit\/[^/]+$/, { title: "Edit item", hideNav: true }],
  [/^\/inventory-items/, { title: "Items" }],
  [/^\/inventory-categories/, { title: "Item categories" }],
  [/^\/item-attributes/, { title: "Item details" }],
```

`App.jsx`: replace the `InventoryItems`, `CreateInventoryItem`, `EditInventoryItem`, `InventoryCategories`, `ItemAttributes` lazy imports with `ItemsPage`, `ItemFormPage`, `InventoryCategoriesPage`, `ItemAttributesPage` from `./features/inventory/…`; routes: index `<ItemsPage />`, `new` and `edit/:id` `<ItemFormPage />`, `inventory-categories` `<InventoryCategoriesPage />`, `item-attributes` `<ItemAttributesPage />`.

Run: `cd frontend && npx vitest run 2>&1 | grep -E "^ +Tests" && npx eslint src/features/inventory src/App.jsx src/app` → Expected: pass; clean.

Visual check: add/edit an item with a GSM value; delete of an item with stock shows the server's reason; categories and attribute values add/rename/delete.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/inventory frontend/src/App.jsx frontend/src/app/routeMeta.js frontend/src/app/routeMeta.test.js
git commit -m "feat(inventory): items list and form; categories and item details edited in place

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: Purchasing — pickers, new purchase order, PO page, receive page

**Files:**
- Create: `frontend/src/features/inventory/poDraft.js`, `poDraft.test.js`, `receiveForm.js`, `receiveForm.test.js`, `recentItems.js`, `ItemPicker.jsx`, `SupplierPicker.jsx`, `PurchaseOrdersPage.jsx`, `NewPurchaseOrderPage.jsx`, `PurchaseOrderPage.jsx`, `ReceivePage.jsx`
- Modify: `frontend/src/App.jsx`, `frontend/src/app/routeMeta.js`, `frontend/src/app/routeMeta.test.js`

**Interfaces:**
- Produces: `PO_STEPS`, `newPoLine(item?)`, `emptyPo(today, item?)`, `lineAmount(line) → number|null`, `poTotal(draft) → number`, `poErrors(draft, step) → flat errors` (`supplier`, `order_date`, `expected_date`, `lines`, `item:<key>`, `qty:<key>`, `rate:<key>`), `toPoPayload(draft)`; `receiveLinesFromPo(po)`, `receiveErrors(form)` (`receipt_date`, `lines`, `qty:<id>`, `rate:<id>`), `isOverReceipt(line)`, `receiveTotal(form)`, `toReceivePayload(form)`; `recentItemIds()`, `rememberItems(ids)`; `<ItemPicker open onClose onPick withStock?>` (picks `{id, name, unit, in_stock?}`), `<SupplierPicker open onClose onPick>` (picks `{id, name}`, can add a supplier by name).

- [ ] **Step 1: Failing tests**

`frontend/src/features/inventory/poDraft.test.js`:

```js
import { describe, expect, test } from "vitest";
import { emptyPo, newPoLine, lineAmount, poTotal, poErrors, toPoPayload } from "./poDraft";

const item = { id: "i1", name: "PP Granules", unit: "KG" };
const draft = (o) => ({ ...emptyPo("2026-09-30"), supplier: { id: "s1", name: "Raj" }, lines: [{ ...newPoLine(item), key: "k1", quantity: "100", rate: "92.50" }], ...o });

describe("purchase order draft", () => {
  test("step 1 needs a supplier; expected date not before the order date", () => {
    expect(poErrors(emptyPo("2026-09-30"), 0)).toEqual({ supplier: "Choose a supplier" });
    expect(poErrors(draft({ expected_date: "2026-09-01" }), 0)).toEqual({ expected_date: "Can't be before the order date" });
    expect(poErrors(draft(), 0)).toEqual({});
  });
  test("step 2: at least one line; each line needs item, quantity (3 decimals) and rate (> 0)", () => {
    expect(poErrors(draft({ lines: [newPoLine()] }), 1)).toEqual({ lines: "Add at least one item" });
    const bad = draft({ lines: [{ ...newPoLine(item), key: "a", quantity: "1.2345", rate: "0" }, { ...newPoLine(), key: "b", quantity: "5", rate: "" }] });
    expect(poErrors(bad, 1)).toEqual({ "qty:a": "Use at most 3 decimals", "rate:a": "Must be more than 0", "item:b": "Choose an item", "rate:b": "Enter the rate" });
  });
  test("an untouched blank line is ignored", () => {
    const d = draft();
    d.lines.push(newPoLine());
    expect(poErrors(d, 1)).toEqual({});
    expect(toPoPayload(d).items).toHaveLength(1);
  });
  test("amounts to the paisa", () => {
    expect(lineAmount({ quantity: "0.333", rate: "3" })).toBe(1);
    expect(lineAmount({ quantity: "", rate: "3" })).toBeNull();
    expect(poTotal(draft({ lines: [{ ...newPoLine(item), quantity: "100", rate: "92.50" }, { ...newPoLine(item), quantity: "0.1", rate: "0.20" }] }))).toBe(9250.02);
  });
  test("payload", () => {
    expect(toPoPayload(draft({ notes: "  ", expected_date: "" }))).toEqual({
      supplier_id: "s1", order_date: "2026-09-30", expected_date: null, notes: null, items: [{ item_id: "i1", quantity_ordered: 100, rate: 92.5 }],
    });
  });
});
```

`frontend/src/features/inventory/receiveForm.test.js`:

```js
import { describe, expect, test } from "vitest";
import { receiveLinesFromPo, receiveErrors, isOverReceipt, receiveTotal, toReceivePayload } from "./receiveForm";

const po = { items: [
  { id: "l1", quantity_ordered: "100.000", quantity_received: "40.000", quantity_pending: 60, rate: "92.50", item: { name: "PP", unit: "KG" } },
  { id: "l2", quantity_ordered: "10.000", quantity_received: "10.000", quantity_pending: 0, rate: "5.00", item: { name: "Ink", unit: "LITRE" } },
] };
const form = (o) => ({ receipt_date: "2026-09-30", supplier_bill_ref: "", notes: "", lines: receiveLinesFromPo(po), ...o });

describe("receive form", () => {
  test("pre-filled with what is still open at the PO rate; fully received lines start blank", () => {
    expect(receiveLinesFromPo(po).map((l) => [l.id, l.quantity, l.rate, l.pending])).toEqual([["l1", "60", "92.5", 60], ["l2", "", "5", 0]]);
  });
  test("blank or 0 skips a line; at least one line needed; a received line needs a rate", () => {
    expect(receiveErrors(form())).toEqual({});
    const none = form();
    none.lines = none.lines.map((l) => ({ ...l, quantity: "0" }));
    expect(receiveErrors(none)).toEqual({ lines: "Enter a quantity on at least one line" });
    const noRate = form();
    noRate.lines[0].rate = "";
    expect(receiveErrors(noRate)).toEqual({ "rate:l1": "Enter the rate" });
    const badQty = form();
    badQty.lines[0].quantity = "1.2345";
    expect(receiveErrors(badQty)).toEqual({ "qty:l1": "Use at most 3 decimals" });
  });
  test("more than open is allowed but flagged", () => {
    const f = form();
    expect(isOverReceipt(f.lines[0])).toBe(false);
    expect(isOverReceipt({ ...f.lines[0], quantity: "61" })).toBe(true);
    expect(isOverReceipt({ ...f.lines[1], quantity: "1" })).toBe(true);
  });
  test("total and payload", () => {
    const f = form({ supplier_bill_ref: " B-17 " });
    expect(receiveTotal(f)).toBe(5550);
    expect(toReceivePayload(f)).toEqual({ receipt_date: "2026-09-30", supplier_bill_ref: "B-17", notes: null, items: [{ purchase_order_item_id: "l1", quantity_received: 60, rate: 92.5 }] });
  });
});
```

Run: `cd frontend && npx vitest run src/features/inventory` → Expected: FAIL (modules missing).

- [ ] **Step 2: Implement**

`frontend/src/features/inventory/poDraft.js`:

```js
import { parseNumber } from "../../utils/numberInput";
import { isISODate } from "../../utils/istDate";
import { QTY_DP } from "./labels";

export const PO_STEPS = ["Supplier", "Items", "Review"];

let seq = 0;
export const newPoLine = (item) => ({ key: `l${Date.now()}-${(seq += 1)}`, item_id: item?.id || "", item_name: item?.name || "", unit: item?.unit || "", quantity: "", rate: "" });
export const emptyPo = (today, item) => ({ supplier: null, order_date: today, expected_date: "", notes: "", lines: [newPoLine(item)] });

const q = (t) => parseNumber(t, { dp: QTY_DP });
const r = (t) => parseNumber(t);
const blank = (l) => !l.item_id && !String(l.quantity).trim() && !String(l.rate).trim();
const used = (d) => d.lines.filter((l) => !blank(l));

export const lineAmount = (l) => {
  const qty = q(l.quantity).value;
  const rate = r(l.rate).value;
  return qty === null || rate === null ? null : Math.round(qty * rate * 100) / 100;
};
export const poTotal = (d) => used(d).reduce((sum, l) => sum + Math.round((lineAmount(l) || 0) * 100), 0) / 100;

export const poErrors = (d, step) => {
  const e = {};
  if (step === 0) {
    if (!d.supplier) e.supplier = "Choose a supplier";
    if (!isISODate(d.order_date)) e.order_date = "Choose the order date";
    if (d.expected_date && d.expected_date < d.order_date) e.expected_date = "Can't be before the order date";
  }
  if (step === 1) {
    const lines = used(d);
    if (!lines.length) e.lines = "Add at least one item";
    for (const l of lines) {
      if (!l.item_id) e[`item:${l.key}`] = "Choose an item";
      const qty = q(l.quantity);
      if (qty.error || qty.value === null) e[`qty:${l.key}`] = qty.error || "Enter the quantity";
      const rate = r(l.rate);
      if (rate.error || rate.value === null) e[`rate:${l.key}`] = rate.error || "Enter the rate";
    }
  }
  return e;
};

export const toPoPayload = (d) => ({
  supplier_id: d.supplier.id,
  order_date: d.order_date,
  expected_date: d.expected_date || null,
  notes: d.notes.trim() || null,
  items: used(d).map((l) => ({ item_id: l.item_id, quantity_ordered: q(l.quantity).value, rate: r(l.rate).value })),
});
```

`frontend/src/features/inventory/receiveForm.js`:

```js
import { parseNumber } from "../../utils/numberInput";
import { isISODate } from "../../utils/istDate";
import { QTY_DP } from "./labels";

const q = (t) => parseNumber(t, { dp: QTY_DP, allowZero: true });
const r = (t) => parseNumber(t);
const n = (v) => Number(v) || 0;

export const receiveLinesFromPo = (po) => po.items.map((l) => ({
  id: l.id,
  name: l.item?.name || "Item",
  unit: l.item?.unit || "",
  ordered: n(l.quantity_ordered),
  received: n(l.quantity_received),
  pending: n(l.quantity_pending),
  quantity: n(l.quantity_pending) > 0 ? String(n(l.quantity_pending)) : "",
  rate: String(n(l.rate)),
}));

const receiving = (form) => form.lines.filter((l) => (q(l.quantity).value || 0) > 0);

export const receiveErrors = (form) => {
  const e = {};
  if (!isISODate(form.receipt_date)) e.receipt_date = "Choose the date it arrived";
  for (const l of form.lines) {
    const qty = q(l.quantity);
    if (qty.error) e[`qty:${l.id}`] = qty.error;
    else if ((qty.value || 0) > 0) {
      const rate = r(l.rate);
      if (rate.error || rate.value === null) e[`rate:${l.id}`] = rate.error || "Enter the rate";
    }
  }
  if (!Object.keys(e).length && !receiving(form).length) e.lines = "Enter a quantity on at least one line";
  return e;
};

/** Receiving more than is open is allowed (the supplier sent extra) but shown. */
export const isOverReceipt = (l) => (q(l.quantity).value || 0) > l.pending + 0.0005;

export const receiveTotal = (form) =>
  receiving(form).reduce((sum, l) => sum + Math.round(q(l.quantity).value * (r(l.rate).value || 0) * 100), 0) / 100;

export const toReceivePayload = (form) => ({
  receipt_date: form.receipt_date,
  supplier_bill_ref: form.supplier_bill_ref.trim() || null,
  notes: form.notes.trim() || null,
  items: receiving(form).map((l) => ({ purchase_order_item_id: l.id, quantity_received: q(l.quantity).value, rate: r(l.rate).value })),
});
```

`frontend/src/features/inventory/recentItems.js`:

```js
const KEY = "yars_recent_inventory_items";

/** Item ids used most recently on this device, newest first. Storage may be unavailable. */
export const recentItemIds = () => {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
};

export const rememberItems = (ids) => {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set([...ids, ...recentItemIds()])].slice(0, 8)));
  } catch {
    /* a convenience only */
  }
};
```

Run: `cd frontend && npx vitest run src/features/inventory` → Expected: PASS.

- [ ] **Step 3: Pickers**

`frontend/src/features/inventory/ItemPicker.jsx`:

```jsx
import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import SearchPicker from "../../ui/SearchPicker";
import { buttonClass } from "../../ui/styles";
import { useItemsPicker, useStockList, rowsOf } from "./api";
import { qty, attributesText } from "./labels";
import { recentItemIds } from "./recentItems";
import useDebounced from "../../ui/useDebounced";

/** Search items. withStock shows what is on hand (from the stock list) — used when issuing. */
export default function ItemPicker({ open, onClose, onPick, withStock = false }) {
  const [query, setQuery] = useState("");
  const term = useDebounced(query.trim());
  const all = useItemsPicker();
  const stock = useStockList(withStock && open ? { ...(term ? { search: term } : {}) } : { disabled: true });
  const source = withStock ? stock : all;
  const items = useMemo(() => {
    let rows = withStock ? rowsOf(stock) : all.data || [];
    if (!withStock && term) {
      const t = term.toLowerCase();
      rows = rows.filter((i) => i.name.toLowerCase().includes(t) || (i.item_code || "").toLowerCase().includes(t));
    }
    if (!term) {
      const recent = recentItemIds();
      const rank = (i) => (recent.includes(i.id) ? recent.indexOf(i.id) : recent.length);
      rows = [...rows].sort((a, b) => rank(a) - rank(b));
    }
    return rows;
  }, [withStock, stock, all.data, term]);

  return (
    <SearchPicker open={open} title="Choose item" query={query} onQuery={setQuery} placeholder="Search item name or code"
      loading={source.isPending} error={source.isError ? "Couldn't load items." : undefined}
      items={items} getKey={(i) => i.id} onClose={onClose}
      onPick={(i) => { onPick({ id: i.id, name: i.name, unit: i.unit, in_stock: withStock ? Number(i.in_stock) : undefined }); setQuery(""); }}
      empty={term ? `No item matches “${term}”` : "No items yet"}
      renderItem={(i) => (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-ink">{i.name}</span>
            <span className="block truncate text-xs text-ink-2">{[i.category?.name, attributesText(i)].filter(Boolean).join(" · ") || i.item_code || ""}</span>
          </span>
          {withStock && <span className="shrink-0 font-num text-sm tabular-nums text-ink-2">{qty(i.in_stock, i.unit)}</span>}
        </>
      )}
      footer={<a href="/inventory-items/new" className={buttonClass({ variant: "secondary", block: true })}>＋ New item (opens the item form)</a>} />
  );
}

ItemPicker.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onPick: PropTypes.func.isRequired, withStock: PropTypes.bool };
```

Note: `useStockList` is always called (hooks rule); when not needed it is keyed with `{disabled:true}` params — to avoid a wasted request, add an `enabled` option: in `api.js` change `usePaged` to accept a 5th argument `enabled = true` passed to `useInfiniteQuery`, and `useStockList = (params, enabled = true) => usePaged(keys.stock.list(params), stockAPI.getStock, params, 50, enabled)`. Then call `useStockList(term ? { search: term } : {}, withStock && open)` here instead of the `{ disabled: true }` form.

`frontend/src/features/inventory/SupplierPicker.jsx`:

```jsx
import { useState } from "react";
import PropTypes from "prop-types";
import { useQueryClient } from "@tanstack/react-query";
import SearchPicker from "../../ui/SearchPicker";
import Button from "../../ui/Button";
import { useSuppliersPicker, refreshStock } from "./api";
import { supplierAPI } from "../../services/inventoryAPI";
import { cleanName } from "../../ui/nameList";
import { errorText } from "../../lib/errors";

export default function SupplierPicker({ open, onClose, onPick }) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const list = useSuppliersPicker();
  const term = query.trim().toLowerCase();
  const items = (list.data || []).filter((s) => s.name.toLowerCase().includes(term) || (s.phone || "").includes(term));
  const exact = (list.data || []).some((s) => s.name.toLowerCase() === term);
  const create = async () => {
    setCreating(true);
    setError("");
    try {
      const res = await supplierAPI.create({ name: cleanName(query), phone: null, email: null, gst_number: null, address: null });
      await refreshStock(qc);
      onPick({ id: res.data.data.id, name: res.data.data.name });
      setQuery("");
    } catch (err) {
      setError(errorText(err, "Couldn't add the supplier."));
    } finally {
      setCreating(false);
    }
  };
  return (
    <SearchPicker open={open} title="Choose supplier" query={query} onQuery={(v) => { setQuery(v); setError(""); }} placeholder="Search supplier name or phone"
      loading={list.isPending} error={error || (list.isError ? "Couldn't load suppliers." : undefined)}
      items={items} getKey={(s) => s.id} onClose={onClose} onPick={(s) => { onPick({ id: s.id, name: s.name }); setQuery(""); }}
      empty={term ? `No supplier called “${query.trim()}”` : "No suppliers yet"}
      renderItem={(s) => (<span className="min-w-0 flex-1"><span className="block truncate font-semibold text-ink">{s.name}</span>{s.phone && <span className="block text-xs text-ink-2">{s.phone}</span>}</span>)}
      footer={term && !exact ? <Button variant="secondary" block loading={creating} onClick={create}>＋ New supplier “{cleanName(query)}”</Button> : null} />
  );
}

SupplierPicker.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onPick: PropTypes.func.isRequired };
```

(The item picker's "＋ New item" is a plain link rather than an inline sheet: an item needs a category and unit, which is a full form.)

- [ ] **Step 4: Purchase orders list**

`frontend/src/features/inventory/PurchaseOrdersPage.jsx`:

```jsx
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { usePoList, rowsOf } from "./api";
import { PO_STATUS } from "./labels";
import PageHeader from "../../ui/PageHeader";
import TextInput from "../../ui/TextInput";
import Chips from "../../ui/Chips";
import Tag from "../../ui/Tag";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { shortDate } from "../../utils/dashboardFormat";

const CHIPS = [{ value: "", label: "All" }, ...Object.entries(PO_STATUS).map(([value, s]) => ({ value, label: s.label }))];
const linesDone = (po) => po.items.filter((l) => Number(l.quantity_received) >= Number(l.quantity_ordered)).length;

export default function PurchaseOrdersPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "";
  const search = params.get("q") || "";
  const term = useDebounced(search.trim());
  const query = useMemo(() => ({ ...(term ? { search: term } : {}), ...(status ? { status } : {}) }), [term, status]);
  const list = usePoList(query);
  const sentinel = useInfiniteSentinel(list);
  const rows = rowsOf(list);
  const setParam = (key, value) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (value) next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Purchase orders" actions={<Link to="/purchase-orders/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>} />
      <div className="mt-3 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setParam("q", e.target.value)} placeholder="Search PO number" aria-label="Search purchase orders" enterKeyHint="search" />
        <Chips label="Status" options={CHIPS} value={status} onChange={(v) => setParam("status", v)} />
      </div>
      <div className={`mt-4 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? <ListSkeleton /> : list.isError && rows.length === 0 ? <ErrorState title="Couldn't load purchase orders." onRetry={() => list.refetch()} /> : rows.length === 0 ? (
          <EmptyState title="No purchase orders here" body={term || status ? "Try another search or status." : "Order material from a supplier; receive it here when it arrives."}
            action={<Link to="/purchase-orders/new" className={buttonClass()}>New purchase order</Link>} />
        ) : (
          <>
            <ul className="overflow-hidden rounded-2xl bg-surface">
              {rows.map((po) => {
                const s = PO_STATUS[po.status] || { label: po.status, tone: "muted" };
                return (
                  <li key={po.id} className="border-b border-line/60 last:border-0">
                    <Link to={`/purchase-orders/${po.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{po.po_number} · {po.supplier?.name || "—"}</span>
                        <span className="block truncate text-xs text-ink-2">{shortDate(po.order_date)} · {linesDone(po)} of {po.items.length} item{po.items.length === 1 ? "" : "s"} received</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <Money value={Math.round(Number(po.total_amount) * 100) / 100} className="text-sm font-bold text-ink" />
                        <Tag label={s.label} tone={s.tone} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div ref={sentinel} className="py-3 text-center text-xs text-ink-2">{list.isFetchingNextPage ? "Loading more…" : ""}</div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: New purchase order (3 steps)**

`frontend/src/features/inventory/NewPurchaseOrderPage.jsx`:

```jsx
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, Plus } from "lucide-react";
import { useItemsPicker, refreshStock } from "./api";
import { PO_STEPS, emptyPo, newPoLine, lineAmount, poTotal, poErrors, toPoPayload } from "./poDraft";
import { qty, UNIT_LABEL } from "./labels";
import ItemPicker from "./ItemPicker";
import SupplierPicker from "./SupplierPicker";
import { purchaseOrderAPI } from "../../services/inventoryAPI";
import Field from "../../ui/Field";
import NumberInput from "../../ui/NumberInput";
import DateField from "../../ui/DateField";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Stepper from "../../ui/Stepper";
import StickyFooter from "../../ui/StickyFooter";
import PageHeader from "../../ui/PageHeader";
import ReviewBlock from "../../ui/ReviewBlock";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { Money } from "../../ui/Money";
import { FORM_PAGE, INPUT, INPUT_INVALID } from "../../ui/styles";
import useSteps from "../../ui/useSteps";
import { todayIST } from "../../utils/istDate";
import { shortDate } from "../../utils/dashboardFormat";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function NewPurchaseOrderPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const presetItemId = params.get("item");
  const picker = useItemsPicker();
  const initial = useMemo(() => emptyPo(todayIST(), (picker.data || []).find((i) => i.id === presetItemId)), [picker.data, presetItemId]);
  const [edited, setEdited] = useState(null);
  const d = edited ?? initial;
  const update = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));
  const setLine = (key, patch) => update({ lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });
  const steps = useSteps({ count: PO_STEPS.length, errorsFor: (i) => poErrors(d, i) });
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [itemFor, setItemFor] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const create = useMutation({ mutationFn: (payload) => purchaseOrderAPI.create(payload).then((r) => r.data.data), onSuccess: () => refreshStock(qc) });

  const step = steps.step;
  const errors = steps.shownFor(step) ? poErrors(d, step) : {};
  const total = poTotal(d);
  const leave = () => navigate("/purchase-orders", { replace: true });
  const back = () => (step === 0 ? (edited ? setConfirmLeave(true) : leave()) : steps.back());
  const submit = () => {
    if (!steps.validateAll()) return;
    create.mutate(toPoPayload(d), { onSuccess: (po) => { toast.success(`Purchase order ${po.po_number} created`); navigate(`/purchase-orders/${po.id}`, { replace: true }); } });
  };
  const filled = d.lines.filter((l) => l.item_id);

  return (
    <div className={`${FORM_PAGE} pt-3`}>
      <PageHeader title="New purchase order" />
      <Stepper steps={PO_STEPS} current={step} reached={steps.reached} onGo={steps.go} />
      <div className="mt-4 space-y-5 pb-6">
        {step === 0 && (
          <>
            <Field label="Supplier" htmlFor="po-supplier" error={errors.supplier}>
              <button type="button" onClick={() => setSupplierOpen(true)} className={`${INPUT} flex items-center justify-between gap-2 text-left ${errors.supplier ? INPUT_INVALID : ""}`}>
                {d.supplier ? <span className="truncate font-semibold">{d.supplier.name}</span> : <span className="text-ink-2">Choose a supplier</span>}
                <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
              </button>
            </Field>
            <Field label="Order date" htmlFor="po-date" error={errors.order_date}><DateField value={d.order_date} onChange={(order_date) => update({ order_date })} /></Field>
            <Field label="Expected by" htmlFor="po-expected" optional error={errors.expected_date}><DateField quick={false} value={d.expected_date} onChange={(expected_date) => update({ expected_date })} /></Field>
            <Field label="Notes" htmlFor="po-notes" optional><textarea rows={2} value={d.notes} onChange={(e) => update({ notes: e.target.value })} className={`${INPUT} h-auto py-2`} /></Field>
          </>
        )}
        {step === 1 && (
          <div className="space-y-3">
            {d.lines.map((l, i) => {
              const amount = lineAmount(l);
              const unit = UNIT_LABEL[l.unit];
              return (
                <section key={l.key} aria-label={`Item ${i + 1}`} className="space-y-3 rounded-2xl bg-surface p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Field label={`Item ${i + 1}`} htmlFor={`po-item-${l.key}`} error={errors[`item:${l.key}`]}>
                        <button type="button" onClick={() => setItemFor(l.key)} className={`${INPUT} flex items-center justify-between gap-2 text-left ${errors[`item:${l.key}`] ? INPUT_INVALID : ""}`}>
                          {l.item_id ? <span className="truncate font-semibold">{l.item_name}</span> : <span className="text-ink-2">Choose an item</span>}
                          <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
                        </button>
                      </Field>
                    </div>
                    {d.lines.length > 1 && <IconButton label={`Remove item ${i + 1}`} onClick={() => update({ lines: d.lines.filter((x) => x.key !== l.key) })} className="mt-6 bg-transparent text-ink-2"><Trash2 className="h-4 w-4" /></IconButton>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Quantity" htmlFor={`po-qty-${l.key}`} error={errors[`qty:${l.key}`]}><NumberInput value={l.quantity} onChange={(quantity) => setLine(l.key, { quantity })} suffix={unit?.[1]} /></Field>
                    <Field label={`Rate${unit ? ` per ${unit[0]}` : ""}`} htmlFor={`po-rate-${l.key}`} error={errors[`rate:${l.key}`]}><NumberInput value={l.rate} onChange={(rate) => setLine(l.key, { rate })} prefix="₹" /></Field>
                  </div>
                  {amount !== null && <p className="text-right text-sm text-ink-2">Amount <Money value={amount} className="font-semibold text-ink" /></p>}
                </section>
              );
            })}
            {errors.lines && <p role="alert" className="text-sm font-medium text-status-critical">{errors.lines}</p>}
            <Button variant="secondary" block onClick={() => update({ lines: [...d.lines, newPoLine()] })}><Plus className="h-4 w-4" aria-hidden="true" />Add another item</Button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-2">
            <ReviewBlock title="Supplier" onEdit={() => steps.go(0)}>
              <p className="font-semibold">{d.supplier?.name}</p>
              <p className="text-ink-2">Ordered {shortDate(d.order_date)}{d.expected_date ? ` · expected ${shortDate(d.expected_date)}` : ""}</p>
            </ReviewBlock>
            <ReviewBlock title="Items" onEdit={() => steps.go(1)}>
              <ul className="space-y-1">
                {filled.map((l) => (
                  <li key={l.key} className="flex justify-between gap-3"><span className="truncate">{l.item_name} · {qty(l.quantity.replace(/,/g, ""), l.unit)}</span><Money value={lineAmount(l) || 0} /></li>
                ))}
              </ul>
            </ReviewBlock>
          </div>
        )}
      </div>
      <StickyFooter>
        {create.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(create.error, "Couldn't create the purchase order. Try again.")}</p>}
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={back}>Back</Button>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-xs text-ink-2">{filled.length} item{filled.length === 1 ? "" : "s"}</p>
            <Money value={total} className="text-lg font-bold text-ink" />
          </div>
          {step < PO_STEPS.length - 1 ? <Button onClick={steps.next}>Next</Button> : <Button onClick={submit} loading={create.isPending}>Create order</Button>}
        </div>
      </StickyFooter>
      <SupplierPicker open={supplierOpen} onClose={() => setSupplierOpen(false)} onPick={(supplier) => { update({ supplier }); setSupplierOpen(false); }} />
      <ItemPicker open={Boolean(itemFor)} onClose={() => setItemFor(null)} onPick={(it) => { setLine(itemFor, { item_id: it.id, item_name: it.name, unit: it.unit }); setItemFor(null); }} />
      <ConfirmDialog open={confirmLeave} title="Leave without creating the order?" message="What you entered will be lost." confirmLabel="Leave" cancelLabel="Stay" onConfirm={leave} onClose={() => setConfirmLeave(false)} />
    </div>
  );
}
```

- [ ] **Step 6: Purchase order page**

`frontend/src/features/inventory/PurchaseOrderPage.jsx`:

```jsx
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ellipsis } from "lucide-react";
import { usePo, refreshStock } from "./api";
import { PO_STATUS, poActions, qty, qtyText } from "./labels";
import { purchaseOrderAPI } from "../../services/inventoryAPI";
import Tabs, { TabPanel } from "../../ui/Tabs";
import Tag from "../../ui/Tag";
import IconButton from "../../ui/IconButton";
import ActionSheet from "../../ui/ActionSheet";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import { shortDate } from "../../utils/dashboardFormat";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

const TABS = [{ value: "lines", label: "Items" }, { value: "receipts", label: "Deliveries" }, { value: "details", label: "Details" }];
const paise = (x) => Math.round(Number(x) * 100);

export default function PurchaseOrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const q = usePo(id);
  const [tab, setTab] = useState("lines");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // "cancel" | "delete"
  const act = useMutation({
    mutationFn: (kind) => (kind === "cancel" ? purchaseOrderAPI.cancel(id) : purchaseOrderAPI.delete(id)),
    onSuccess: (_, kind) => {
      refreshStock(qc);
      setConfirm(null);
      if (kind === "delete") { toast.success("Purchase order deleted"); navigate("/purchase-orders", { replace: true }); }
      else toast.success("Purchase order cancelled");
    },
    onError: (err) => { setConfirm(null); toast.error(errorText(err, "That didn't work. Try again.")); },
  });

  if (q.isPending) return <PageSkeleton />;
  if (q.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {q.error?.response?.status === 404
          ? <EmptyState title="This purchase order doesn't exist" body="It may have been deleted." action={<Link to="/purchase-orders" className={buttonClass({ variant: "secondary" })}>All purchase orders</Link>} />
          : <ErrorState title="Couldn't load this purchase order." onRetry={() => q.refetch()} />}
      </div>
    );
  }
  const po = q.data;
  const s = PO_STATUS[po.status] || { label: po.status, tone: "muted" };
  const can = poActions(po);
  const receipts = po.receipts || [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <section className="rounded-3xl bg-gradient-to-b from-raised to-surface p-4 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-ink">{po.po_number}</h1>
            <p className="truncate text-sm text-ink-2">{po.supplier ? <Link to={`/suppliers/${po.supplier.id}`} className="text-brass">{po.supplier.name}</Link> : "—"} · {shortDate(po.order_date)}</p>
          </div>
          <div className="flex items-center gap-1">
            <Tag label={s.label} tone={s.tone} />
            {(can.canCancel || can.canDelete) && <IconButton label="More purchase order actions" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>}
          </div>
        </div>
        <Money value={paise(po.total_amount) / 100} className="mt-3 block text-3xl font-bold text-ink" />
        {po.expected_date && <p className="text-sm text-ink-2">Expected {shortDate(po.expected_date)}</p>}
        {can.canReceive && <Link to={`/purchase-orders/${po.id}/receive`} className={`${buttonClass({ block: true })} mt-3`}>Receive material</Link>}
      </section>
      <div className="mt-4"><Tabs label="Purchase order" tabs={TABS} value={tab} onChange={setTab} /></div>
      <TabPanel value={tab}>
        {tab === "lines" && (
          <ul className="overflow-hidden rounded-2xl bg-surface">
            {po.items.map((l) => {
              const done = Number(l.quantity_received) >= Number(l.quantity_ordered);
              return (
                <li key={l.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{l.item?.name}</span>
                    <span className="block text-xs text-ink-2">{qty(l.quantity_ordered, l.item?.unit)} × <Money value={Number(l.rate)} /></span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`block font-num text-sm font-semibold tabular-nums ${done ? "text-status-good" : "text-ink"}`}>{qtyText(l.quantity_received)} received</span>
                    {!done && po.status !== "CANCELLED" && <span className="text-xs text-status-warn">{qty(l.quantity_pending, l.item?.unit)} to come</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {tab === "receipts" && (receipts.length === 0 ? <EmptyState title="Nothing received yet" /> : (
          <ul className="overflow-hidden rounded-2xl bg-surface">
            {receipts.map((r) => {
              const value = (r.items || []).reduce((sum, i) => sum + Math.round(Number(i.quantity_received) * Number(i.rate) * 100), 0) / 100;
              return (
                <li key={r.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{r.receipt_number} · {shortDate(r.receipt_date)}</span>
                    <span className="block truncate text-xs text-ink-2">{(r.items || []).length} item{(r.items || []).length === 1 ? "" : "s"}{r.supplier_bill_ref ? ` · Bill ${r.supplier_bill_ref}` : ""}</span>
                  </span>
                  <Money value={value} className="shrink-0 text-sm font-semibold text-ink" />
                </li>
              );
            })}
          </ul>
        ))}
        {tab === "details" && (
          <dl className="divide-y divide-line/60 overflow-hidden rounded-2xl bg-surface text-sm">
            {[["Supplier", po.supplier?.name || "—"], ["Phone", po.supplier?.phone || "—"], ["Ordered", shortDate(po.order_date)], ["Expected", po.expected_date ? shortDate(po.expected_date) : "—"], ["Notes", po.notes || "—"]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 px-4 py-3"><dt className="text-ink-2">{k}</dt><dd className="text-right font-medium text-ink">{v}</dd></div>
            ))}
          </dl>
        )}
      </TabPanel>
      <ActionSheet open={menuOpen} title={po.po_number} onClose={() => setMenuOpen(false)} actions={[
        can.canCancel && { label: "Cancel purchase order", tone: "danger", onSelect: () => setConfirm("cancel") },
        can.canDelete && { label: "Delete purchase order", tone: "danger", onSelect: () => setConfirm("delete") },
      ]} />
      <ConfirmDialog open={confirm === "cancel"} title="Cancel this purchase order?" message="It stays in the list as cancelled. Nothing can be received against it." confirmLabel="Cancel order" cancelLabel="Keep it" busy={act.isPending} onConfirm={() => act.mutate("cancel")} onClose={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === "delete"} title="Delete this purchase order?" message="It will be removed completely." confirmLabel="Delete order" cancelLabel="Keep it" busy={act.isPending} onConfirm={() => act.mutate("delete")} onClose={() => setConfirm(null)} />
    </div>
  );
}
```

- [ ] **Step 7: Receive page**

`frontend/src/features/inventory/ReceivePage.jsx`:

```jsx
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePo, refreshStock } from "./api";
import { poActions, qty, qtyText, UNIT_LABEL } from "./labels";
import { receiveLinesFromPo, receiveErrors, isOverReceipt, receiveTotal, toReceivePayload } from "./receiveForm";
import { purchaseOrderAPI } from "../../services/inventoryAPI";
import Field from "../../ui/Field";
import TextInput from "../../ui/TextInput";
import NumberInput from "../../ui/NumberInput";
import DateField from "../../ui/DateField";
import Button from "../../ui/Button";
import StickyFooter from "../../ui/StickyFooter";
import PageHeader from "../../ui/PageHeader";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { FORM_PAGE, INPUT, buttonClass } from "../../ui/styles";
import { todayIST } from "../../utils/istDate";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function ReceivePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const q = usePo(id);
  const initial = useMemo(() => (q.data ? { receipt_date: todayIST(), supplier_bill_ref: "", notes: "", lines: receiveLinesFromPo(q.data) } : null), [q.data]);
  const [edited, setEdited] = useState(null);
  const [shown, setShown] = useState(false);
  const save = useMutation({ mutationFn: (payload) => purchaseOrderAPI.receive(id, payload), onSuccess: () => refreshStock(qc) });

  if (q.isPending) return <PageSkeleton />;
  if (q.isError) return <div className="mx-auto max-w-xl px-4 py-6"><ErrorState title="Couldn't load this purchase order." onRetry={() => q.refetch()} /></div>;
  const po = q.data;
  const toPo = () => navigate(`/purchase-orders/${id}`, { replace: true });
  if (!poActions(po).canReceive) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        <EmptyState title={po.status === "CANCELLED" ? "This order is cancelled" : "Everything has been received"} body="Nothing more can be received against it."
          action={<Link to={`/purchase-orders/${id}`} className={buttonClass({ variant: "secondary" })}>Back to {po.po_number}</Link>} />
      </div>
    );
  }
  const f = edited ?? initial;
  const set = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));
  const setLine = (lid, patch) => set({ lines: f.lines.map((l) => (l.id === lid ? { ...l, ...patch } : l)) });
  const errors = shown ? receiveErrors(f) : {};
  const total = receiveTotal(f);

  const submit = (e) => {
    e.preventDefault();
    if (Object.keys(receiveErrors(f)).length) {
      setShown(true);
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"], [role="alert"]')?.scrollIntoView({ block: "center" }));
      return;
    }
    save.mutate(toReceivePayload(f), { onSuccess: () => { toast.success("Material received — stock updated"); toPo(); } });
  };

  return (
    <form onSubmit={submit} noValidate className={`${FORM_PAGE} pt-4`}>
      <PageHeader title="Receive material" subtitle={`${po.po_number} · ${po.supplier?.name || ""}`} />
      <div className="space-y-5 pb-6 sm:mt-4">
        <Field label="Arrived on" htmlFor="rc-date" error={errors.receipt_date}><DateField value={f.receipt_date} onChange={(receipt_date) => set({ receipt_date })} /></Field>
        <Field label="Supplier's bill number" htmlFor="rc-ref" optional><TextInput value={f.supplier_bill_ref} onChange={(e) => set({ supplier_bill_ref: e.target.value })} /></Field>
        <div className="space-y-3">
          <p className="text-[0.8rem] font-semibold text-ink-2">What arrived — leave a line blank if it didn't come</p>
          {f.lines.map((l) => {
            const unit = UNIT_LABEL[l.unit];
            return (
              <section key={l.id} aria-label={l.name} className="space-y-3 rounded-2xl bg-surface p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="truncate text-sm font-semibold text-ink">{l.name}</h2>
                  <span className="shrink-0 text-xs text-ink-2">{qtyText(l.received)} of {qty(l.ordered, l.unit)} received</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quantity" htmlFor={`rc-q-${l.id}`} error={errors[`qty:${l.id}`]}><NumberInput value={l.quantity} onChange={(quantity) => setLine(l.id, { quantity })} suffix={unit?.[1]} placeholder="0" /></Field>
                  <Field label={`Rate${unit ? ` per ${unit[0]}` : ""}`} htmlFor={`rc-r-${l.id}`} error={errors[`rate:${l.id}`]}><NumberInput value={l.rate} onChange={(rate) => setLine(l.id, { rate })} prefix="₹" /></Field>
                </div>
                {isOverReceipt(l) && <p className="text-xs font-medium text-status-warn">More than the {qty(l.pending, l.unit)} still to come — the extra will be recorded.</p>}
              </section>
            );
          })}
          {errors.lines && <p role="alert" className="text-sm font-medium text-status-critical">{errors.lines}</p>}
        </div>
        <Field label="Notes" htmlFor="rc-notes" optional><textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} className={`${INPUT} h-auto py-2`} /></Field>
      </div>
      <StickyFooter>
        {save.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(save.error, "Couldn't save. Check your connection and try again.")}</p>}
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={toPo}>Back</Button>
          <div className="min-w-0 flex-1 text-right"><p className="text-xs text-ink-2">Value</p><Money value={total} className="text-lg font-bold text-ink" /></div>
          <Button type="submit" loading={save.isPending}>Save</Button>
        </div>
      </StickyFooter>
    </form>
  );
}
```

- [ ] **Step 8: Routes and titles**

`routeMeta.test.js` add:

```js
    ["/purchase-orders", { title: "Purchase orders", back: null, hideNav: false }],
    ["/purchase-orders/new", { title: "New purchase order", back: null, hideNav: true }],
    ["/purchase-orders/p1", { title: "Purchase order", back: "/purchase-orders", hideNav: false }],
    ["/purchase-orders/p1/receive", { title: "Receive material", back: null, hideNav: true }],
```

Run → FAIL. In `routeMeta.js` replace the two `purchase-orders` entries with:

```js
  [/^\/purchase-orders\/new$/, { title: "New purchase order", hideNav: true }],
  [/^\/purchase-orders\/[^/]+\/receive$/, { title: "Receive material", hideNav: true }],
  [/^\/purchase-orders\/[^/]+$/, { title: "Purchase order", back: "/purchase-orders" }],
  [/^\/purchase-orders/, { title: "Purchase orders" }],
```

`App.jsx`: replace the four purchase-order lazy imports with `PurchaseOrdersPage`, `NewPurchaseOrderPage`, `PurchaseOrderPage`, `ReceivePage` (from `./features/inventory/…`) and their four routes' elements accordingly (paths unchanged).

Run: `cd frontend && npx vitest run 2>&1 | grep -E "^ +Tests" && npx eslint src/features/inventory src/App.jsx src/app` → Expected: pass; clean.

Visual check: create a PO in 3 steps (Back keeps everything); PO page tabs; receive 60 of 100 → status Part received, stock rises; over-receipt warning; cancel/delete only offered before anything is received.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/inventory frontend/src/App.jsx frontend/src/app/routeMeta.js frontend/src/app/routeMeta.test.js
git commit -m "feat(purchasing): purchase orders list, 3-step new order, order page, receive page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 8: Stock issues — list and new issue

**Files:**
- Create: `frontend/src/features/inventory/issueForm.js`, `issueForm.test.js`, `OrderPicker.jsx`, `StockIssuesPage.jsx`, `NewStockIssuePage.jsx`
- Modify: `frontend/src/App.jsx`, `frontend/src/app/routeMeta.js`, `frontend/src/app/routeMeta.test.js`

**Interfaces:**
- Consumes: `ItemPicker withStock` (Task 7), `recentItems` (Task 7), `useOrderList` (`features/orders/api`), `ISSUE_TYPES` (Task 5).
- Produces: `newIssueLine(item?)`, `emptyIssue(today, item?)`, `isAdjustment(type)`, `takesOrder(type)`, `issueErrors(form)` (`issue_date`, `reason`, `lines`, `item:<key>`, `qty:<key>`, `waste:<key>`), `shortfalls(form) → { [key]: shortBy }`, `toIssuePayload(form)`.

- [ ] **Step 1: Failing test**

`frontend/src/features/inventory/issueForm.test.js`:

```js
import { describe, expect, test } from "vitest";
import { emptyIssue, newIssueLine, issueErrors, shortfalls, toIssuePayload } from "./issueForm";

const pp = { id: "i1", name: "PP", unit: "KG", in_stock: 100 };
const form = (o, line = {}) => ({ ...emptyIssue("2026-09-30"), lines: [{ ...newIssueLine(pp), key: "a", quantity: "50", ...line }], ...o });

describe("stock issue form", () => {
  test("an issue needs at least one item with a quantity", () => {
    expect(issueErrors(emptyIssue("2026-09-30"))).toEqual({ lines: "Add at least one item" });
    expect(issueErrors(form())).toEqual({});
    expect(issueErrors(form({}, { quantity: "" }))).toEqual({ "qty:a": "Enter the quantity" });
    expect(issueErrors(form({}, { quantity: "1.2345" }))).toEqual({ "qty:a": "Use at most 3 decimals" });
    expect(issueErrors(form({}, { wastage: "-1" }))).toEqual({ "waste:a": "Enter a number" });
  });
  test("adjustments need a reason", () => {
    expect(issueErrors(form({ issue_type: "ADJUSTMENT_OUT" }))).toEqual({ reason: "Say why the count changed" });
    expect(issueErrors(form({ issue_type: "ADJUSTMENT_IN", reason: "Stock count" }))).toEqual({});
  });
  test("shortfall counts wastage and the same item on two lines; adding stock never falls short", () => {
    expect(shortfalls(form({}, { quantity: "90", wastage: "20" }))).toEqual({ a: 10 });
    const two = form();
    two.lines.push({ ...newIssueLine(pp), key: "b", quantity: "60" });
    expect(shortfalls(two)).toEqual({ b: 10 });
    expect(shortfalls(form({ issue_type: "ADJUSTMENT_IN" }, { quantity: "500" }))).toEqual({});
    expect(shortfalls(form({ issue_type: "WASTAGE" }, { quantity: "90", wastage: "20" }))).toEqual({});
  });
  test("payload: wastage only on issues; order only on issue or wastage", () => {
    expect(toIssuePayload(form({ order: { id: "o1" }, notes: " " }, { wastage: "2.5" }))).toEqual({
      issue_date: "2026-09-30", issue_type: "ISSUE", order_id: "o1", reason: null, notes: null, items: [{ item_id: "i1", quantity: 50, wastage_quantity: 2.5 }],
    });
    expect(toIssuePayload(form({ issue_type: "ADJUSTMENT_IN", reason: " Count ", order: { id: "o1" } }, { wastage: "2" }))).toMatchObject({
      order_id: null, reason: "Count", items: [{ item_id: "i1", quantity: 50, wastage_quantity: 0 }],
    });
  });
});
```

Run: `cd frontend && npx vitest run src/features/inventory/issueForm.test.js` → Expected: FAIL.

- [ ] **Step 2: Implement**

`frontend/src/features/inventory/issueForm.js`:

```js
import { parseNumber } from "../../utils/numberInput";
import { isISODate } from "../../utils/istDate";
import { QTY_DP } from "./labels";

export const isAdjustment = (t) => t === "ADJUSTMENT_IN" || t === "ADJUSTMENT_OUT";
export const takesOrder = (t) => t === "ISSUE" || t === "WASTAGE";

let seq = 0;
export const newIssueLine = (item) => ({
  key: `s${Date.now()}-${(seq += 1)}`, item_id: item?.id || "", item_name: item?.name || "", unit: item?.unit || "", in_stock: item?.in_stock, quantity: "", wastage: "",
});
export const emptyIssue = (today, item) => ({ issue_type: "ISSUE", issue_date: today, order: null, reason: "", notes: "", lines: [newIssueLine(item)] });

const q = (t) => parseNumber(t, { dp: QTY_DP });
const w = (t) => parseNumber(t, { dp: QTY_DP, allowZero: true });
const used = (f) => f.lines.filter((l) => l.item_id || String(l.quantity).trim() || String(l.wastage).trim());

export const issueErrors = (f) => {
  const e = {};
  if (!isISODate(f.issue_date)) e.issue_date = "Choose the date";
  if (isAdjustment(f.issue_type) && !f.reason.trim()) e.reason = "Say why the count changed";
  const lines = used(f);
  if (!lines.length) e.lines = "Add at least one item";
  for (const l of lines) {
    if (!l.item_id) e[`item:${l.key}`] = "Choose an item";
    const qty = q(l.quantity);
    if (qty.error || qty.value === null) e[`qty:${l.key}`] = qty.error || "Enter the quantity";
    if (f.issue_type === "ISSUE" && w(l.wastage).error) e[`waste:${l.key}`] = w(l.wastage).error;
  }
  return e;
};

/** How much each line is short by, counting earlier lines of the same item. Adding stock is never short. */
export const shortfalls = (f) => {
  if (f.issue_type === "ADJUSTMENT_IN") return {};
  const drawn = {};
  const out = {};
  for (const l of used(f)) {
    if (!l.item_id || l.in_stock === undefined || l.in_stock === null) continue;
    const need = (q(l.quantity).value || 0) + (f.issue_type === "ISSUE" ? w(l.wastage).value || 0 : 0);
    drawn[l.item_id] = Math.round(((drawn[l.item_id] || 0) + need) * 1000) / 1000;
    const short = Math.round((drawn[l.item_id] - Number(l.in_stock)) * 1000) / 1000;
    if (short > 0) out[l.key] = short;
  }
  return out;
};

export const toIssuePayload = (f) => ({
  issue_date: f.issue_date,
  issue_type: f.issue_type,
  order_id: takesOrder(f.issue_type) && f.order ? f.order.id : null,
  reason: f.reason.trim() || null,
  notes: f.notes.trim() || null,
  items: used(f).map((l) => ({ item_id: l.item_id, quantity: q(l.quantity).value, wastage_quantity: f.issue_type === "ISSUE" ? w(l.wastage).value || 0 : 0 })),
});
```

Run: `cd frontend && npx vitest run src/features/inventory` → Expected: PASS.

- [ ] **Step 3: Order picker**

`frontend/src/features/inventory/OrderPicker.jsx`:

```jsx
import { useState } from "react";
import PropTypes from "prop-types";
import SearchPicker from "../../ui/SearchPicker";
import { useOrderList } from "../orders/api";
import useDebounced from "../../ui/useDebounced";
import { itemsText } from "../../utils/itemsText";
import { shortDate } from "../../utils/dashboardFormat";

/** Which customer order the material was used for (optional). */
export default function OrderPicker({ open, onClose, onPick }) {
  const [query, setQuery] = useState("");
  const term = useDebounced(query.trim());
  const list = useOrderList({ chip: "all", search: term || undefined });
  const rows = (list.data?.pages?.[0]?.rows || []).filter((o) => !o.cancelled);
  return (
    <SearchPicker open={open} title="Choose order" query={query} onQuery={setQuery} placeholder="Search customer or size"
      loading={list.isPending} error={list.isError ? "Couldn't load orders." : undefined}
      items={rows} getKey={(o) => o.id} onClose={onClose}
      onPick={(o) => { onPick({ id: o.id, label: `${o.customer.name} · ${shortDate(o.orderDate)}` }); setQuery(""); }}
      empty={term ? `No order matches “${term}”` : "No orders yet"}
      renderItem={(o) => (
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{o.customer.name}</span>
          <span className="block truncate text-xs text-ink-2">{shortDate(o.orderDate)} · {itemsText(o.items)}</span>
        </span>
      )} />
  );
}

OrderPicker.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onPick: PropTypes.func.isRequired };
```

- [ ] **Step 4: Stock issues list**

`frontend/src/features/inventory/StockIssuesPage.jsx`:

```jsx
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useIssueList, rowsOf } from "./api";
import { ISSUE_TYPES, ISSUE_TYPE_OPTIONS } from "./labels";
import PageHeader from "../../ui/PageHeader";
import TextInput from "../../ui/TextInput";
import Chips from "../../ui/Chips";
import Tag from "../../ui/Tag";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { groupByDay } from "../../utils/dayGroups";
import { todayIST } from "../../utils/istDate";

const CHIPS = [{ value: "", label: "All" }, ...ISSUE_TYPE_OPTIONS];
const itemsLine = (s) => {
  const names = (s.items || []).map((i) => i.item?.name).filter(Boolean);
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2} more` : names.join(", ");
};

export default function StockIssuesPage() {
  const [params, setParams] = useSearchParams();
  const type = params.get("type") || "";
  const search = params.get("q") || "";
  const term = useDebounced(search.trim());
  const today = todayIST();
  const query = useMemo(() => ({ ...(term ? { search: term } : {}), ...(type ? { issue_type: type } : {}) }), [term, type]);
  const list = useIssueList(query);
  const sentinel = useInfiniteSentinel(list);
  const rows = rowsOf(list);
  const groups = useMemo(() => groupByDay(rows, today, (s) => s.issue_date), [rows, today]);
  const setParam = (key, value) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (value) next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Stock issues" subtitle="Material used, wasted or corrected" actions={<Link to="/stock-issues/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>} />
      <div className="mt-3 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setParam("q", e.target.value)} placeholder="Search issue number" aria-label="Search stock issues" enterKeyHint="search" />
        <Chips label="Type" options={CHIPS} value={type} onChange={(v) => setParam("type", v)} />
      </div>
      <div className={`mt-4 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? <ListSkeleton /> : list.isError && rows.length === 0 ? <ErrorState title="Couldn't load stock issues." onRetry={() => list.refetch()} /> : rows.length === 0 ? (
          <EmptyState title="Nothing here yet" body={term || type ? "Try another search or type." : "Record material taken from stock for production, wastage or a count correction."}
            action={<Link to="/stock-issues/new" className={buttonClass()}>Issue stock</Link>} />
        ) : (
          <>
            {groups.map((g) => (
              <section key={g.date} aria-labelledby={`si-${g.date}`} className="mb-3">
                <h2 id={`si-${g.date}`} className="sticky top-0 z-[1] bg-canvas/95 px-1 py-2 text-xs font-semibold text-ink-2 backdrop-blur">{g.label}</h2>
                <ul className="overflow-hidden rounded-2xl bg-surface">
                  {g.rows.map((s) => {
                    const t = ISSUE_TYPES[s.issue_type] || { label: s.issue_type, tone: "muted" };
                    const cost = Math.round((Number(s.total_cost) + Number(s.total_wastage_cost || 0)) * 100) / 100;
                    return (
                      <li key={s.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0">
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2"><span className="text-sm font-semibold text-ink">{s.issue_number}</span><Tag label={t.label} tone={t.tone} /></span>
                          <span className="block truncate text-xs text-ink-2">{itemsLine(s) || `${(s.items || []).length} items`}</span>
                          {s.order && <Link to={`/orders/${s.order_id || s.order.id}`} className="block truncate text-xs font-semibold text-brass">For {s.order.customer?.name || "an order"}</Link>}
                          {s.reason && <span className="block truncate text-xs text-ink-2">{s.reason}</span>}
                        </span>
                        <Money value={cost} className="shrink-0 text-sm font-semibold text-ink" />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <div ref={sentinel} className="py-3 text-center text-xs text-ink-2">{list.isFetchingNextPage ? "Loading more…" : ""}</div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: New stock issue**

`frontend/src/features/inventory/NewStockIssuePage.jsx`:

```jsx
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, Plus, X } from "lucide-react";
import { useItemStock, refreshStock } from "./api";
import { ISSUE_TYPES, ISSUE_TYPE_OPTIONS, qty, UNIT_LABEL } from "./labels";
import { emptyIssue, newIssueLine, isAdjustment, takesOrder, issueErrors, shortfalls, toIssuePayload } from "./issueForm";
import { rememberItems } from "./recentItems";
import ItemPicker from "./ItemPicker";
import OrderPicker from "./OrderPicker";
import { stockIssueAPI } from "../../services/inventoryAPI";
import Field from "../../ui/Field";
import TextInput from "../../ui/TextInput";
import NumberInput from "../../ui/NumberInput";
import DateField from "../../ui/DateField";
import Chips from "../../ui/Chips";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import StickyFooter from "../../ui/StickyFooter";
import PageHeader from "../../ui/PageHeader";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { FORM_PAGE, INPUT, INPUT_INVALID } from "../../ui/styles";
import { todayIST } from "../../utils/istDate";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function NewStockIssuePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const preset = useItemStock(params.get("item"));
  const initial = useMemo(() => emptyIssue(todayIST(), preset.data ? { ...preset.data.item, in_stock: Number(preset.data.in_stock) } : undefined), [preset.data]);
  const [edited, setEdited] = useState(null);
  const [shown, setShown] = useState(false);
  const [itemFor, setItemFor] = useState(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const save = useMutation({ mutationFn: (payload) => stockIssueAPI.create(payload).then((r) => r.data.data), onSuccess: () => refreshStock(qc) });

  const f = edited ?? initial;
  const set = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));
  const setLine = (key, patch) => set({ lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });
  const errors = shown ? issueErrors(f) : {};
  const short = shortfalls(f);
  const type = ISSUE_TYPES[f.issue_type];
  const leave = () => navigate("/stock-issues", { replace: true });

  const submit = (e) => {
    e.preventDefault();
    if (Object.keys(issueErrors(f)).length) {
      setShown(true);
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"], [role="alert"]')?.scrollIntoView({ block: "center" }));
      return;
    }
    const payload = toIssuePayload(f);
    save.mutate(payload, {
      onSuccess: (issue) => {
        rememberItems(payload.items.map((i) => i.item_id));
        toast.success(`${issue.issue_number || "Stock issue"} saved — stock updated`);
        leave();
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate className={`${FORM_PAGE} pt-4`}>
      <PageHeader title="Issue stock" />
      <div className="space-y-5 pb-6 sm:mt-4">
        <div>
          <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">What happened</p>
          <Chips label="Type" options={ISSUE_TYPE_OPTIONS} value={f.issue_type} onChange={(issue_type) => set({ issue_type })} />
          <p className="mt-1.5 text-xs text-ink-2">{type.hint}</p>
        </div>
        <Field label="Date" htmlFor="si-date" error={errors.issue_date}><DateField value={f.issue_date} onChange={(issue_date) => set({ issue_date })} /></Field>
        {takesOrder(f.issue_type) && (
          <Field label="For order" htmlFor="si-order" optional>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOrderOpen(true)} className={`${INPUT} flex flex-1 items-center justify-between gap-2 text-left`}>
                {f.order ? <span className="truncate font-semibold">{f.order.label}</span> : <span className="text-ink-2">Choose an order</span>}
                <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
              </button>
              {f.order && <IconButton label="Clear order" onClick={() => set({ order: null })}><X className="h-4 w-4" /></IconButton>}
            </div>
          </Field>
        )}
        <div className="space-y-3">
          {f.lines.map((l, i) => {
            const unit = UNIT_LABEL[l.unit];
            return (
              <section key={l.key} aria-label={`Item ${i + 1}`} className="space-y-3 rounded-2xl bg-surface p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Field label={`Item ${i + 1}`} htmlFor={`si-item-${l.key}`} error={errors[`item:${l.key}`]} hint={l.item_id && l.in_stock !== undefined ? `In stock: ${qty(l.in_stock, l.unit)}` : undefined}>
                      <button type="button" onClick={() => setItemFor(l.key)} className={`${INPUT} flex items-center justify-between gap-2 text-left ${errors[`item:${l.key}`] ? INPUT_INVALID : ""}`}>
                        {l.item_id ? <span className="truncate font-semibold">{l.item_name}</span> : <span className="text-ink-2">Choose an item</span>}
                        <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
                      </button>
                    </Field>
                  </div>
                  {f.lines.length > 1 && <IconButton label={`Remove item ${i + 1}`} onClick={() => set({ lines: f.lines.filter((x) => x.key !== l.key) })} className="mt-6 bg-transparent text-ink-2"><Trash2 className="h-4 w-4" /></IconButton>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={f.issue_type === "WASTAGE" ? "Wasted" : "Quantity"} htmlFor={`si-q-${l.key}`} error={errors[`qty:${l.key}`]}>
                    <NumberInput value={l.quantity} onChange={(quantity) => setLine(l.key, { quantity })} suffix={unit?.[1]} />
                  </Field>
                  {f.issue_type === "ISSUE" && (
                    <Field label="Wasted too" htmlFor={`si-w-${l.key}`} optional error={errors[`waste:${l.key}`]}>
                      <NumberInput value={l.wastage} onChange={(wastage) => setLine(l.key, { wastage })} suffix={unit?.[1]} placeholder="0" />
                    </Field>
                  )}
                </div>
                {short[l.key] > 0 && <p className="text-xs font-medium text-status-critical">Only {qty(l.in_stock, l.unit)} in stock — {qty(short[l.key], l.unit)} short. It won't save until stock is received.</p>}
              </section>
            );
          })}
          {errors.lines && <p role="alert" className="text-sm font-medium text-status-critical">{errors.lines}</p>}
          <Button variant="secondary" block onClick={() => set({ lines: [...f.lines, newIssueLine()] })}><Plus className="h-4 w-4" aria-hidden="true" />Add another item</Button>
        </div>
        <Field label="Reason" htmlFor="si-reason" optional={!isAdjustment(f.issue_type)} error={errors.reason}>
          <TextInput value={f.reason} onChange={(e) => set({ reason: e.target.value })} placeholder={isAdjustment(f.issue_type) ? "e.g. Monthly stock count" : ""} />
        </Field>
        <Field label="Notes" htmlFor="si-notes" optional><textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} className={`${INPUT} h-auto py-2`} /></Field>
      </div>
      <StickyFooter>
        {save.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(save.error, "Couldn't save. Check your connection and try again.")}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={() => (edited ? setConfirmLeave(true) : leave())}>Cancel</Button>
          <Button type="submit" block size="lg" loading={save.isPending}>Save</Button>
        </div>
      </StickyFooter>
      <ItemPicker withStock open={Boolean(itemFor)} onClose={() => setItemFor(null)}
        onPick={(it) => { setLine(itemFor, { item_id: it.id, item_name: it.name, unit: it.unit, in_stock: it.in_stock }); setItemFor(null); }} />
      <OrderPicker open={orderOpen} onClose={() => setOrderOpen(false)} onPick={(order) => { set({ order }); setOrderOpen(false); }} />
      <ConfirmDialog open={confirmLeave} title="Leave without saving?" message="What you entered will be lost." confirmLabel="Leave" cancelLabel="Stay" onConfirm={leave} onClose={() => setConfirmLeave(false)} />
    </form>
  );
}
```

- [ ] **Step 6: Routes and titles**

`routeMeta.test.js` add:

```js
    ["/stock-issues", { title: "Stock issues", back: null, hideNav: false }],
    ["/stock-issues/new", { title: "Issue stock", back: null, hideNav: true }],
```

Run → FAIL. In `routeMeta.js` replace the two `stock-issues` entries with:

```js
  [/^\/stock-issues\/new$/, { title: "Issue stock", hideNav: true }],
  [/^\/stock-issues/, { title: "Stock issues" }],
```

`App.jsx`: replace `StockIssues` / `CreateStockIssue` lazy imports and route elements with `StockIssuesPage` / `NewStockIssuePage` from `./features/inventory/…`.

Run: `cd frontend && npx vitest run 2>&1 | grep -E "^ +Tests" && npx eslint src/features/inventory src/App.jsx src/app` → Expected: pass; clean.

Visual check: issue 10 kg for an order → stock falls by 10, list shows it under Today with the order link; asking for more than in stock shows the short warning and the server's "Insufficient stock" on save; adjustment without reason is stopped.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/inventory frontend/src/App.jsx frontend/src/app/routeMeta.js frontend/src/app/routeMeta.test.js
git commit -m "feat(stock): stock issues by day; one-page issue form with stock on hand and shortfall warning

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Suppliers — directory, supplier page, form

**Files:**
- Create: `frontend/src/features/inventory/supplierForm.js`, `supplierForm.test.js`, `SuppliersPage.jsx`, `SupplierPage.jsx`, `SupplierFormPage.jsx`
- Modify: `frontend/src/App.jsx`, `frontend/src/app/routeMeta.js`, `frontend/src/app/routeMeta.test.js`, `backend/knowledge/inventory.md`

**Interfaces:**
- Produces: `emptySupplier()`, `formFromSupplier(s)`, `validateSupplier(form, saved?)`, `toSupplierPayload(form)`.

- [ ] **Step 1: Failing test**

`frontend/src/features/inventory/supplierForm.test.js`:

```js
import { describe, expect, test } from "vitest";
import { emptySupplier, formFromSupplier, validateSupplier, toSupplierPayload } from "./supplierForm";

describe("supplier form", () => {
  test("name required; email and GSTIN checked when typed", () => {
    expect(validateSupplier(emptySupplier())).toEqual({ name: "Enter the supplier name" });
    expect(validateSupplier({ ...emptySupplier(), name: "Raj", email: "raj@", gst_number: "123" }))
      .toEqual({ email: "That email doesn't look right", gst_number: "GSTIN should be 15 characters, like 29ABCDE1234F1Z5" });
  });
  test("a GSTIN already saved is not re-checked (old records still save)", () => {
    const saved = { name: "Raj", gst_number: "OLD-FORMAT" };
    expect(validateSupplier({ ...formFromSupplier(saved) }, saved)).toEqual({});
  });
  test("payload: mobile as 10 digits, blanks as null, GSTIN upper-case", () => {
    expect(toSupplierPayload({ name: " Raj Traders ", phone: "+91 98450 12345", email: "", gst_number: "29abcde1234f1z5", address: " " }))
      .toEqual({ name: "Raj Traders", phone: "9845012345", email: null, gst_number: "29ABCDE1234F1Z5", address: null });
    expect(toSupplierPayload({ ...emptySupplier(), name: "A", phone: "080-2345678" }).phone).toBe("080-2345678");
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement**

`frontend/src/features/inventory/supplierForm.js`:

```js
import { mobileDigits, mobileStatus } from "../../utils/phone";
import { cleanName } from "../../ui/nameList";

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const emptySupplier = () => ({ name: "", phone: "", email: "", gst_number: "", address: "" });
export const formFromSupplier = (s) => ({ name: s.name || "", phone: s.phone || "", email: s.email || "", gst_number: s.gst_number || "", address: s.address || "" });

export const validateSupplier = (f, saved = {}) => {
  const e = {};
  if (!cleanName(f.name)) e.name = "Enter the supplier name";
  if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "That email doesn't look right";
  const gst = f.gst_number.trim().toUpperCase();
  if (gst && gst !== (saved.gst_number || "").toUpperCase() && !GSTIN.test(gst)) e.gst_number = "GSTIN should be 15 characters, like 29ABCDE1234F1Z5";
  return e;
};

export const toSupplierPayload = (f) => ({
  name: cleanName(f.name),
  phone: mobileStatus(f.phone) === "valid" ? mobileDigits(f.phone) : f.phone.trim() || null,
  email: f.email.trim() || null,
  gst_number: f.gst_number.trim().toUpperCase() || null,
  address: f.address.trim() || null,
});
```

Run → PASS.

- [ ] **Step 3: Pages**

`frontend/src/features/inventory/SuppliersPage.jsx`:

```jsx
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, ChevronRight } from "lucide-react";
import { useSupplierList, rowsOf } from "./api";
import PageHeader from "../../ui/PageHeader";
import TextInput from "../../ui/TextInput";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { initials } from "../../utils/alphaIndex";

export default function SuppliersPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") || "";
  const term = useDebounced(search.trim());
  const query = useMemo(() => (term ? { search: term } : {}), [term]);
  const list = useSupplierList(query);
  const sentinel = useInfiniteSentinel(list);
  const rows = rowsOf(list);
  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Suppliers" actions={<Link to="/suppliers/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>} />
      <div className="mt-3"><TextInput type="search" value={search} onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })} placeholder="Search name or phone" aria-label="Search suppliers" enterKeyHint="search" /></div>
      <div className={`mt-4 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? <ListSkeleton /> : list.isError && rows.length === 0 ? <ErrorState title="Couldn't load suppliers." onRetry={() => list.refetch()} /> : rows.length === 0 ? (
          <EmptyState title={term ? "No supplier matches" : "No suppliers yet"} body={term ? "Try another name." : "Add who you buy material from."} action={<Link to="/suppliers/new" className={buttonClass()}>Add a supplier</Link>} />
        ) : (
          <>
            <ul className="overflow-hidden rounded-2xl bg-surface">
              {rows.map((s) => (
                <li key={s.id} className="border-b border-line/60 last:border-0">
                  <Link to={`/suppliers/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-raised text-xs font-bold text-brass" aria-hidden="true">{initials(s.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{s.name}</span>
                      <span className="block truncate text-xs text-ink-2">{s.phone || "No phone"}{s.gst_number ? ` · GST ${s.gst_number}` : ""}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <div ref={sentinel} className="py-3 text-center text-xs text-ink-2">{list.isFetchingNextPage ? "Loading more…" : ""}</div>
          </>
        )}
      </div>
    </div>
  );
}
```

`frontend/src/features/inventory/SupplierPage.jsx`:

```jsx
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone, MessageCircle, Ellipsis } from "lucide-react";
import { useSupplier, refreshStock } from "./api";
import { PO_STATUS } from "./labels";
import { supplierAPI } from "../../services/inventoryAPI";
import Tabs, { TabPanel } from "../../ui/Tabs";
import Tag from "../../ui/Tag";
import IconButton from "../../ui/IconButton";
import ActionSheet from "../../ui/ActionSheet";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import { telHref, whatsappHref } from "../../utils/phone";
import { shortDate } from "../../utils/dashboardFormat";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

const TABS = [{ value: "pos", label: "Purchase orders" }, { value: "details", label: "Details" }];
const poTotal = (po) => po.total_amount !== undefined
  ? Math.round(Number(po.total_amount) * 100) / 100
  : (po.items || []).reduce((s, l) => s + Math.round(Number(l.quantity_ordered) * Number(l.rate) * 100), 0) / 100;

export default function SupplierPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useSupplier(id);
  const [tab, setTab] = useState("pos");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useMutation({
    mutationFn: () => supplierAPI.delete(id),
    onSuccess: () => { refreshStock(qc); toast.success("Supplier deleted"); navigate("/suppliers", { replace: true }); },
    onError: (err) => { setConfirmDelete(false); toast.error(errorText(err, "Couldn't delete. Try again.")); },
  });

  if (q.isPending) return <PageSkeleton />;
  if (q.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {q.error?.response?.status === 404
          ? <EmptyState title="This supplier doesn't exist" body="It may have been deleted." action={<Link to="/suppliers" className={buttonClass({ variant: "secondary" })}>All suppliers</Link>} />
          : <ErrorState title="Couldn't load this supplier." onRetry={() => q.refetch()} />}
      </div>
    );
  }
  const s = q.data;
  const pos = s.purchaseOrders || [];
  const tel = telHref(s.phone);
  const wa = whatsappHref(s.phone, "");

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <section className="rounded-3xl bg-gradient-to-b from-raised to-surface p-4 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-ink">{s.name}</h1>
            <p className="truncate text-sm text-ink-2">{s.phone || "No phone"}</p>
          </div>
          <IconButton label="More supplier actions" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tel && <a href={tel} className={buttonClass({ size: "sm", variant: "secondary" })}><Phone className="h-4 w-4" aria-hidden="true" />Call</a>}
          {wa && <a href={wa} target="_blank" rel="noreferrer" className={buttonClass({ size: "sm", variant: "secondary" })}><MessageCircle className="h-4 w-4" aria-hidden="true" />WhatsApp</a>}
          <Link to={`/purchase-orders/new?supplier=${s.id}`} className={buttonClass({ size: "sm" })}>New purchase order</Link>
        </div>
      </section>
      <div className="mt-4"><Tabs label="Supplier" tabs={TABS} value={tab} onChange={setTab} /></div>
      <TabPanel value={tab}>
        {tab === "pos" && (pos.length === 0 ? <EmptyState title="No purchase orders yet" /> : (
          <ul className="overflow-hidden rounded-2xl bg-surface">
            {pos.map((po) => {
              const st = PO_STATUS[po.status] || { label: po.status, tone: "muted" };
              return (
                <li key={po.id} className="border-b border-line/60 last:border-0">
                  <Link to={`/purchase-orders/${po.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60">
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{po.po_number}</span><span className="block text-xs text-ink-2">{shortDate(po.order_date)}</span></span>
                    <span className="flex shrink-0 flex-col items-end gap-1"><Money value={poTotal(po)} className="text-sm font-semibold text-ink" /><Tag label={st.label} tone={st.tone} /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
        {tab === "details" && (
          <dl className="divide-y divide-line/60 overflow-hidden rounded-2xl bg-surface text-sm">
            {[["Phone", s.phone || "—"], ["Email", s.email || "—"], ["GSTIN", s.gst_number || "—"], ["Address", s.address || "—"]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 px-4 py-3"><dt className="text-ink-2">{k}</dt><dd className="break-words text-right font-medium text-ink">{v}</dd></div>
            ))}
          </dl>
        )}
      </TabPanel>
      <ActionSheet open={menuOpen} title={s.name} onClose={() => setMenuOpen(false)} actions={[
        { label: "Edit supplier", onSelect: () => navigate(`/suppliers/edit/${s.id}`) },
        { label: "Delete supplier", tone: "danger", onSelect: () => setConfirmDelete(true) },
      ]} />
      <ConfirmDialog open={confirmDelete} title={`Delete ${s.name}?`} message="A supplier with purchase orders can't be deleted — you'll see why." confirmLabel="Delete supplier" cancelLabel="Keep it"
        busy={remove.isPending} onConfirm={() => remove.mutate()} onClose={() => setConfirmDelete(false)} />
    </div>
  );
}
```

The supplier page's "New purchase order" passes `?supplier=`: in `NewPurchaseOrderPage` (Task 7) read it too — `const presetSupplierId = params.get("supplier"); const suppliers = useSuppliersPicker();` and build `initial` as `{ ...emptyPo(todayIST(), presetItem), supplier: found ? { id: found.id, name: found.name } : null }` where `found = (suppliers.data || []).find((s) => s.id === presetSupplierId)`, adding `suppliers.data` to the memo deps.

`frontend/src/features/inventory/SupplierFormPage.jsx`:

```jsx
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupplier, refreshStock } from "./api";
import { emptySupplier, formFromSupplier, validateSupplier, toSupplierPayload } from "./supplierForm";
import { supplierAPI } from "../../services/inventoryAPI";
import Field from "../../ui/Field";
import TextInput from "../../ui/TextInput";
import PhoneInput from "../../ui/PhoneInput";
import Button from "../../ui/Button";
import StickyFooter from "../../ui/StickyFooter";
import PageHeader from "../../ui/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "../../ui/States";
import { FORM_PAGE, INPUT, buttonClass } from "../../ui/styles";
import { errorText } from "../../lib/errors";
import { useToast } from "../../context/ToastContext";

export default function SupplierFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const existing = useSupplier(id);
  const initial = useMemo(() => (isEdit ? (existing.data ? formFromSupplier(existing.data) : null) : emptySupplier()), [isEdit, existing.data]);
  const [edited, setEdited] = useState(null);
  const [shown, setShown] = useState(false);
  const save = useMutation({
    mutationFn: (payload) => (isEdit ? supplierAPI.update(id, payload) : supplierAPI.create(payload)).then((r) => r.data.data),
    onSuccess: () => refreshStock(qc),
  });

  if (isEdit && existing.isPending) return <PageSkeleton />;
  if (isEdit && existing.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {existing.error?.response?.status === 404
          ? <EmptyState title="This supplier doesn't exist" action={<Link to="/suppliers" className={buttonClass({ variant: "secondary" })}>All suppliers</Link>} />
          : <ErrorState title="Couldn't load this supplier." onRetry={() => existing.refetch()} />}
      </div>
    );
  }
  const f = edited ?? initial;
  const set = (patch) => setEdited((prev) => ({ ...(prev ?? initial), ...patch }));
  const errors = shown ? validateSupplier(f, existing.data) : {};
  const back = () => navigate(isEdit ? `/suppliers/${id}` : "/suppliers", { replace: true });
  const submit = (e) => {
    e.preventDefault();
    if (Object.keys(validateSupplier(f, existing.data)).length) {
      setShown(true);
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    save.mutate(toSupplierPayload(f), { onSuccess: (s) => { toast.success(isEdit ? "Changes saved" : "Supplier added"); navigate(`/suppliers/${s?.id || id}`, { replace: true }); } });
  };
  return (
    <form onSubmit={submit} noValidate className={`${FORM_PAGE} pt-4`}>
      <PageHeader title={isEdit ? "Edit supplier" : "New supplier"} />
      <div className="space-y-5 pb-6 sm:mt-4">
        <Field label="Name" htmlFor="sp-name" error={errors.name}><TextInput value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Business name" /></Field>
        <Field label="Mobile" htmlFor="sp-phone" optional><PhoneInput value={f.phone} onChange={(phone) => set({ phone })} /></Field>
        <Field label="Email" htmlFor="sp-email" optional error={errors.email}><TextInput type="email" inputMode="email" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="GSTIN" htmlFor="sp-gst" optional error={errors.gst_number}><TextInput value={f.gst_number} onChange={(e) => set({ gst_number: e.target.value })} autoCapitalize="characters" /></Field>
        <Field label="Address" htmlFor="sp-address" optional><textarea rows={3} value={f.address} onChange={(e) => set({ address: e.target.value })} className={`${INPUT} h-auto py-2`} /></Field>
      </div>
      <StickyFooter>
        {save.isError && <p role="alert" className="mb-2 text-sm text-status-critical">{errorText(save.error, "Couldn't save. Check your connection and try again.")}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={back}>Cancel</Button>
          <Button type="submit" block size="lg" loading={save.isPending}>{isEdit ? "Save changes" : "Save supplier"}</Button>
        </div>
      </StickyFooter>
    </form>
  );
}
```

- [ ] **Step 4: Routes, titles, knowledge**

`routeMeta.test.js` add:

```js
    ["/suppliers", { title: "Suppliers", back: null, hideNav: false }],
    ["/suppliers/new", { title: "New supplier", back: null, hideNav: true }],
    ["/suppliers/edit/s1", { title: "Edit supplier", back: null, hideNav: true }],
    ["/suppliers/s1", { title: "Supplier", back: "/suppliers", hideNav: false }],
```

Run → FAIL. In `routeMeta.js` replace the three `suppliers` entries with:

```js
  [/^\/suppliers\/new$/, { title: "New supplier", hideNav: true }],
  [/^\/suppliers\/edit\/[^/]+$/, { title: "Edit supplier", hideNav: true }],
  [/^\/suppliers\/[^/]+$/, { title: "Supplier", back: "/suppliers" }],
  [/^\/suppliers/, { title: "Suppliers" }],
```

`App.jsx`: replace the four supplier lazy imports and route elements with `SuppliersPage`, `SupplierFormPage` (new, edit/:id), `SupplierPage` (:id).

Update `backend/knowledge/inventory.md` so every screen name and button matches: Stock (summary card, All / Low stock, ⋯ → Download Excel, Purchase orders, Stock issues, Items, Suppliers), Item stock (Batches · Movements · Details, Issue stock, Order more), Items (⋯ → Item categories, Item details), New purchase order (Supplier → Items → Review, Create order), Purchase order (Items · Deliveries · Details, Receive material, ⋯ → Cancel / Delete only before anything is received), Receive material (leave a line blank if it didn't come; more than open is allowed and flagged), Issue stock (Issue · Wastage · Add stock · Remove stock; a reason is needed to add/remove; shows stock on hand and warns when short), Suppliers (Call, WhatsApp, New purchase order, ⋯ → Edit / Delete). Read the current file first and keep every fact about how stock is valued (FIFO, batch rates, adjustments rated at the latest receipt rate) unchanged.

Run: `cd frontend && npx vitest run 2>&1 | grep -E "^ +Tests" && npx eslint src/features/inventory src/App.jsx src/app` and `cd backend && npm test -- knowledge` → Expected: pass; clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/inventory frontend/src/App.jsx frontend/src/app/routeMeta.js frontend/src/app/routeMeta.test.js backend/knowledge/inventory.md
git commit -m "feat(suppliers): supplier directory, supplier page with call/WhatsApp and orders, supplier form

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 10: Shell — login, not found, loading guard, theme toggle, toasts

**Files:**
- Create: `frontend/src/features/auth/LoginPage.jsx`, `frontend/src/app/NotFoundPage.jsx`
- Modify: `frontend/src/context/AuthContext.jsx` (login), `frontend/src/components/auth/ProtectedRoute.jsx`, `frontend/src/components/theme/ThemeToggle.jsx`, `frontend/src/context/ToastContext.jsx`, `frontend/src/App.jsx`

- [ ] **Step 1: Login tells a wrong password apart from no connection**

In `AuthContext.jsx` `login`, replace `catch { return false; }` with:

```js
    } catch (err) {
      // Wrong username/password → false. No connection or a server fault is not "wrong password".
      if (err?.response?.status === 400 || err?.response?.status === 401) return false;
      throw err;
    }
```

`frontend/src/features/auth/LoginPage.jsx`:

```jsx
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Field from "../../ui/Field";
import TextInput from "../../ui/TextInput";
import Button from "../../ui/Button";

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (isAuthenticated) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) return setError("Enter your username and password");
    setBusy(true);
    try {
      if (await login(username.trim(), password)) navigate("/", { replace: true });
      else setError("That username or password is wrong");
    } catch {
      setError("Couldn't reach the server. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brass font-num text-xl font-bold text-brass-on shadow-[0_8px_30px_rgb(var(--c-brass)/0.35)]">Y</div>
          <h1 className="mt-4 font-num text-2xl font-bold text-ink">YARS</h1>
          <p className="text-sm text-ink-2">Sign in to your factory's books</p>
        </div>
        <form onSubmit={submit} noValidate className="space-y-4 rounded-3xl bg-gradient-to-b from-raised to-surface p-5 shadow-[inset_0_1px_0_rgb(var(--c-brass)/0.25)]">
          <Field label="Username" htmlFor="login-user">
            <TextInput autoComplete="username" autoCapitalize="none" autoCorrect="off" value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
          <Field label="Password" htmlFor="login-pass">
            <div className="relative">
              <TextInput type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-12" id="login-pass" />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 grid w-12 place-items-center text-ink-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          {error && <p role="alert" className="rounded-xl bg-status-critical/10 px-3 py-2 text-sm font-medium text-status-critical">{error}</p>}
          <Button type="submit" block size="lg" loading={busy}>Sign in</Button>
        </form>
      </div>
    </main>
  );
}
```

(`Field` clones its child with `id`; the password child is a wrapper `div`, so the `TextInput` carries `id="login-pass"` itself.)

- [ ] **Step 2: Not found, loading guard, theme toggle, toasts**

`frontend/src/app/NotFoundPage.jsx`:

```jsx
import { Link } from "react-router-dom";
import { buttonClass } from "../ui/styles";

export default function NotFoundPage() {
  return (
    <div className="mx-auto grid min-h-[60dvh] max-w-md place-items-center px-4 text-center">
      <div>
        <p className="font-num text-6xl font-bold text-brass">404</p>
        <h1 className="mt-2 text-xl font-bold text-ink">This page doesn't exist</h1>
        <p className="mt-1 text-sm text-ink-2">The link may be old or mistyped.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/" className={buttonClass()}>Home</Link>
          <Link to="/orders" className={buttonClass({ variant: "secondary" })}>Orders</Link>
        </div>
      </div>
    </div>
  );
}
```

Replace `frontend/src/components/auth/ProtectedRoute.jsx` with:

```jsx
import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div role="status" className="grid min-h-dvh place-items-center bg-canvas text-ink-2">
        <span className="flex items-center gap-2 text-sm"><Loader2 className="h-5 w-5 animate-spin text-brass" aria-hidden="true" />Loading…</span>
      </div>
    );
  }
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
```

Replace `frontend/src/components/theme/ThemeToggle.jsx` with:

```jsx
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import IconButton from "../../ui/IconButton";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const light = theme === "light";
  return (
    <IconButton label={light ? "Switch to dark mode" : "Switch to light mode"} onClick={toggleTheme} className="bg-transparent">
      {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-brass" />}
    </IconButton>
  );
}
```

In `frontend/src/context/ToastContext.jsx`: replace the `react-icons/fa` import with `import { CircleCheck, CircleAlert, Info } from "lucide-react";`, `ICONS` with `{ success: CircleCheck, error: CircleAlert, info: Info }`, and `STYLES` with:

```js
const STYLES = {
  success: "border-status-good/40 [&_svg]:text-status-good",
  error: "border-status-critical/40 [&_svg]:text-status-critical",
  info: "border-line [&_svg]:text-brass",
};
```

and in the toast `className` replace `rounded-xl border px-4 py-3 shadow-lg dark:shadow-black/40 cursor-pointer` with `rounded-2xl border bg-raised px-4 py-3 text-ink shadow-lg shadow-black/30 cursor-pointer`.

`App.jsx`: `Login` → `LoginPage` (`./features/auth/LoginPage`), `NotFound` → `NotFoundPage` (`./app/NotFoundPage`), both routes without `old(...)`.

Run: `cd frontend && npx eslint src/features/auth src/app src/components src/context src/App.jsx && npx vitest run 2>&1 | grep -E "^ +Tests"` → Expected: clean; pass.

Visual check (log out first): wrong password → "That username or password is wrong"; backend stopped → "Couldn't reach the server…"; show/hide works; `/nope` shows 404 page; theme toggle and toasts in both themes.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/auth frontend/src/app/NotFoundPage.jsx frontend/src/context/AuthContext.jsx frontend/src/components/auth/ProtectedRoute.jsx frontend/src/components/theme/ThemeToggle.jsx frontend/src/context/ToastContext.jsx frontend/src/App.jsx
git commit -m "feat(shell): new login, not-found, loading, theme toggle and toasts; login says when the server can't be reached

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Jarvis on the new look

**Files:**
- Create: `frontend/src/utils/relativeTime.js`, `frontend/src/utils/relativeTime.test.js`, `frontend/src/features/assistant/AssistantPage.jsx`
- Modify: `frontend/src/App.jsx`

Keep every behaviour of `pages/Assistant.jsx`: lazy conversation creation on first send; phone chat portaled to `<body>` and sized to `visualViewport`; Enter sends only on fine pointers; tables scroll; links starting with `/` become in-app buttons; hero copy; delete asks first. New: suggestion chips on an empty chat, desktop shows the list beside the chat, failures to open/send/delete show a toast instead of failing silently.

- [ ] **Step 1: Failing test**

`frontend/src/utils/relativeTime.test.js`:

```js
import { describe, expect, test } from "vitest";
import { relativeTime } from "./relativeTime";

const now = Date.parse("2026-09-30T12:00:00Z");
describe("relativeTime", () => {
  test("minutes, hours, days", () => {
    expect(relativeTime("2026-09-30T11:59:40Z", now)).toBe("just now");
    expect(relativeTime("2026-09-30T11:15:00Z", now)).toBe("45m ago");
    expect(relativeTime("2026-09-30T07:00:00Z", now)).toBe("5h ago");
    expect(relativeTime("2026-09-27T12:00:00Z", now)).toBe("3d ago");
  });
});
```

Run → FAIL. Then `frontend/src/utils/relativeTime.js`:

```js
export const relativeTime = (iso, now = Date.now()) => {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
};
```

Run → PASS.

- [ ] **Step 2: Page**

`frontend/src/features/assistant/AssistantPage.jsx`:

```jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
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

const SUGGESTIONS = ["Who owes me the most money?", "Which items are low on stock?", "How much did we spend this month?", "How do I record a payment?"];

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
          <span aria-hidden="true" className="jarvis-ring absolute inset-0 rounded-full bg-brass/40" />
          <div className="jarvis-float relative grid h-12 w-12 place-items-center rounded-full bg-brass text-brass-on"><Sparkles className="h-5 w-5" /></div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink">Hi, I’m Jarvis 👋</h1>
          <p className="text-sm text-ink-2">I can look up your live business data — pending payments, stock levels, orders, expenses — and guide you step-by-step through anything in the app. Ask me in English or Hindi.</p>
        </div>
      </div>
    </div>
  );
}

export default function AssistantPage() {
  const toast = useToast();
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
      setActiveId(id);
      setDraft(false);
      setMessages(res.data.data.messages.map((m) => ({ role: m.role, content: m.content })));
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
        toast.error("Couldn't reach Jarvis. Check your internet and try again.");
        return;
      }
    }
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);
    await streamMessage(id, text, {
      onDelta: (t) => setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], content: next[next.length - 1].content + t };
        return next;
      }),
      onStatus: (t) => setStatusLine(t),
      onDone: () => { setStatusLine(null); loadConversations(); },
      onError: (msg) => setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: `⚠️ ${msg}` };
        return next;
      }),
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
  const showTyping = streaming && lastMessage?.role === "assistant" && lastMessage.content === "";
  const chat = (
    <>
      <div className="flex items-center gap-2 border-b border-line/70 px-3 py-3">
        {!desktop && <IconButton label="Back to conversations" onClick={backToList} className="bg-transparent"><ArrowLeft className="h-5 w-5" /></IconButton>}
        <h1 className="flex-1 font-num text-base font-semibold text-ink">Jarvis</h1>
        {desktop && <Button size="sm" variant="secondary" onClick={startNew}><Plus className="h-4 w-4" aria-hidden="true" />New</Button>}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            {desktop && <Hero />}
            <p className="text-sm text-ink-2">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-line bg-surface px-3.5 py-2 text-left text-sm font-medium text-ink hover:border-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (m.role === "user" ? (
          <div key={i} className="flex justify-end"><div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brass px-4 py-2.5 text-sm text-brass-on">{m.content}</div></div>
        ) : (
          <div key={i} className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-line/70 bg-surface px-4 py-2.5 text-ink">
              {m.content === "" && showTyping ? (
                <span className="inline-flex gap-1 py-1" aria-label="Jarvis is typing">
                  {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-2" style={{ animationDelay: `${d}ms` }} />)}
                </span>
              ) : <AssistantMarkdown text={m.content} />}
            </div>
          </div>
        )))}
        {statusLine && <p className="pl-2 text-xs italic text-ink-2">{statusLine}</p>}
        <div ref={bottomRef} />
      </div>
      <div className="bg-canvas px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <div className="flex items-end gap-1.5 rounded-[26px] border border-line bg-surface px-2 py-1.5 transition focus-within:border-brass/60 focus-within:ring-2 focus-within:ring-brass/20">
          <textarea ref={inputRef} value={input} rows={1} placeholder="Ask Jarvis…" aria-label="Message Jarvis"
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

`App.jsx`: `const AssistantPage = lazy(() => import("./features/assistant/AssistantPage"));` and `<Route path="assistant" element={<AssistantPage />} />`.

Run: `cd frontend && npx vitest run 2>&1 | grep -E "^ +Tests" && npx eslint src/features/assistant src/utils/relativeTime.js src/App.jsx` → Expected: pass; clean.

Visual check (UX copy has no AI key: a send shows the server's ⚠️ message in the bubble, which proves streaming errors still surface): list, new chat with suggestions, delete asks first; phone chat covers the screen with the composer at the bottom.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/relativeTime.js frontend/src/utils/relativeTime.test.js frontend/src/features/assistant frontend/src/App.jsx
git commit -m "feat(jarvis): chat on the new look — suggestions, side list on desktop, errors shown instead of silent

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Remove everything legacy

**Files:** deletions listed below; modify `frontend/src/App.jsx`, `frontend/src/app/routeMeta.js`, `frontend/src/assets/styles/index.css`, `frontend/tailwind.config.js`, `frontend/package.json`, `frontend/package-lock.json`, `backend/knowledge/routes.md`, `HANDOFF.md`.

- [ ] **Step 1: App shell**

In `App.jsx`: every route now renders a new page; delete the `old` helper, the `Legacy` import, and the `./styles/*.css` imports (keep `./assets/styles/index.css` only if `main.jsx` doesn't already import it — it does, so remove it from `App.jsx`). In `routeMeta.js` delete the `// Not redesigned yet — titles as before.` comment (every remaining entry is current).

Run: `cd frontend && grep -rn "old(\|Legacy\|styles/" src/App.jsx` → Expected: no output.

- [ ] **Step 2: Delete old pages and components (only what nothing imports)**

```bash
cd frontend/src
git rm -q pages/Login.jsx pages/Assistant.jsx pages/Expenses.jsx pages/CreateExpense.jsx pages/EditExpense.jsx pages/ExpenseCategories.jsx pages/CreateExpenseCategory.jsx pages/EditExpenseCategory.jsx pages/History.jsx pages/Stock.jsx pages/StockItemDetail.jsx pages/InventoryItems.jsx pages/CreateInventoryItem.jsx pages/EditInventoryItem.jsx pages/PurchaseOrders.jsx pages/CreatePurchaseOrder.jsx pages/PurchaseOrderDetail.jsx pages/ReceivePurchaseOrder.jsx pages/StockIssues.jsx pages/CreateStockIssue.jsx pages/Suppliers.jsx pages/CreateSupplier.jsx pages/EditSupplier.jsx pages/SupplierDetail.jsx pages/InventoryCategories.jsx pages/ItemAttributes.jsx pages/NotFound.jsx
git rm -rq components/common components/ui components/expenses components/history app/Legacy.jsx
git rm -q styles/*.css components/layout/*.css
ls pages   # expect: Dashboard.jsx Dues.jsx (still in use)
```

Then find what became unused and remove it the same way, one grep per candidate — `lib/utils.js`, `hooks/useApi.js`, `utils/formatters.js` (+ its test), and any `utils/*` / `components/dashboard/*` file: a file goes only when `grep -rn "<basename without extension>" src --include=*.js --include=*.jsx` finds no importer outside itself and its own test.

Run: `cd frontend && npx vite build 2>&1 | tail -3` → Expected: build succeeds (proves no import points at a deleted file).

- [ ] **Step 3: Prune CSS and Tailwind**

Read `src/assets/styles/index.css` whole. Keep: `@tailwind` layers, the `:root` / `.dark` token variables, `body` base, `page-enter`, `toast-in` / `toast-out`, `jarvis-ring` / `jarvis-float`, `no-scrollbar`, the reduced-motion block, and any rule whose class a remaining file uses. For every other class selector, `grep -rn "<class>" src index.html` — delete the rule when nothing outside index.css uses it. Same for `tailwind.config.js`: remove colour palettes and keyframes no remaining class uses (`grep -rnE "(bg|text|border|from|to|via|ring|shadow)-<palette>" src`), keep the token colours (`canvas`, `surface`, `raised`, `line`, `ink`, `brass`, `status`).

Run: `cd frontend && npx vite build 2>&1 | tail -3` and compare the CSS asset size with before (expected smaller).

- [ ] **Step 4: Dependencies**

```bash
cd frontend
for p in react-datepicker react-icons class-variance-authority clsx tailwind-merge js-cookie; do echo "$p: $(grep -rln "from ['\"]$p" src | wc -l)"; done
```

Uninstall each package printing `0`: `npm uninstall <names>`.

Run: `cd frontend && npx vitest run 2>&1 | grep -E "^ +Tests" && npx eslint src 2>&1 | tail -3 && npx vite build 2>&1 | tail -3` → Expected: tests pass; eslint shows 0 errors for the whole `src` (legacy files were the source of the old errors — record the count if any remain and fix them); build succeeds.

- [ ] **Step 5: Docs**

`backend/knowledge/routes.md`: update every screen title to the new ones (Items, Item categories, Item details, Issue stock, Stock issues, Purchase orders, Receive material, Suppliers, History, Expenses, Expense categories, Jarvis). `HANDOFF.md`: replace the "part 2 not done / legacy pages" notes with: every page uses the kit; no legacy CSS/components; History date filter is India days on the server; where each area lives (`features/expenses`, `features/history`, `features/inventory`, `features/assistant`, `features/auth`).

Run: `cd backend && npm test 2>&1 | tail -4` → Expected: green.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src frontend/package.json frontend/package-lock.json frontend/tailwind.config.js backend/knowledge/routes.md HANDOFF.md
git commit -m "chore: remove legacy pages, components, stylesheets and unused dependencies

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`git add -A frontend/src` is used here only because this step deletes many files; check `git status` first and make sure nothing outside the intended paths — e.g. `frontend/.env.production`, `backend/scripts/*` — is staged.)

---

### Task 13: Walkthrough, review, deploy

- [ ] **Step 1: Walkthrough on the production copy** (`yars-uxcopy`, harness 390px + desktop, dark and light)

Every list loads with real data and its chips/search; every form saves, every delete/cancel asks first and the list updates; old routes (`/expense-categories/new`, `/expense-categories/edit/x`) redirect; Back on each PO step keeps what was typed. Re-check on the order form: a size without a piece price, unit Pcs → the per-piece price boxes are empty with the hint, typing a price saves it on the line (order page shows it).

Compare against the database for three figures: expense total for last month (`SELECT sum(total_cost) FROM expenses WHERE NOT is_archived AND bill_date BETWEEN '2026-08-01' AND '2026-08-31'` — check the actual archived column name in the model first), stock value vs `/stock/summary`, history count vs `SELECT count(*) FROM audit_logs`.

Fix what is found (each fix: failing test first when it is logic, then commit).

- [ ] **Step 2: Final review** — one Fable 5 reviewer (`model: "fable"`) over `git diff feature/ux-redesign...HEAD`, focused on the Review Focus list; fix confirmed findings.

- [ ] **Step 3: Deploy** — backup (`pg_dump`), backend build + Cloud Run deploy (audit filter + knowledge docs), delete `frontend/public/harness.html`, frontend build + Firebase deploy, `node scripts/dashboard-verify.js` against production, and a GET of `/api/audit-logs?from_date=2026-09-01&to_date=2026-09-30&limit=1` through the verify script's auth to confirm the new filter answers 200.
