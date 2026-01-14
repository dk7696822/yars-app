import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaPlus, FaListAlt, FaExclamationCircle, FaCheckCircle, FaDownload, FaFilter, FaMoneyBillWave } from "react-icons/fa";
import { expenseAPI, expenseCategoryAPI, exportAPI } from "../services/api";
import ExpenseList from "../components/expenses/ExpenseList";
import ExpenseFilter from "../components/expenses/ExpenseFilter";
import TotalExpenseCard from "../components/expenses/TotalExpenseCard";

const Expenses = () => {
  const location = useLocation();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [filters, setFilters] = useState({});

  useEffect(() => {
    // Check for success message in location state
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Clear the message after 3 seconds
      const timer = setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await expenseCategoryAPI.getAll();
        setCategories(response.data.data);
      } catch (err) {
        console.error("Error fetching expense categories:", err);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        setLoading(true);
        const response = await expenseAPI.getAll(filters);
        setExpenses(response.data.data.expenses || response.data.data);
        setError("");
      } catch (err) {
        console.error("Error fetching expenses:", err);
        setError("Failed to load expenses. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [filters]);

  const handleFilter = (filterParams) => {
    setFilters(filterParams);
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) {
      return;
    }

    try {
      await expenseAPI.delete(id);
      setExpenses(expenses.filter((expense) => expense.id !== id));
      setSuccessMessage("Expense deleted successfully");
      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    } catch (err) {
      console.error("Error deleting expense:", err);
      setError("Failed to delete expense. Please try again later.");
    }
  };

  const handleDownloadExcel = () => {
    try {
      const params = { ...filters };

      if (params.from_date && typeof params.from_date === "object") {
        params.from_date = params.from_date.toISOString().split("T")[0];
      }
      if (params.to_date && typeof params.to_date === "object") {
        params.to_date = params.to_date.toISOString().split("T")[0];
      }

      Object.keys(params).forEach((key) => {
        if (params[key] === null || params[key] === "") {
          delete params[key];
        }
      });

      const downloadUrl = exportAPI.downloadExpensesData(params);
      window.open(downloadUrl, "_blank");
    } catch (err) {
      console.error("Error downloading Excel:", err);
      setError("Failed to download Excel file. Please try again.");
    }
  };

  return (
    <div className="page-container space-y-5 md:space-y-6">
      {/* Error alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <FaExclamationCircle className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Success alert */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <FaCheckCircle className="text-green-500 mt-0.5 flex-shrink-0" />
          <p className="text-green-700 dark:text-green-400 text-sm">{successMessage}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Track and manage your expenses
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={handleDownloadExcel}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95"
            title="Download filtered data as Excel"
          >
            <FaDownload className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </button>
          <Link
            to="/expense-categories"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95"
          >
            <FaListAlt className="h-4 w-4" />
            <span className="hidden sm:inline">Categories</span>
          </Link>
          <Link
            to="/expenses/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95"
          >
            <FaPlus className="h-4 w-4" />
            <span className="hidden sm:inline">New Expense</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>
      </div>

      {/* Total Expense Card */}
      <TotalExpenseCard filters={filters} />

      {/* Expenses list */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 shadow-soft overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <h2 className="section-title flex items-center gap-2">
            <FaFilter className="w-4 h-4 text-gray-400" />
            Filter & View Expenses
          </h2>
        </div>
        <div className="p-4 md:p-5">
          <ExpenseFilter categories={categories} onFilter={handleFilter} />

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              </div>
              <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">Loading expenses...</p>
            </div>
          ) : expenses.length > 0 ? (
            <div className="mt-6">
              <ExpenseList expenses={expenses} onDelete={handleDeleteExpense} />
            </div>
          ) : (
            <div className="text-center py-12 mt-6">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FaMoneyBillWave className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-medium mb-1">No expenses found</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                Add your first expense to start tracking.
              </p>
              <Link
                to="/expenses/new"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-700"
              >
                <FaPlus className="w-3 h-3" /> Add Expense
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Expenses;
