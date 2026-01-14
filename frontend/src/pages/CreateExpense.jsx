import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaArrowLeft, FaMoneyBillWave, FaExclamationCircle, FaExclamationTriangle, FaPlus } from "react-icons/fa";
import { expenseAPI, expenseCategoryAPI } from "../services/api";
import ExpenseForm from "../components/expenses/ExpenseForm";

const CreateExpense = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await expenseCategoryAPI.getAll();
        setCategories(response.data.data);
      } catch (err) {
        console.error("Error fetching expense categories:", err);
        setError("Failed to load expense categories. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      await expenseAPI.create(formData);
      navigate("/expenses", { state: { message: "Expense created successfully" } });
    } catch (err) {
      console.error("Error creating expense:", err);
      setError(err.response?.data?.message || "Failed to create expense. Please try again.");
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/expenses");
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-gray-200 dark:border-gray-700" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-t-primary dark:border-t-amber-400 animate-spin" />
          </div>
          <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">Loading categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-5 md:space-y-6">
      {/* Back Link */}
      <Link
        to="/expenses"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
      >
        <FaArrowLeft className="w-3 h-3" /> Back to Expenses
      </Link>

      {/* Header */}
      <div>
        <h1 className="page-title">Create New Expense</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Add a new expense to track your spending</p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <FaExclamationCircle className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Form Card */}
      <div className="relative bg-white dark:bg-gradient-to-br dark:from-gray-800/60 dark:to-gray-900/80 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 shadow-soft dark:shadow-[0_0_50px_-15px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Ambient glow */}
        <div className="hidden dark:block absolute -top-20 -right-20 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="hidden dark:block absolute -bottom-20 -left-20 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header */}
        <div className="relative flex items-center gap-3 border-b border-gray-100 dark:border-gray-700/50 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <FaMoneyBillWave className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-display font-semibold text-gray-900 dark:text-gray-100">Expense Details</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Fill in the expense information</p>
          </div>
        </div>

        {/* Card Content */}
        <div className="relative p-4 sm:p-6">
          {categories.length === 0 ? (
            <div className="text-center py-8">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex items-start gap-3 mb-6">
                <FaExclamationTriangle className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-amber-700 dark:text-amber-400 text-sm text-left">
                  You need to create at least one expense category before adding expenses.
                </p>
              </div>
              <button
                onClick={() => navigate("/expense-categories/new")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95"
              >
                <FaPlus className="w-4 h-4" /> Create Category
              </button>
            </div>
          ) : (
            <ExpenseForm categories={categories} onSubmit={handleSubmit} onCancel={handleCancel} isLoading={submitting} />
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateExpense;
