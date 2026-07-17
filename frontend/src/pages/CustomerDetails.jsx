import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaEdit, FaUser, FaPhone, FaEnvelope, FaMapMarkerAlt, FaBoxes, FaExclamationCircle } from "react-icons/fa";
import { customerAPI, orderAPI } from "../services/api";
import OrderList from "../components/orders/OrderList";
import ConfirmationModal from "../components/common/ConfirmationModal";
import { useToast } from "../context/ToastContext";
import { formatDate } from "../utils/formatters";

const ContactRow = ({ icon, label, value, href }) => {
  // Local uppercase alias so it can be rendered as a component; the destructured
  // param itself trips this config's no-unused-vars (no eslint-plugin-react).
  const Icon = icon;
  return (
  <div className="flex items-start gap-3">
    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#1a2320] flex items-center justify-center">
      <Icon className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">{label}</p>
      {value ? (
        href ? (
          <a href={href} className="text-sm font-medium text-primary dark:text-emerald-400 hover:underline break-words">
            {value}
          </a>
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{value}</p>
        )
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500">Not provided</p>
      )}
    </div>
  </div>
  );
};

const CustomerDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orderToDelete, setOrderToDelete] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const customerRes = await customerAPI.getById(id);
        setCustomer(customerRes.data.data);

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

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    try {
      await orderAPI.delete(orderToDelete);
      setOrders((prev) => prev.filter((order) => order.id !== orderToDelete));
      toast.success("Order deleted");
    } catch (err) {
      console.error("Error deleting order:", err);
      toast.error("Failed to delete order. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex flex-col items-center justify-center py-24">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-gray-200 dark:border-emerald-900/30" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-t-primary dark:border-t-emerald-400 animate-spin" />
          </div>
          <p className="mt-4 text-gray-500 dark:text-emerald-100/60 text-sm">Loading customer details...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="page-container space-y-5">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-start gap-3">
          <FaExclamationCircle className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error || "Customer not found"}</p>
        </div>
        <Link to="/customers" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
          <FaArrowLeft className="w-3 h-3" /> Back to Customers
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/customers"
            className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] text-gray-600 dark:text-emerald-100/70 hover:bg-gray-50 dark:hover:bg-emerald-500/10 transition-all"
          >
            <FaArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="page-title truncate">{customer.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
              Customer since {formatDate(customer.created_at)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate(`/customers/edit/${id}`)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-emerald-100 hover:bg-gray-50 dark:hover:bg-emerald-500/10 transition-all active:scale-95"
          >
            <FaEdit className="w-4 h-4" /> Edit
          </button>
          <Link
            to="/orders/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 shadow-lg shadow-primary/25 transition-all active:scale-95"
          >
            <FaPlus className="w-4 h-4" /> New Order
          </Link>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-start gap-3">
          <FaExclamationCircle className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Contact card */}
      <div className="relative bg-white dark:bg-[#111916] rounded-2xl border border-gray-200/60 dark:border-emerald-900/20 shadow-soft dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] overflow-hidden">
        <div className="hidden dark:block absolute -top-16 -right-16 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative p-4 sm:p-5 border-b border-gray-100 dark:border-emerald-900/20">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <FaUser className="w-4 h-4" />
            </div>
            <h3 className="text-base font-display font-semibold text-gray-900 dark:text-gray-100">Contact Information</h3>
          </div>
        </div>
        <div className="relative p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <ContactRow
            icon={FaPhone}
            label="Phone"
            value={customer.metadata?.phone}
            href={customer.metadata?.phone ? `tel:${customer.metadata.phone}` : undefined}
          />
          <ContactRow
            icon={FaEnvelope}
            label="Email"
            value={customer.metadata?.email}
            href={customer.metadata?.email ? `mailto:${customer.metadata.email}` : undefined}
          />
          <div className="sm:col-span-2">
            <ContactRow icon={FaMapMarkerAlt} label="Address" value={customer.metadata?.address} />
          </div>
        </div>
      </div>

      {/* Orders */}
      <div className="relative bg-white dark:bg-[#111916] rounded-2xl border border-gray-200/60 dark:border-emerald-900/20 shadow-soft dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] overflow-hidden">
        <div className="hidden dark:block absolute -top-20 -left-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-center justify-between border-b border-gray-100 dark:border-emerald-900/20 px-4 sm:px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <FaBoxes className="w-4 h-4" />
            </div>
            <h3 className="text-base font-display font-semibold text-gray-900 dark:text-gray-100">Orders</h3>
          </div>
          <span className="text-sm text-gray-500 dark:text-emerald-100/60 bg-gray-100 dark:bg-emerald-500/10 px-3 py-1 rounded-full">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
          </span>
        </div>
        <div className="relative p-4 md:p-5">
          {orders.length > 0 ? (
            <OrderList orders={orders} onDelete={setOrderToDelete} />
          ) : (
            <div className="text-center py-10">
              <FaBoxes className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">No orders yet for this customer.</p>
              <Link
                to="/orders/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm shadow-lg shadow-primary/25 hover:bg-primary-700 transition-all active:scale-95"
              >
                <FaPlus className="w-4 h-4" /> Create Order
              </Link>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={orderToDelete !== null}
        onClose={() => setOrderToDelete(null)}
        onConfirm={confirmDeleteOrder}
        title="Delete order"
        message="This will permanently remove the order and its items. This cannot be undone."
        confirmText="Delete"
        cancelText="Keep it"
        type="danger"
      />
    </div>
  );
};

export default CustomerDetails;
