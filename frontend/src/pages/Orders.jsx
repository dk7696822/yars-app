import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaExclamationCircle, FaDownload, FaFilter, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { orderAPI, exportAPI } from "../services/api";
import { formatDateForAPI } from "../utils/formatters";
import OrderFilter from "../components/orders/OrderFilter";
import OrderList from "../components/orders/OrderList";
import ConfirmationModal from "../components/common/ConfirmationModal";

const ORDERS_PER_PAGE = 10;

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

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

  // Calculate paginated orders
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ORDERS_PER_PAGE;
    return orders.slice(startIndex, startIndex + ORDERS_PER_PAGE);
  }, [orders, currentPage]);

  const totalPages = Math.ceil(orders.length / ORDERS_PER_PAGE);

  const handleFilter = (filterParams) => {
    setFilters(filterParams);
    setCurrentPage(1); // Reset to first page when filters change
    fetchOrders(filterParams);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
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
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-emerald-100 hover:bg-gray-50 dark:hover:bg-emerald-500/10 transition-all active:scale-95 sm:hidden"
          >
            <FaFilter className="h-4 w-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </button>
          <button
            onClick={handleDownloadExcel}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-emerald-100 hover:bg-gray-50 dark:hover:bg-emerald-500/10 transition-all active:scale-95"
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
      <div className={`relative bg-white dark:bg-[#111916] rounded-2xl border border-gray-200/60 dark:border-emerald-900/20 shadow-soft dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] overflow-hidden transition-all duration-300 ${showFilters ? "opacity-100" : "opacity-0 h-0 sm:opacity-100 sm:h-auto"}`}>
        {/* Ambient glow */}
        <div className="hidden dark:block absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-center justify-between border-b border-gray-100 dark:border-emerald-900/20 px-5 py-4">
          <h2 className="section-title flex items-center gap-2">
            <FaFilter className="w-4 h-4 text-gray-400 dark:text-emerald-500/50" />
            Filter Orders
          </h2>
        </div>
        <div className="relative p-4 md:p-5">
          <OrderFilter onFilter={handleFilter} />
        </div>
      </div>

      {/* Orders list */}
      <div className="relative bg-white dark:bg-[#111916] rounded-2xl border border-gray-200/60 dark:border-emerald-900/20 shadow-soft dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] overflow-hidden">
        {/* Ambient glow */}
        <div className="hidden dark:block absolute -top-20 -left-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-center justify-between border-b border-gray-100 dark:border-emerald-900/20 px-5 py-4">
          <h2 className="section-title">All Orders</h2>
          <span className="text-sm text-gray-500 dark:text-emerald-100/60 bg-gray-100 dark:bg-emerald-500/10 px-3 py-1 rounded-full">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
          </span>
        </div>
        <div className="relative p-4 md:p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              </div>
              <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">Loading orders...</p>
            </div>
          ) : (
            <>
              <OrderList orders={paginatedOrders} onDelete={handleDeleteOrder} allOrders={orders} />

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-emerald-900/20">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-emerald-100/60 order-2 sm:order-1">
                    Showing {((currentPage - 1) * ORDERS_PER_PAGE) + 1} - {Math.min(currentPage * ORDERS_PER_PAGE, orders.length)} of {orders.length} orders
                  </p>
                  <div className="flex items-center gap-2 order-1 sm:order-2">
                    <button
                      onClick={goToPrevPage}
                      disabled={currentPage === 1}
                      className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-gray-200 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] text-gray-600 dark:text-emerald-100/70 hover:bg-gray-50 dark:hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <FaChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>

                    {/* Page numbers - hidden on mobile */}
                    <div className="hidden sm:flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                            page === currentPage
                              ? "bg-primary text-white"
                              : "bg-white dark:bg-[#161d1a] border border-gray-200 dark:border-emerald-900/30 text-gray-600 dark:text-emerald-100/70 hover:bg-gray-50 dark:hover:bg-emerald-500/10"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    {/* Mobile page indicator */}
                    <span className="sm:hidden text-sm font-medium text-gray-700 dark:text-emerald-100 min-w-[80px] text-center">
                      {currentPage} / {totalPages}
                    </span>

                    <button
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-gray-200 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] text-gray-600 dark:text-emerald-100/70 hover:bg-gray-50 dark:hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <FaChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
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
