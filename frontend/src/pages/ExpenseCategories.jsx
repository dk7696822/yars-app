import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaPlus, FaSearch, FaExclamationCircle, FaCheckCircle, FaTags, FaArrowLeft } from 'react-icons/fa';
import { expenseCategoryAPI } from '../services/api';
import ExpenseCategoryList from '../components/expenses/ExpenseCategoryList';

const ExpenseCategories = () => {
  const location = useLocation();
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Check for success message in location state
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Clear the message after 3 seconds
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await expenseCategoryAPI.getAll();
        setCategories(response.data.data);
        setFilteredCategories(response.data.data);
      } catch (err) {
        console.error('Error fetching expense categories:', err);
        setError('Failed to load expense categories. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredCategories(categories);
    } else {
      const filtered = categories.filter(category =>
        category.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCategories(filtered);
    }
  }, [searchTerm, categories]);

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) {
      return;
    }

    try {
      await expenseCategoryAPI.delete(id);

      // Remove the deleted category from the state
      setCategories(categories.filter(category => category.id !== id));

      setSuccessMessage('Category deleted successfully');

      // Clear the success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('Error deleting category:', err);
      setError(err.response?.data?.message || 'Failed to delete category. Please try again later.');
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
          <h1 className="page-title">Expense Categories</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Manage your expense categories
          </p>
        </div>
        <Link
          to="/expense-categories/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95"
        >
          <FaPlus className="h-4 w-4" /> New Category
        </Link>
      </div>

      {/* Categories list */}
      <div className="relative bg-white dark:bg-[#111916] rounded-2xl border border-gray-200/60 dark:border-emerald-900/20 shadow-soft dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] overflow-hidden">
        {/* Ambient glow */}
        <div className="hidden dark:block absolute -top-20 -right-20 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="hidden dark:block absolute -bottom-20 -left-20 w-48 h-48 bg-emerald-500/3 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 dark:border-emerald-900/20 px-4 sm:px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <FaTags className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-display font-semibold text-gray-900 dark:text-emerald-50">All Categories</h2>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-emerald-100/60">
                {filteredCategories.length} {filteredCategories.length === 1 ? 'category' : 'categories'}
              </p>
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 dark:text-emerald-500/50">
              <FaSearch className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-11 pr-4 rounded-xl border border-gray-200 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] text-sm text-gray-900 dark:text-emerald-50 placeholder:text-gray-400 dark:placeholder:text-emerald-100/40 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-emerald-500/30 focus:border-primary dark:focus:border-emerald-500/50 transition-all"
            />
          </div>
        </div>
        <div className="relative p-4 md:p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-gray-200 dark:border-emerald-900/30" />
                <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-t-primary dark:border-t-purple-400 animate-spin" />
              </div>
              <p className="mt-4 text-gray-500 dark:text-emerald-100/60 text-sm">Loading categories...</p>
            </div>
          ) : filteredCategories.length > 0 ? (
            <ExpenseCategoryList
              categories={filteredCategories}
              onDelete={handleDeleteCategory}
            />
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FaTags className="w-8 h-8 text-purple-500 dark:text-purple-400/60" />
              </div>
              <h3 className="text-gray-900 dark:text-gray-100 font-medium mb-1">
                {searchTerm ? "No categories found" : "No categories yet"}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                {searchTerm ? "Try adjusting your search terms" : "Create your first category to get started."}
              </p>
              {!searchTerm && (
                <Link
                  to="/expense-categories/new"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary dark:text-purple-400 hover:text-primary-700 dark:hover:text-purple-300 transition-colors"
                >
                  <FaPlus className="w-3 h-3" /> Add Category
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Back link */}
      <Link
        to="/expenses"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
      >
        <FaArrowLeft className="w-3 h-3" /> Back to Expenses
      </Link>
    </div>
  );
};

export default ExpenseCategories;
