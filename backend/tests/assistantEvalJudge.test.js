"use strict";

const { judge } = require("../scripts/eval/judge");

const ids = { bombayOrder: "o-1", single: "p-1", size1216: "s-1" };
const proposal = (name, args, ok = true) => ({ name: `propose_${name}`, args, ok });

describe("eval judge", () => {
  test("an action passes when its arguments contain what's expected and ids point at the right records", () => {
    const run = { calls: [{ name: "find", args: {}, ok: true }, proposal("record_payment", { order_id: "o-1", amount: 5000, method: "UPI" })], text: "Tap Confirm." };
    expect(judge({ action: "record_payment", args: { amount: 5000, method: "UPI" }, refs: { order_id: "bombayOrder" } }, run, ids)).toEqual({ pass: true, why: "" });
  });

  test("the wrong record fails, saying why", () => {
    const run = { calls: [proposal("record_payment", { order_id: "o-2", amount: 5000 })], text: "" };
    expect(judge({ action: "record_payment", refs: { order_id: "bombayOrder" } }, run, ids)).toEqual({ pass: false, why: 'propose_record_payment args {"order_id":"o-2","amount":5000}' });
  });

  test("nested refs and list arguments", () => {
    const run = { calls: [proposal("create_order", { plate_type_id: "p-1", lines: [{ size_id: "s-1", unit: "KG", quantity: 20 }] })], text: "" };
    expect(judge({ action: "create_order", args: { lines: [{ unit: "KG", quantity: 20 }] }, refs: { plate_type_id: "single", "lines.0.size_id": "size1216" } }, run, ids).pass).toBe(true);
  });

  test("asking back passes only with no card and a question", () => {
    expect(judge({ asks: true }, { calls: [], text: "Which Sharma Traders — Surat or Delhi?" }, ids).pass).toBe(true);
    expect(judge({ asks: true }, { calls: [proposal("record_payment", {})], text: "Which one?" }, ids).pass).toBe(false);
    expect(judge({ asks: true }, { calls: [proposal("record_payment", {}, false)], text: "Which one?" }, ids).pass).toBe(true);
  });

  test("a question asked without a question mark still counts as asking", () => {
    expect(judge({ asks: true }, { calls: [], text: "Please tell me the rate per kg for 14 x 18." }, ids).pass).toBe(true);
    expect(judge({ asks: true }, { calls: [], text: "Sure! Please provide the customer's name." }, ids).pass).toBe(true);
    expect(judge({ asks: true }, { calls: [], text: "Done." }, ids).pass).toBe(false);
  });

  test("refusing passes with no card and the link", () => {
    expect(judge({ noAction: true, mentions: "/orders" }, { calls: [], text: "I can't delete. [Open the order](/orders/o-1)" }, ids).pass).toBe(true);
  });

  test("a read question passes when the expected tool was used", () => {
    expect(judge({ tool: "dues" }, { calls: [{ name: "dues", args: {}, ok: true }], text: "₹10" }, ids).pass).toBe(true);
    expect(judge({ tool: "dues" }, { calls: [{ name: "run_query", args: {}, ok: true }], text: "₹10" }, ids).pass).toBe(false);
  });
});
