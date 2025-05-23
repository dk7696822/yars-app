import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaPlus, FaListAlt, FaExclamationCircle, FaCheckCircle } from "react-icons/fa";
import { expenseAPI, expenseCategoryAPI } from "../services/api";
import ExpenseList from "../components/expenses/ExpenseList";
import ExpenseFilter from "../components/expenses/ExpenseFilter";

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
        // Don't set error here as it's not critical for the page
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        setLoading(true);
        const response = await expenseAPI.getAll(filters);
        setExpenses(response.data.data);
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

      // Remove the deleted expense from the state
      setExpenses(expenses.filter((expense) => expense.id !== id));

      setSuccessMessage("Expense deleted successfully");

      // Clear the success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    } catch (err) {
      console.error("Error deleting expense:", err);
      setError("Failed to delete expense. Please try again later.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <FaExclamationCircle className="text-red-500 mt-0.5 mr-3 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
          <FaCheckCircle className="text-green-500 mt-0.5 mr-3 flex-shrink-0" />
          <p className="text-green-700">{successMessage}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Expenses</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/expenses/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <FaPlus className="mr-2 h-4 w-4" /> New Expense
          </Link>
          <Link
            to="/expense-categories"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <FaListAlt className="mr-2 h-4 w-4" /> Manage Categories
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Expenses</h2>
        </div>
        <div className="p-6">
          <ExpenseFilter categories={categories} onFilter={handleFilter} />

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="mt-4 text-gray-500 dark:text-gray-400">Loading expenses...</p>
            </div>
          ) : (
            <div className="mt-6">
              <ExpenseList expenses={expenses} onDelete={handleDeleteExpense} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Expenses;
