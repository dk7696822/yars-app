import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaPlus } from "react-icons/fa";
import { orderAPI } from "../services/api";
import { formatDateForAPI } from "../utils/formatters";
import OrderFilter from "../components/orders/OrderFilter";
import OrderList from "../components/orders/OrderList";
import Card from "../components/common/Card";
import Spinner from "../components/common/Spinner";
import Alert from "../components/common/Alert";
import ConfirmationModal from "../components/common/ConfirmationModal";
import "./Orders.css";

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
      setOrders(response.data.data);
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
    <div className="orders-page">
      {error && <Alert type="danger" message={error} />}

      <div className="page-actions">
        <Link to="/orders/new" className="btn">
          <FaPlus /> New Order
        </Link>
      </div>

      <OrderFilter onFilter={handleFilter} />

      <Card title="Orders">
        {loading ? (
          <div className="loading-container">
            <Spinner size="large" />
            <p>Loading orders...</p>
          </div>
        ) : (
          <OrderList orders={orders} onDelete={handleDeleteOrder} />
        )}
      </Card>

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
