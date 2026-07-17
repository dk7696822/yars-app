import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaArrowLeft, FaUserPlus, FaExclamationCircle } from "react-icons/fa";
import { customerAPI } from "../services/api";
import CustomerForm from "../components/customers/CustomerForm";

const CreateCustomer = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      await customerAPI.create(formData);
      navigate("/customers", { state: { message: "Customer created successfully" } });
    } catch (err) {
      console.error("Error creating customer:", err);
      setError("Failed to create customer. Please try again.");
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/customers");
  };

  return (
    <div className="page-container space-y-5 md:space-y-6">
      {/* Back Link */}
      <Link
        to="/customers"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
      >
        <FaArrowLeft className="w-3 h-3" /> Back to Customers
      </Link>

      {/* Header */}
      <div>
        <h1 className="page-title">Create New Customer</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Add a new customer to your database</p>
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
        <div className="hidden dark:block absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="hidden dark:block absolute -bottom-20 -left-20 w-48 h-48 bg-emerald-500/3 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header */}
        <div className="relative flex items-center gap-3 border-b border-gray-100 dark:border-emerald-900/20 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
            <FaUserPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-display font-semibold text-gray-900 dark:text-emerald-50">Customer Details</h2>
            <p className="text-xs text-gray-500 dark:text-emerald-100/60">Enter customer information</p>
          </div>
        </div>

        {/* Card Content */}
        <div className="relative">
          <CustomerForm onSubmit={handleSubmit} onCancel={handleCancel} isLoading={submitting} error={error} />
        </div>
      </div>
    </div>
  );
};

export default CreateCustomer;
