import PropTypes from "prop-types";
import { FaPlus } from "react-icons/fa";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

const PaymentSummary = ({ invoice, onAddPayment }) => {
  if (!invoice) return null;

  const { payment_summary, payments = [] } = invoice;

  // Calculate advance payments from invoice items
  const advancePaid = invoice.invoiceItems
    ? invoice.invoiceItems.filter((item) => item.description.includes("Advance Payment")).reduce((total, item) => total + Math.abs(parseFloat(item.total_price)), 0)
    : 0;

  // Get additional payments (excluding advance payments which are already in invoice items)
  // Filter out any payments that might be duplicating the advance payment
  const advancePayments = payments.filter((payment) => payment.payment_type === "ADVANCE");
  const otherPayments = payments.filter((payment) => payment.payment_type !== "ADVANCE");

  // Calculate total of non-advance payments
  const additionalPayments = otherPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

  // Total amount should be subtotal (without tax)
  const subtotal = parseFloat(invoice.total_amount);

  // Calculate remaining balance as subtotal minus all payments (advance + additional)
  const remainingBalance = payment_summary?.remaining_balance || subtotal - advancePaid - additionalPayments;

  // Total paid is the sum of advance and additional payments
  const totalPaid = additionalPayments;

  const isFullyPaid = payment_summary?.is_fully_paid || remainingBalance <= 0;

  return (
    <div className="bg-white dark:bg-gray-800/60 p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-700/50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Payment Information</h3>

        {!isFullyPaid && (
          <Button onClick={onAddPayment} variant="primary" className="w-full sm:w-auto min-h-[44px]">
            <FaPlus /> Record Payment
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/50">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total Invoice Amount</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(subtotal)}</p>
        </div>

        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">Total Paid</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalPaid + advancePaid)}</p>
          {advancePaid > 0 && <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">(Includes {formatCurrency(advancePaid)} advance)</p>}
        </div>

        <div className={`p-4 rounded-xl border ${remainingBalance <= 0 ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30" : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30"}`}>
          <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${remainingBalance <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>Remaining Balance</p>
          <p className={`text-xl font-bold ${remainingBalance <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{formatCurrency(remainingBalance)}</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Payment Status</p>
        {isFullyPaid ? (
          <Badge variant="success" className="text-sm">
            FULLY PAID
          </Badge>
        ) : (
          <Badge variant="warning" className="text-sm">
            PARTIALLY PAID
          </Badge>
        )}
      </div>

      {payments.length > 0 && (
        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700/50">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Payment History</h4>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[500px] px-4 sm:px-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Method</th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="py-2.5 px-3 text-gray-900 dark:text-gray-100">{formatDate(payment.payment_date)}</td>
                      <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100">{formatCurrency(payment.amount)}</td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">{payment.payment_type || "PARTIAL"}</td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">{payment.payment_method}</td>
                      <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400">{payment.reference_number || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

PaymentSummary.propTypes = {
  invoice: PropTypes.object,
  onAddPayment: PropTypes.func.isRequired,
};

export default PaymentSummary;
