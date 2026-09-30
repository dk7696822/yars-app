import { parseNumber } from "../../utils/numberInput";
import { paymentTypeFor, overpayment } from "../../utils/paymentType";
import { isISODate, todayIST } from "../../utils/istDate";
import { inr } from "../../utils/dashboardFormat";

export const SHEET_TEXT = {
  payment: { title: "Record payment", save: "Save payment", done: "Payment saved" },
  advance: { title: "Record advance", save: "Save advance", done: "Advance saved" },
  refund: { title: "Record refund", save: "Save refund", done: "Refund saved" },
  edit: { title: "Edit payment", save: "Save changes", done: "Payment updated" },
};

export const initialPaymentForm = (payment) => ({
  amount: payment ? String(payment.amount) : "",
  type: payment?.type || "PARTIAL",
  method: payment?.method || "CASH",
  date: payment?.date || todayIST(),
  reference: payment?.reference || "",
  notes: payment?.notes || "",
});

/** API payment → the row shape every payment list uses. */
export const toPaymentRow = (p) => ({
  id: p.id,
  amount: Number(p.amount),
  type: p.payment_type,
  method: p.payment_method,
  date: p.payment_date,
  reference: p.reference_number || null,
  notes: p.notes || null,
});

/**
 * Check the sheet and build the API body. mode "payment": the type follows the
 * amount; "advance" / "refund": fixed; "edit": the chosen type. overpay > 0
 * means the amount is above the due — the sheet asks once before saving.
 */
export const validatePayment = ({ mode, form, due, received }) => {
  const errors = {};
  const { value: amount, error } = parseNumber(form.amount);
  if (error || amount === null) errors.amount = error || "Enter the amount";
  if (!isISODate(form.date)) errors.date = "Choose the date";
  if (!errors.amount && mode === "refund" && Math.round(amount * 100) > Math.round(received * 100)) {
    errors.amount = `A refund can't be more than received (${inr(received)})`;
  }
  if (Object.keys(errors).length) return { errors, overpay: 0, payload: null };

  const type = { payment: paymentTypeFor(amount, due), advance: "ADVANCE", refund: "REFUND", edit: form.type }[mode];
  return {
    errors,
    overpay: type === "REFUND" ? 0 : overpayment(amount, due),
    payload: {
      amount,
      payment_type: type,
      payment_date: form.date,
      payment_method: form.method,
      reference_number: form.reference.trim() || null,
      notes: form.notes.trim() || null,
    },
  };
};
