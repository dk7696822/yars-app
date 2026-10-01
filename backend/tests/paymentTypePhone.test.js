"use strict";

const { paymentTypeFor, overpayment } = require("../src/services/paymentType");
const { toIndianMobile, mobileDigits, mobileStatus } = require("../src/services/phone");

// The same cases as frontend/src/utils/paymentType.test.js and mobile/dashboardHelpers tests.
describe("payment type follows the amount (same as the payment sheet)", () => {
  test("paying the whole due is final, less is part", () => {
    expect([paymentTypeFor(1000, 1000), paymentTypeFor(999.99, 1000), paymentTypeFor(500, 0)]).toEqual(["FINAL", "PARTIAL", "FINAL"]);
  });
  test("overpayment in exact paise", () => {
    expect([overpayment(1200, 1000), overpayment(900, 1000), overpayment(0.3, 0.1)]).toEqual([200, 0, 0.2]);
  });
});

describe("mobile numbers (same as the customer form)", () => {
  test("strips +91, a leading 0 and spaces", () => {
    expect([mobileDigits("+91 98765 43210"), mobileDigits("098765-43210")]).toEqual(["9876543210", "9876543210"]);
  });
  test("status", () => {
    expect(["", "98765", "5876543210", "98765 43210", "08217 453398"].map(mobileStatus)).toEqual(["empty", "invalid", "invalid", "valid", "invalid"]);
  });
  test("landlines and short numbers are not mobiles", () => {
    for (const raw of [null, "", "08482-234567", "12345", "5876543210", "0987654321"]) expect(toIndianMobile(raw)).toBeNull();
    expect(toIndianMobile("919876543210")).toBe("9876543210");
  });
});
