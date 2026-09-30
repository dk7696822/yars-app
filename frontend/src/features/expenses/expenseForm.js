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
