import { describe, expect, test } from "vitest";
import { cardState, attachActions, replaceAction, keysAfter } from "./cardState";
import { MONEY_KEYS } from "../../lib/queryKeys";

const NOW = Date.parse("2026-10-01T10:00:00Z");
const card = (o) => ({ id: "a1", name: "record_payment", status: "pending", card: { title: "t", rows: [], warnings: [] }, error: null, formLink: "/orders/o1?pay=assistant:a1", resultLink: null, expiresAt: "2026-10-01T10:10:00Z", messageId: "m2", ...o });

describe("cardState", () => {
  test("pending: can confirm, can open the form, says when it expires", () => {
    expect(cardState(card(), NOW)).toEqual({ status: "pending", canAct: true, canOpenForm: true, note: "Expires in 10 min", tone: "info" });
  });
  test("a pending card past its time is expired: no Confirm, but the form still opens", () => {
    expect(cardState(card({ expiresAt: "2026-10-01T09:59:00Z" }), NOW)).toMatchObject({ status: "expired", canAct: false, canOpenForm: true, note: "Expired — ask again" });
  });
  test("confirmed, cancelled, failed", () => {
    expect(cardState(card({ status: "confirmed", resultLink: "/orders/o1" }), NOW)).toMatchObject({ canAct: false, canOpenForm: false, note: "Saved", tone: "good" });
    expect(cardState(card({ status: "cancelled" }), NOW)).toMatchObject({ canAct: false, note: "Cancelled — ask again if you need it" });
    expect(cardState(card({ status: "failed", error: "This order changed" }), NOW)).toMatchObject({ canAct: false, note: "This order changed", tone: "critical" });
  });
});

describe("placing cards", () => {
  const messages = [{ id: "m1", role: "user", content: "q" }, { id: "m2", role: "assistant", content: "a" }];

  test("each card sits under the reply it came with", () => {
    expect(attachActions(messages, [card()])[1].actions.map((a) => a.id)).toEqual(["a1"]);
  });
  test("a card with no reply goes under the last reply, or a reply of its own", () => {
    expect(attachActions(messages, [card({ messageId: null })])[1].actions).toHaveLength(1);
    expect(attachActions([messages[0]], [card({ messageId: null })])).toEqual([{ ...messages[0], actions: [] }, { role: "assistant", content: "", actions: [card({ messageId: null })] }]);
  });
  test("an updated card replaces the old one in place", () => {
    const placed = attachActions(messages, [card()]);
    expect(replaceAction(placed, card({ status: "confirmed" }))[1].actions[0].status).toBe("confirmed");
  });
  test("cards refresh exactly the screens every money save refreshes (one shared list)", () => {
    expect(keysAfter("record_payment")).toBe(MONEY_KEYS);
  });

  test("a confirmed card refreshes the money screens", () => {
    expect(keysAfter("record_payment")).toEqual([["orders"], ["customers"], ["invoices"]]);
    expect(keysAfter("anything_new")).toEqual([["orders"], ["customers"], ["invoices"]]);
  });
});
