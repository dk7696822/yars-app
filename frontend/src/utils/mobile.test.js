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
