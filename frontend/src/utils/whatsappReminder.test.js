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
