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
