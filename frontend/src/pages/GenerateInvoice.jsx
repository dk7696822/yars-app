import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaArrowLeft, FaFileInvoiceDollar, FaExclamationCircle } from "react-icons/fa";
import { customerAPI, invoiceAPI } from "../services/api";
import GenerateInvoiceForm from "../components/invoices/GenerateInvoiceForm";

const GenerateInvoice = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch customers
        const customersRes = await customerAPI.getAll();
        setCustomers(customersRes.data.data);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      setError("");

      // Format dates for API
      const apiData = {
        ...formData,
        billing_period_start: formData.billing_period_start.toISOString().split("T")[0],
        billing_period_end: formData.billing_period_end.toISOString().split("T")[0],
        payment_due_date: formData.payment_due_date ? formData.payment_due_date.toISOString().split("T")[0] : null,
      };

      const response = await invoiceAPI.generate(apiData);

      // Navigate to the invoice details page
      navigate(`/invoices/${response.data.data.id}`);
    } catch (err) {
      console.error("Error generating invoice:", err);
      setError(err.response?.data?.message || "Failed to generate invoice. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/invoices");
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-gray-200 dark:border-emerald-900/30" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-t-primary dark:border-t-emerald-400 animate-spin" />
          </div>
          <p className="mt-4 text-gray-500 dark:text-emerald-100/60 text-sm">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-5 md:space-y-6">
      {/* Back Link */}
      <Link
        to="/invoices"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
      >
        <FaArrowLeft className="w-3 h-3" /> Back to Invoices
      </Link>

      {/* Header */}
      <div>
        <h1 className="page-title">Generate New Invoice</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Create an invoice from customer orders</p>
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
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
            <FaFileInvoiceDollar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-display font-semibold text-gray-900 dark:text-emerald-50">Invoice Details</h2>
            <p className="text-xs text-gray-500 dark:text-emerald-100/60">Select customer and orders to invoice</p>
          </div>
        </div>

        {/* Card Content */}
        <div className="relative">
          <GenerateInvoiceForm customers={customers} onSubmit={handleSubmit} onCancel={handleCancel} isLoading={submitting} />
        </div>
      </div>
    </div>
  );
};

export default GenerateInvoice;
