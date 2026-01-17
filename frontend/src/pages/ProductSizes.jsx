import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaPlus, FaSearch, FaExclamationCircle, FaCheckCircle } from "react-icons/fa";
import { productSizeAPI } from "../services/api";
import ProductSizeList from "../components/productSizes/ProductSizeList";

const ProductSizes = () => {
  const location = useLocation();
  const [productSizes, setProductSizes] = useState([]);
  const [filteredProductSizes, setFilteredProductSizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

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
    const fetchProductSizes = async () => {
      try {
        setLoading(true);
        const response = await productSizeAPI.getAll();
        setProductSizes(response.data.data);
        setFilteredProductSizes(response.data.data);
      } catch (err) {
        console.error("Error fetching product sizes:", err);
        setError("Failed to load product sizes. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchProductSizes();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredProductSizes(productSizes);
    } else {
      const filtered = productSizes.filter((productSize) => productSize.size_label.toLowerCase().includes(searchTerm.toLowerCase()));
      setFilteredProductSizes(filtered);
    }
  }, [searchTerm, productSizes]);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this product size?")) {
      try {
        await productSizeAPI.delete(id);
        setProductSizes((prev) => prev.filter((productSize) => productSize.id !== id));
        setSuccessMessage("Product size deleted successfully");
      } catch (err) {
        console.error("Error deleting product size:", err);
        setError("Failed to delete product size. Please try again.");
      }
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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-emerald-50">Product Sizes</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/product-sizes/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <FaPlus className="mr-2 h-4 w-4" /> New Product Size
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111916] rounded-lg border border-gray-200 dark:border-emerald-900/20 shadow-sm dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] overflow-hidden">
        <div className="border-b border-gray-200 dark:border-emerald-900/20 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-emerald-50">Product Sizes</h2>
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 dark:text-emerald-500/50">
              <FaSearch className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search product sizes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full h-10 rounded-md border border-gray-300 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] px-3 py-2 text-sm text-gray-900 dark:text-emerald-50 placeholder:text-gray-400 dark:placeholder:text-emerald-100/40 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-emerald-500/30 focus:border-primary dark:focus:border-emerald-500/50"
            />
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary dark:border-emerald-500/30 border-t-primary dark:border-t-emerald-400"></div>
              <p className="mt-4 text-gray-500 dark:text-emerald-100/60">Loading product sizes...</p>
            </div>
          ) : (
            <ProductSizeList productSizes={filteredProductSizes} onDelete={handleDelete} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductSizes;
