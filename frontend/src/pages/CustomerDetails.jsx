import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { FaArrowLeft, FaPlus } from "react-icons/fa";
import { customerAPI, orderAPI } from "../services/api";
import OrderList from "../components/orders/OrderList";
import Card from "../components/common/Card";
import CustomerInfoCard from "../components/customers/CustomerInfoCard";
import Spinner from "../components/common/Spinner";
import Alert from "../components/common/Alert";
import "./CustomerDetails.css";

const CustomerDetails = () => {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch customer details
        const customerRes = await customerAPI.getById(id);
        setCustomer(customerRes.data.data);

        // Fetch customer orders
        const ordersRes = await orderAPI.getAll({ customerName: customerRes.data.data.name });
        setOrders(ordersRes.data.data);
      } catch (err) {
        console.error("Error fetching customer details:", err);
        setError("Failed to load customer details. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleDeleteOrder = async (orderId) => {
    if (window.confirm("Are you sure you want to delete this order?")) {
      try {
        await orderAPI.delete(orderId);
        setOrders((prev) => prev.filter((order) => order.id !== orderId));
      } catch (err) {
        console.error("Error deleting order:", err);
        setError("Failed to delete order. Please try again.");
      }
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Spinner size="large" />
        <p>Loading customer details...</p>
      </div>
    );
  }

  return (
    <div className="customer-details-page">
      {error && <Alert type="danger" message={error} />}

      <div className="page-header">
        <Link to="/customers" className="back-link">
          <FaArrowLeft /> Back to Customers
        </Link>

        <Link to="/orders/new" className="btn btn-primary">
          <FaPlus /> New Order
        </Link>
      </div>

      <CustomerInfoCard customer={customer} />

      <div className="orders-card">
        <div className="orders-header">Orders for {customer?.name}</div>
        <div className="orders-body">{orders.length > 0 ? <OrderList orders={orders} onDelete={handleDeleteOrder} /> : <p className="no-data">No orders found for this customer.</p>}</div>
      </div>
    </div>
  );
};

export default CustomerDetails;
