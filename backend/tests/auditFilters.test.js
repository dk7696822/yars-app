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
