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
