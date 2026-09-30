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
