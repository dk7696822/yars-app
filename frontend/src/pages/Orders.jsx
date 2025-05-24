import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaExclamationCircle } from "react-icons/fa";
import { orderAPI } from "../services/api";
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

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <FaExclamationCircle className="text-red-500 mt-0.5 mr-3 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Orders</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/orders/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <FaPlus className="mr-2 h-4 w-4" /> New Order
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden ring-1 ring-black ring-opacity-5">
        <div className="border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">Filter Orders</h2>
        </div>
        <div className="p-4 sm:p-6">
          <OrderFilter onFilter={handleFilter} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden ring-1 ring-black ring-opacity-5">
        <div className="border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">Orders</h2>
        </div>
        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="mt-4 text-gray-500 dark:text-gray-400">Loading orders...</p>
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
