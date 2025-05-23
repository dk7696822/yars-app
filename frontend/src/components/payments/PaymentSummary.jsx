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
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Payment Information</h3>

        {!isFullyPaid && (
          <Button onClick={onAddPayment} variant="primary" className="flex items-center gap-2 mt-2 md:mt-0">
            <FaPlus /> Record Payment
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Invoice Amount</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(subtotal)}</p>
        </div>

        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Paid</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalPaid + advancePaid)}</p>
          {advancePaid > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">(Includes {formatCurrency(advancePaid)} advance)</p>}
        </div>

        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400">Remaining Balance</p>
          <p className={`text-xl font-bold ${remainingBalance <= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{formatCurrency(remainingBalance)}</p>
        </div>
      </div>

      <div className="mb-2">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-2">Payment Status</h4>
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
        <div className="mt-4">
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-2">Payment History</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Method</th>
                  <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="py-2 px-2 text-gray-900 dark:text-white">{formatDate(payment.payment_date)}</td>
                    <td className="py-2 px-2 text-gray-900 dark:text-white">{formatCurrency(payment.amount)}</td>
                    <td className="py-2 px-2 text-gray-900 dark:text-white">{payment.payment_type || "PARTIAL"}</td>
                    <td className="py-2 px-2 text-gray-900 dark:text-white">{payment.payment_method}</td>
                    <td className="py-2 px-2 text-gray-900 dark:text-white">{payment.reference_number || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
