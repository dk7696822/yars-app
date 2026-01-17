import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FaArrowLeft, FaEdit, FaExclamationCircle } from "react-icons/fa";
import { productSizeAPI } from "../services/api";
import ProductSizeForm from "../components/productSizes/ProductSizeForm";

const EditProductSize = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [productSize, setProductSize] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProductSize = async () => {
      try {
        setLoading(true);
        const response = await productSizeAPI.getById(id);
        setProductSize(response.data.data);
      } catch (err) {
        console.error("Error fetching product size:", err);
        setError("Failed to load product size. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchProductSize();
  }, [id]);

  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      await productSizeAPI.update(id, formData);
      navigate("/product-sizes", { state: { message: "Product size updated successfully" } });
    } catch (err) {
      console.error("Error updating product size:", err);
      setError("Failed to update product size. Please try again.");
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/product-sizes");
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-gray-200 dark:border-emerald-900/30" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-t-purple-500 dark:border-t-purple-400 animate-spin" />
          </div>
          <p className="mt-4 text-gray-500 dark:text-emerald-100/60 text-sm">Loading product size...</p>
        </div>
      </div>
    );
  }

  if (!productSize) {
    return (
      <div className="page-container space-y-5 md:space-y-6">
        <Link
          to="/product-sizes"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          <FaArrowLeft className="w-3 h-3" /> Back to Product Sizes
        </Link>

        <div className="relative bg-white dark:bg-[#111916] rounded-2xl border border-gray-200/60 dark:border-emerald-900/20 shadow-soft dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] overflow-hidden p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FaExclamationCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
            </div>
            <h3 className="text-gray-900 dark:text-gray-100 font-semibold mb-2">Product Size Not Found</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">The product size you're looking for doesn't exist or has been deleted.</p>
            <button
              onClick={() => navigate("/product-sizes")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95"
            >
              <FaArrowLeft className="w-4 h-4" /> Back to Product Sizes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-5 md:space-y-6">
      {/* Back Link */}
      <Link
        to="/product-sizes"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
      >
        <FaArrowLeft className="w-3 h-3" /> Back to Product Sizes
      </Link>

      {/* Header */}
      <div>
        <h1 className="page-title">Edit Product Size</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Update details for <span className="font-medium text-gray-700 dark:text-gray-300">{productSize?.size_label}</span>
        </p>
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
        <div className="hidden dark:block absolute -bottom-20 -left-20 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header */}
        <div className="relative flex items-center gap-3 border-b border-gray-100 dark:border-emerald-900/20 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
            <FaEdit className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-display font-semibold text-gray-900 dark:text-emerald-50">Product Size Details</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Update size label and pricing</p>
          </div>
        </div>

        {/* Card Content */}
        <div className="relative">
          <ProductSizeForm initialValues={productSize} onSubmit={handleSubmit} onCancel={handleCancel} isLoading={submitting} error={error} />
        </div>
      </div>
    </div>
  );
};

export default EditProductSize;
