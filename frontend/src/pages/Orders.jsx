import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaExclamationCircle, FaDownload, FaFilter } from "react-icons/fa";
import { orderAPI, exportAPI } from "../services/api";
import { formatDateForAPI } from "../utils/formatters";
import OrderFilter from "../components/orders/OrderFilter";
import OrderList from "../components/orders/OrderList";
import ConfirmationModal from "../components/common/ConfirmationModal";

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async (filterParams = {}) => {
    try {
      setLoading(true);

      // Format dates for API
      const params = { ...filterParams };
      if (params.dateFrom) {
        params.dateFrom = formatDateForAPI(params.dateFrom);
      }
      if (params.dateTo) {
        params.dateTo = formatDateForAPI(params.dateTo);
      }
      if (params.date) {
        params.date = formatDateForAPI(params.date);
      }

      const response = await orderAPI.getAll(params);

      // Ensure we have all the data needed for summary calculations
      const ordersWithDetails = response.data.data.map((order) => {
        // Make sure orderProductSizes is always an array
        if (!order.orderProductSizes) {
          order.orderProductSizes = [];
        }

        // Make sure payment_summary exists
        if (!order.payment_summary && order.payments) {
          const totalPaid = order.payments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
          const advanceReceived = parseFloat(order.advance_received || 0);
          const totalAmount = parseFloat(order.total_amount || 0);

          order.payment_summary = {
            total_paid: totalPaid,
            advance_received: advanceReceived,
            total_payments: totalPaid + advanceReceived,
            remaining_balance: totalAmount - totalPaid - advanceReceived,
            is_fully_paid: totalPaid + advanceReceived >= totalAmount,
          };
        }

        return order;
      });

      setOrders(ordersWithDetails);
      setError("");
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError("Failed to load orders. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = (filterParams) => {
    setFilters(filterParams);
    fetchOrders(filterParams);
  };

  const handleDeleteOrder = (orderId) => {
    // Find the order to show its details in the confirmation modal
    const order = orders.find((o) => o.id === orderId);
    setOrderToDelete(order);
    setShowDeleteModal(true);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;

    try {
      await orderAPI.delete(orderToDelete.id);
      setOrders((prev) => prev.filter((order) => order.id !== orderToDelete.id));
    } catch (err) {
      console.error("Error deleting order:", err);
      setError("Failed to delete order. Please try again.");
    }
  };

  const handleDownloadExcel = () => {
    try {
      const params = {};

      if (filters.customerName) {
        params.search = filters.customerName;
      }

      if (filters.status) {
        params.status = filters.status;
      }

      if (filters.dateFrom) {
        params.from_date = formatDateForAPI(filters.dateFrom);
      }
      if (filters.dateTo) {
        params.to_date = formatDateForAPI(filters.dateTo);
      }
      if (filters.date) {
        const formattedDate = formatDateForAPI(filters.date);
        params.from_date = formattedDate;
        params.to_date = formattedDate;
      }

      // Clean up undefined, null, or empty string values
      Object.keys(params).forEach((key) => {
        if (params[key] === undefined || params[key] === null || params[key] === "" || params[key] === "undefined") {
          delete params[key];
        }
      });

      const downloadUrl = exportAPI.downloadDashboardData(params);
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Manage and track all your orders
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 sm:hidden"
          >
            <FaFilter className="h-4 w-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </button>
          <button
            onClick={handleDownloadExcel}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95"
            title="Download filtered data as Excel"
          >
            <FaDownload className="h-4 w-4" />
            <span className="hidden sm:inline">Download Excel</span>
          </button>
          <Link
            to="/orders/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95"
          >
            <FaPlus className="h-4 w-4" />
            <span className="hidden sm:inline">New Order</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>
      </div>

      {/* Filter section */}
      <div className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 shadow-soft overflow-hidden transition-all duration-300 ${showFilters ? "opacity-100" : "opacity-0 h-0 sm:opacity-100 sm:h-auto"}`}>
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <h2 className="section-title flex items-center gap-2">
            <FaFilter className="w-4 h-4 text-gray-400" />
            Filter Orders
          </h2>
        </div>
        <div className="p-4 md:p-5">
          <OrderFilter onFilter={handleFilter} />
        </div>
      </div>

      {/* Orders list */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 shadow-soft overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <h2 className="section-title">All Orders</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
          </span>
        </div>
        <div className="p-4 md:p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              </div>
              <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">Loading orders...</p>
            </div>
          ) : (
            <OrderList orders={orders} onDelete={handleDeleteOrder} />
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteOrder}
        title="Delete Order"
        message={
          orderToDelete
            ? `Are you sure you want to delete the order for ${orderToDelete.customer.name} placed on ${new Date(orderToDelete.order_date).toLocaleDateString()}?`
            : "Are you sure you want to delete this order?"
        }
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
};

export default Orders;
