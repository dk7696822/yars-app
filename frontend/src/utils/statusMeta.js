/** The one place status names and colours are decided. */
export const ORDER_STATUS = {
  PENDING: { label: "Pending", tone: "warn" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  COMPLETED: { label: "Completed", tone: "good" },
  DELIVERED: { label: "Delivered", tone: "good" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
};
export const ORDER_FLOW = ["PENDING", "IN_PROGRESS", "COMPLETED", "DELIVERED"];
export const INVOICE_STATUS = {
  PENDING: { label: "Unpaid", tone: "warn" },
  OVERDUE: { label: "Overdue", tone: "critical" },
  PAID: { label: "Paid", tone: "good" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
};
export const TONE_CLASS = {
  good: "bg-status-good/15 text-status-good",
  warn: "bg-status-warn/15 text-status-warn",
  critical: "bg-status-critical/15 text-status-critical",
  info: "bg-brass/15 text-brass",
  muted: "bg-raised text-ink-2",
};
