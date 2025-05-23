import { Link } from "react-router-dom";
import { FaEdit, FaTrash } from "react-icons/fa";
import { formatDate, formatCurrency } from "../../utils/formatters";

const ExpenseList = ({ expenses, onDelete }) => {
  if (!expenses || expenses.length === 0) {
    return (
      <div className="rounded-md bg-gray-100 p-8 text-center">
        <p className="text-gray-500">No expenses found. Create your first expense to get started.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="w-[12%] h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Bill Date</th>
            <th className="w-[15%] h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Category</th>
            <th className="w-[15%] h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Vendor</th>
            <th className="w-[25%] h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Description</th>
            <th className="w-[10%] h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Cost</th>
            <th className="w-[10%] h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Status</th>
            <th className="w-[13%] h-12 px-4 text-right align-middle font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {expenses.map((expense) => (
            <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="p-4 align-middle text-gray-900 dark:text-gray-300">{formatDate(expense.bill_date)}</td>
              <td className="p-4 align-middle text-gray-900 dark:text-gray-300">{expense.category?.name}</td>
              <td className="p-4 align-middle text-gray-900 dark:text-gray-300">{expense.vendor}</td>
              <td className="p-4 align-middle text-gray-900 dark:text-gray-300">{expense.description}</td>
              <td className="p-4 align-middle text-gray-900 dark:text-gray-300">{formatCurrency(expense.total_cost)}</td>
              <td className="p-4 align-middle">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    expense.payment_status === "PAID"
                      ? "border-transparent bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300"
                      : "border-transparent bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300"
                  }`}
                >
                  {expense.payment_status}
                </span>
              </td>
              <td className="p-4 align-middle text-right">
                <div className="flex justify-end space-x-2">
                  <Link
                    to={`/expenses/edit/${expense.id}`}
                    title="Edit"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-0 text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <FaEdit className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                  </Link>
                  <button
                    onClick={() => onDelete(expense.id)}
                    title="Delete"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-0 text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <FaTrash className="h-4 w-4 text-red-500 dark:text-red-400" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ExpenseList;
