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
