"use strict";

/** Invoices screen list — pure, over invoices + invoiceMoneyFor() results. */
const { toPaise, rupees } = require("../orderFacts");
const { paging, pageOf, ListError } = require("./orderList");

const CHIPS = ["all", "unpaid", "overdue"];
const isUnpaid = (r) => r.derivedStatus === "PENDING" || r.derivedStatus === "OVERDUE";

const buildInvoiceList = (invoices, moneyById, query) => {
  const chip = query.chip || "all";
  if (!CHIPS.includes(chip)) throw new ListError(`Unknown filter "${chip}"`);
  const q = String(query.search || "").trim().toLowerCase();

  const all = invoices
    .map((inv) => {
      const m = moneyById.get(inv.id);
      return {
        id: inv.id,
        number: inv.invoice_number,
        invoiceDate: inv.invoice_date,
        dueDate: inv.payment_due_date || null,
        customer: { id: inv.customer_id, name: inv.customer?.name || "Unknown customer", phone: inv.customer?.metadata?.phone || null },
        subtotal: Number(inv.total_amount),
        taxPercent: Number(inv.tax_percent),
        taxAmount: Number(inv.tax_amount),
        finalAmount: Number(inv.final_amount),
        ordersCount: m.orders.length,
        amountPaid: m.amountPaid,
        amountDue: m.amountDue,
        amountExtra: m.amountExtra,
        derivedStatus: m.derivedStatus,
        overdueDays: m.overdueDays,
      };
    })
    .filter((r) => !q || r.customer.name.toLowerCase().includes(q) || r.number.includes(q));

  const counts = { all: all.length, unpaid: all.filter(isUnpaid).length, overdue: all.filter((r) => r.derivedStatus === "OVERDUE").length };
  const summary = { due: rupees(all.filter(isUnpaid).reduce((s, r) => s + toPaise(r.amountDue), 0)) };
  const rows = all
    .filter((r) => chip === "all" || (chip === "unpaid" ? isUnpaid(r) : r.derivedStatus === "OVERDUE"))
    .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate) || b.number.localeCompare(a.number));
  return { ...pageOf(rows, paging(query)), counts, summary };
};

module.exports = { buildInvoiceList };
