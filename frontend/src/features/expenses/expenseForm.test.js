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
