import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaArrowLeft, FaTags, FaExclamationCircle } from "react-icons/fa";
import { expenseCategoryAPI } from "../services/api";
import ExpenseCategoryForm from "../components/expenses/ExpenseCategoryForm";

const CreateExpenseCategory = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      await expenseCategoryAPI.create(formData);
      navigate("/expense-categories", { state: { message: "Category created successfully" } });
    } catch (err) {
      console.error("Error creating expense category:", err);
      setError(err.response?.data?.message || "Failed to create category. Please try again.");
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/expense-categories");
  };

  return (
    <div className="page-container space-y-5 md:space-y-6">
      {/* Back Link */}
      <Link
        to="/expense-categories"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
      >
        <FaArrowLeft className="w-3 h-3" /> Back to Categories
      </Link>

      {/* Header */}
      <div>
        <h1 className="page-title">Create New Category</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Add a new expense category</p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <FaExclamationCircle className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Form Card */}
      <div className="relative bg-white dark:bg-[#111916] rounded-2xl border border-gray-200/60 dark:border-emerald-900/20 shadow-soft dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] overflow-hidden">
        {/* Ambient glow */}
        <div className="hidden dark:block absolute -top-20 -right-20 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="hidden dark:block absolute -bottom-20 -left-20 w-48 h-48 bg-emerald-500/3 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header */}
        <div className="relative flex items-center gap-3 border-b border-gray-100 dark:border-emerald-900/20 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
            <FaTags className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-display font-semibold text-gray-900 dark:text-emerald-50">Category Details</h2>
            <p className="text-xs text-gray-500 dark:text-emerald-100/60">Enter the category name</p>
          </div>
        </div>

        {/* Card Content */}
        <div className="relative p-4 sm:p-6">
          <ExpenseCategoryForm onSubmit={handleSubmit} onCancel={handleCancel} isLoading={submitting} />
        </div>
      </div>
    </div>
  );
};

export default CreateExpenseCategory;
