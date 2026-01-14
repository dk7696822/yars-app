import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaArrowLeft, FaClipboardList, FaExclamationCircle } from "react-icons/fa";
import { customerAPI, productSizeAPI, plateTypeAPI, orderAPI } from "../services/api";
import OrderForm from "../components/orders/OrderForm";

const CreateOrder = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [productSizes, setProductSizes] = useState([]);
  const [plateTypes, setPlateTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch all required data in parallel
        const [customersRes, productSizesRes, plateTypesRes] = await Promise.all([customerAPI.getAll(), productSizeAPI.getAll(), plateTypeAPI.getAll()]);

        setCustomers(customersRes.data.data);
        setProductSizes(productSizesRes.data.data);
        setPlateTypes(plateTypesRes.data.data);
      } catch (err) {
        console.error("Error fetching form data:", err);
        setError("Failed to load form data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      await orderAPI.create(formData);
      navigate("/orders", { state: { message: "Order created successfully" } });
    } catch (err) {
      console.error("Error creating order:", err);
      setError("Failed to create order. Please try again.");
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/orders");
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-gray-200 dark:border-gray-700" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-t-primary dark:border-t-emerald-400 animate-spin" />
          </div>
          <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">Loading form data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-5 md:space-y-6">
      {/* Back Link */}
      <Link
        to="/orders"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
      >
        <FaArrowLeft className="w-3 h-3" /> Back to Orders
      </Link>

      {/* Header */}
      <div>
        <h1 className="page-title">Create New Order</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Fill in the order details below</p>
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
        <div className="hidden dark:block absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="hidden dark:block absolute -bottom-20 -left-20 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header */}
        <div className="relative flex items-center gap-3 border-b border-gray-100 dark:border-gray-700/50 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <FaClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-display font-semibold text-gray-900 dark:text-gray-100">Order Details</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Enter customer and product information</p>
          </div>
        </div>

        {/* Card Content */}
        <div className="relative">
          <OrderForm customers={customers} productSizes={productSizes} plateTypes={plateTypes} onSubmit={handleSubmit} onCancel={handleCancel} isLoading={submitting} error={error} />
        </div>
      </div>
    </div>
  );
};

export default CreateOrder;
