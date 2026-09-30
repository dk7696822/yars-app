/** Spec Decision 4: the type follows the amount — the whole due is final, less is a part payment. */
export const paymentTypeFor = (amount, due) => (Number(amount) >= Number(due) ? "FINAL" : "PARTIAL");

/** How much more than the due is being paid, exact to the paisa. */
export const overpayment = (amount, due) => Math.max(0, Math.round(Number(amount) * 100) - Math.round(Number(due) * 100)) / 100;

export const PAYMENT_TYPE_LABEL = { ADVANCE: "Advance", PARTIAL: "Part payment", FINAL: "Final payment", REFUND: "Refund" };

export const PAYMENT_METHODS = [["CASH", "Cash"], ["UPI", "UPI"], ["BANK_TRANSFER", "Bank"], ["CHECK", "Cheque"], ["OTHER", "Other"]];
