/**
 * Orders an invoice payment can be saved on: every live, non-cancelled order
 * on the invoice — owing ones first (oldest first), then paid ones. A paid
 * order stays selectable because the invoice's GST can be due after every
 * order is paid.
 */
export const invoicePaymentChoices = (orderMoney) =>
  orderMoney
    .filter((o) => !o.deleted && o.status !== "CANCELLED")
    .sort((a, b) => Number(b.due > 0) - Number(a.due > 0) || a.orderDate.localeCompare(b.orderDate));

/** Choice id for money paid against the invoice as a whole (e.g. its GST) — saved without an order. */
export const INVOICE_ONLY = "INVOICE_ONLY";

/** Preselect the oldest order still owing; when every order is paid, the invoice itself. */
export const defaultInvoiceChoice = (choices) => choices.find((o) => o.due > 0)?.id || INVOICE_ONLY;
