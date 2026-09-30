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
