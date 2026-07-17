import PropTypes from "prop-types";
import { FaPlus, FaEdit, FaTrash, FaMoneyBillWave, FaCalendarAlt, FaCreditCard, FaReceipt } from "react-icons/fa";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import MobileActionDropdown from "../ui/MobileActionDropdown";

const OrderPaymentSummary = ({ order, onAddPayment, onEditPayment, onDeletePayment }) => {
  if (!order) return null;

  const { payment_summary, payments = [] } = order;

  // If payment_summary is not available, calculate it
  const totalPaid = payment_summary?.total_paid || 0;
  const advanceReceived = payment_summary?.advance_received || parseFloat(order.advance_received || 0);
  const totalPayments = payment_summary?.total_payments || totalPaid + advanceReceived;
  const remainingBalance = payment_summary?.remaining_balance || (order.total_amount ? order.total_amount - totalPayments : 0);
  const isFullyPaid = payment_summary?.is_fully_paid || remainingBalance <= 0;

  return (
    <div className="relative bg-white dark:bg-gradient-to-br dark:from-gray-800/60 dark:to-gray-900/80 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 shadow-soft dark:shadow-[0_0_50px_-15px_rgba(0,0,0,0.5)] overflow-hidden">
      {/* Ambient glow */}
      <div className="hidden dark:block absolute -top-20 -left-20 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <FaMoneyBillWave className="w-4 h-4" />
            </div>
            <h3 className="text-base font-display font-semibold text-gray-900 dark:text-gray-100">Payment Information</h3>
          </div>

          {!isFullyPaid && (
            <Button onClick={onAddPayment} variant="primary" className="flex items-center gap-2 w-full sm:w-auto justify-center">
              <FaPlus className="w-3 h-3" /> Record Payment
            </Button>
          )}
        </div>
      </div>

      <div className="relative p-4 sm:p-5 space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/30">
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-1">Total Order Amount</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(order.total_amount)}</p>
          </div>

          <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200/50 dark:border-emerald-500/20">
            <p className="text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-medium mb-1">Total Paid</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalPayments)}</p>
            {advanceReceived > 0 && <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">(Includes {formatCurrency(advanceReceived)} advance)</p>}
          </div>

          <div className={`p-4 rounded-xl border ${remainingBalance <= 0 ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/50 dark:border-emerald-500/20" : "bg-red-50 dark:bg-red-500/10 border-red-200/50 dark:border-red-500/20"}`}>
            <p className={`text-xs uppercase tracking-wider font-medium mb-1 ${remainingBalance <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>Remaining Balance</p>
            <p className={`text-xl font-bold ${remainingBalance <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{formatCurrency(remainingBalance)}</p>
          </div>
        </div>

        {/* Payment Status */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment Status:</span>
          {isFullyPaid ? (
            <Badge variant="success">FULLY PAID</Badge>
          ) : (
            <Badge variant="warning">PARTIALLY PAID</Badge>
          )}
        </div>

        {/* Payment History */}
        {payments.length > 0 && (
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700/50">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Payment History</h4>

            {/* Mobile Card View */}
            <div className="block md:hidden space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/30">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                        <FaMoneyBillWave className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(payment.amount)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(payment.payment_date)}</p>
                      </div>
                    </div>
                    <MobileActionDropdown
                      actions={[
                        ...(onEditPayment ? [{ title: "Edit", icon: FaEdit, iconColor: "text-blue-500 dark:text-blue-400", onClick: () => onEditPayment(payment) }] : []),
                        ...(onDeletePayment ? [{ title: "Delete", icon: FaTrash, iconColor: "text-red-500 dark:text-red-400", onClick: () => onDeletePayment(payment.id) }] : []),
                      ]}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Type:</span>
                      <span className="ml-1 text-gray-900 dark:text-gray-100">{payment.payment_type}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Method:</span>
                      <span className="ml-1 text-gray-900 dark:text-gray-100">{payment.payment_method}</span>
                    </div>
                    {payment.reference_number && (
                      <div className="col-span-2">
                        <span className="text-gray-500 dark:text-gray-400">Ref:</span>
                        <span className="ml-1 text-gray-900 dark:text-gray-100">{payment.reference_number}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-xl">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-gray-800/50">
                    <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Date</th>
                    <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Amount</th>
                    <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Type</th>
                    <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Method</th>
                    <th className="h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Reference</th>
                    <th className="h-10 px-4 text-right align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="p-4 align-middle text-gray-600 dark:text-gray-400">{formatDate(payment.payment_date)}</td>
                      <td className="p-4 align-middle font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(payment.amount)}</td>
                      <td className="p-4 align-middle text-gray-700 dark:text-gray-300">{payment.payment_type}</td>
                      <td className="p-4 align-middle text-gray-700 dark:text-gray-300">{payment.payment_method}</td>
                      <td className="p-4 align-middle text-gray-700 dark:text-gray-300">{payment.reference_number || <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                      <td className="p-4 align-middle text-right">
                        <MobileActionDropdown
                          actions={[
                            ...(onEditPayment ? [{ title: "Edit", icon: FaEdit, iconColor: "text-blue-500 dark:text-blue-400", onClick: () => onEditPayment(payment) }] : []),
                            ...(onDeletePayment ? [{ title: "Delete", icon: FaTrash, iconColor: "text-red-500 dark:text-red-400", onClick: () => onDeletePayment(payment.id) }] : []),
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

OrderPaymentSummary.propTypes = {
  order: PropTypes.object,
  onAddPayment: PropTypes.func,
  onEditPayment: PropTypes.func,
  onDeletePayment: PropTypes.func,
};

export default OrderPaymentSummary;
