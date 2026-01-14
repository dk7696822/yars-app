import { Link } from "react-router-dom";
import { FaEdit, FaTrash, FaReceipt, FaStore, FaCalendarAlt, FaRupeeSign, FaTag } from "react-icons/fa";
import { formatDate, formatCurrency } from "../../utils/formatters";
import MobileActionDropdown from "../ui/MobileActionDropdown";

const ExpenseList = ({ expenses, onDelete }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case "PAID":
        return {
          bg: "bg-emerald-100 dark:bg-emerald-500/20",
          text: "text-emerald-700 dark:text-emerald-400",
        };
      case "UNPAID":
        return {
          bg: "bg-amber-100 dark:bg-amber-500/20",
          text: "text-amber-700 dark:text-amber-400",
        };
      default:
        return {
          bg: "bg-gray-100 dark:bg-gray-500/20",
          text: "text-gray-700 dark:text-gray-400",
        };
    }
  };

  if (!expenses || expenses.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">No expenses found. Create your first expense to get started.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        {expenses.map((expense) => {
          const statusConfig = getStatusConfig(expense.payment_status);

          return (
            <div
              key={expense.id}
              className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50 overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-4 border-b border-gray-100 dark:border-gray-700/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                      <FaReceipt className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {expense.description || "No description"}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                        <FaStore className="w-3 h-3" />
                        {expense.vendor || "Unknown vendor"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${statusConfig.bg} ${statusConfig.text}`}>
                      {expense.payment_status}
                    </span>
                    <MobileActionDropdown
                      actions={[
                        { title: "Edit", icon: FaEdit, iconColor: "text-blue-500 dark:text-blue-400", to: `/expenses/edit/${expense.id}` },
                        { title: "Delete", icon: FaTrash, iconColor: "text-red-500 dark:text-red-400", onClick: () => onDelete(expense.id) },
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* Card Body - Key Info */}
              <div className="p-4 space-y-3">
                {/* Amount - Prominent */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                      <FaRupeeSign className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Total Cost</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(expense.total_cost)}</span>
                </div>

                {/* Category */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                      <FaTag className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Category</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{expense.category?.name || "Uncategorized"}</span>
                </div>

                {/* Date */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                      <FaCalendarAlt className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Bill Date</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatDate(expense.bill_date)}</span>
                </div>
              </div>

              {/* Card Footer - Quick Actions */}
              <div className="px-4 py-3 bg-gray-50/50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700/50 flex gap-2">
                <Link
                  to={`/expenses/edit/${expense.id}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                >
                  <FaEdit className="w-3 h-3" />
                  Edit
                </Link>
                <button
                  onClick={() => onDelete(expense.id)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                >
                  <FaTrash className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-xl">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50/80 dark:bg-gray-800/50">
              <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Bill Date</th>
              <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Category</th>
              <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Vendor</th>
              <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Description</th>
              <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Cost</th>
              <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Status</th>
              <th className="h-12 px-4 text-right align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {expenses.map((expense) => {
              const statusConfig = getStatusConfig(expense.payment_status);

              return (
                <tr key={expense.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="p-4 align-middle text-gray-600 dark:text-gray-400">{formatDate(expense.bill_date)}</td>
                  <td className="p-4 align-middle">
                    <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                      <FaTag className="w-3 h-3 text-purple-500 dark:text-purple-400" />
                      {expense.category?.name || "Uncategorized"}
                    </span>
                  </td>
                  <td className="p-4 align-middle text-gray-700 dark:text-gray-300">{expense.vendor || <span className="text-gray-400 dark:text-gray-500">N/A</span>}</td>
                  <td className="p-4 align-middle text-gray-700 dark:text-gray-300 max-w-[200px] truncate">{expense.description || <span className="text-gray-400 dark:text-gray-500">No description</span>}</td>
                  <td className="p-4 align-middle font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(expense.total_cost)}</td>
                  <td className="p-4 align-middle">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${statusConfig.bg} ${statusConfig.text}`}>
                      {expense.payment_status}
                    </span>
                  </td>
                  <td className="p-4 align-middle text-right">
                    <MobileActionDropdown
                      actions={[
                        { title: "Edit", icon: FaEdit, iconColor: "text-blue-500 dark:text-blue-400", to: `/expenses/edit/${expense.id}` },
                        { title: "Delete", icon: FaTrash, iconColor: "text-red-500 dark:text-red-400", onClick: () => onDelete(expense.id) },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExpenseList;
