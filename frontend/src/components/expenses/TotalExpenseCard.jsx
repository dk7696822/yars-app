import { useState, useEffect } from "react";
import { FaMoneyBillWave, FaSpinner } from "react-icons/fa";
import { expenseAPI } from "../../services/api";
import { formatCurrency } from "../../utils/formatters";

const TotalExpenseCard = ({ filters = {} }) => {
  const [totalExpense, setTotalExpense] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchTotalExpense = async () => {
      try {
        setLoading(true);
        setError("");

        // Format filters for API (same logic as ExpenseFilter)
        const formattedFilters = { ...filters };

        // Format dates if they exist
        if (formattedFilters.from_date && typeof formattedFilters.from_date === "object") {
          formattedFilters.from_date = formattedFilters.from_date.toISOString().split("T")[0];
        }
        if (formattedFilters.to_date && typeof formattedFilters.to_date === "object") {
          formattedFilters.to_date = formattedFilters.to_date.toISOString().split("T")[0];
        }

        // Remove null/empty values
        Object.keys(formattedFilters).forEach((key) => {
          if (formattedFilters[key] === null || formattedFilters[key] === "") {
            delete formattedFilters[key];
          }
        });

        const response = await expenseAPI.getAll(formattedFilters);
        setTotalExpense(response.data.data.total_expense || 0);
      } catch (err) {
        console.error("Error fetching total expense:", err);
        setError("Failed to load total expense");
        setTotalExpense(0);
      } finally {
        setLoading(false);
      }
    };

    fetchTotalExpense();
  }, [filters]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6 ring-1 ring-black ring-opacity-5">
      <div className="flex items-center space-x-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300">
          {loading ? <FaSpinner className="h-6 w-6 animate-spin" /> : <FaMoneyBillWave className="h-6 w-6" />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Expense</p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{error ? <span className="text-red-500 text-sm">Error loading</span> : formatCurrency(totalExpense)}</h3>
          {Object.keys(filters).length > 0 && !loading && !error && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Based on applied filters</p>}
        </div>
      </div>
    </div>
  );
};

export default TotalExpenseCard;
