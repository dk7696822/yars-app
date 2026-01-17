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
    <div className="relative overflow-hidden bg-white dark:bg-[#111916] rounded-2xl border border-gray-200/60 dark:border-red-500/20 shadow-soft dark:shadow-[0_0_30px_-10px_rgba(239,68,68,0.15)] p-5 sm:p-6 max-w-md">
      {/* Ambient glow for dark mode */}
      <div className="hidden dark:block absolute -top-10 -right-10 w-32 h-32 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative flex items-center gap-4">
        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
          {loading ? <FaSpinner className="h-6 w-6 animate-spin" /> : <FaMoneyBillWave className="h-6 w-6" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-emerald-100/60">Total Expense</p>
          <h3 className="text-2xl sm:text-3xl font-bold font-display text-gray-900 dark:text-red-400 tracking-tight">
            {error ? <span className="text-red-500 dark:text-red-400 text-sm">Error loading</span> : formatCurrency(totalExpense)}
          </h3>
          {Object.keys(filters).length > 0 && !loading && !error && (
            <p className="text-xs text-gray-400 dark:text-emerald-100/40 mt-1">Based on applied filters</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TotalExpenseCard;
