import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaPlus, FaListAlt, FaExclamationCircle, FaCheckCircle, FaDownload, FaFilter, FaMoneyBillWave, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { expenseAPI, expenseCategoryAPI, exportAPI } from "../services/api";
import ExpenseList from "../components/expenses/ExpenseList";
import ExpenseFilter from "../components/expenses/ExpenseFilter";
import TotalExpenseCard from "../components/expenses/TotalExpenseCard";

const EXPENSES_PER_PAGE = 10;

const Expenses = () => {
  const location = useLocation();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [filters, setFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

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

  // Calculate paginated expenses
  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * EXPENSES_PER_PAGE;
    return expenses.slice(startIndex, startIndex + EXPENSES_PER_PAGE);
  }, [expenses, currentPage]);

  const totalPages = Math.ceil(expenses.length / EXPENSES_PER_PAGE);

  const handleFilter = (filterParams) => {
    setFilters(filterParams);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
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
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-emerald-100 hover:bg-gray-50 dark:hover:bg-emerald-500/10 transition-all active:scale-95"
            title="Download filtered data as Excel"
          >
            <FaDownload className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </button>
          <Link
            to="/expense-categories"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-emerald-100 hover:bg-gray-50 dark:hover:bg-emerald-500/10 transition-all active:scale-95"
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
      <div className="relative bg-white dark:bg-[#111916] rounded-2xl border border-gray-200/60 dark:border-emerald-900/20 shadow-soft dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] overflow-hidden">
        {/* Ambient glow */}
        <div className="hidden dark:block absolute -top-20 -right-20 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="hidden dark:block absolute -bottom-20 -left-20 w-48 h-48 bg-emerald-500/3 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 dark:border-emerald-900/20 px-4 sm:px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <FaMoneyBillWave className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-display font-semibold text-gray-900 dark:text-emerald-50">Filter & View Expenses</h2>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-emerald-100/60">
                {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
              </p>
            </div>
          </div>
        </div>
        <div className="relative p-4 md:p-5">
          <ExpenseFilter categories={categories} onFilter={handleFilter} />

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-primary/20 dark:border-primary/30 border-t-primary animate-spin" />
              </div>
              <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">Loading expenses...</p>
            </div>
          ) : expenses.length > 0 ? (
            <div className="mt-6">
              <ExpenseList expenses={paginatedExpenses} onDelete={handleDeleteExpense} />

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-emerald-900/20">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-emerald-100/60 order-2 sm:order-1">
                    Showing {((currentPage - 1) * EXPENSES_PER_PAGE) + 1} - {Math.min(currentPage * EXPENSES_PER_PAGE, expenses.length)} of {expenses.length} expenses
                  </p>
                  <div className="flex items-center gap-2 order-1 sm:order-2">
                    <button
                      onClick={goToPrevPage}
                      disabled={currentPage === 1}
                      className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-gray-200 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] text-gray-600 dark:text-emerald-100/70 hover:bg-gray-50 dark:hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <FaChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>

                    {/* Page numbers - hidden on mobile */}
                    <div className="hidden sm:flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                            page === currentPage
                              ? "bg-primary text-white"
                              : "bg-white dark:bg-[#161d1a] border border-gray-200 dark:border-emerald-900/30 text-gray-600 dark:text-emerald-100/70 hover:bg-gray-50 dark:hover:bg-emerald-500/10"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    {/* Mobile page indicator */}
                    <span className="sm:hidden text-sm font-medium text-gray-700 dark:text-emerald-100 min-w-[80px] text-center">
                      {currentPage} / {totalPages}
                    </span>

                    <button
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-gray-200 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] text-gray-600 dark:text-emerald-100/70 hover:bg-gray-50 dark:hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <FaChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 mt-6">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FaMoneyBillWave className="w-8 h-8 text-amber-500 dark:text-amber-400/60" />
              </div>
              <h3 className="text-gray-900 dark:text-gray-100 font-medium mb-1">No expenses found</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                Add your first expense to start tracking.
              </p>
              <Link
                to="/expenses/new"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary dark:text-amber-400 hover:text-primary-700 dark:hover:text-amber-300 transition-colors"
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
