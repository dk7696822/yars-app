import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaEdit, FaFileInvoice, FaExclamationCircle, FaUser, FaClipboardList, FaBox, FaPhone, FaEnvelope, FaMapMarkerAlt, FaCalendarAlt, FaLayerGroup } from "react-icons/fa";
import { orderAPI, paymentAPI } from "../services/api";
import OrderPaymentSummary from "../components/payments/OrderPaymentSummary";
import PaymentForm from "../components/payments/PaymentForm";
import Modal from "../components/common/Modal";
import { formatCurrency, formatDate } from "../utils/formatters";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";

const OrderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [editingPayment, setEditingPayment] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const response = await orderAPI.getById(id);
        setOrder(response.data.data);
        setError("");
      } catch (err) {
        console.error("Error fetching order:", err);
        setError("Failed to load order. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  const handleAddPayment = () => {
    setPaymentError("");
    setEditingPayment(null);
    setIsEditMode(false);
    setPaymentModalOpen(true);
  };

  const handleEditPayment = (payment) => {
    setPaymentError("");
    setEditingPayment(payment);
    setIsEditMode(true);
    setPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (paymentData) => {
    try {
      setPaymentSubmitting(true);
      setPaymentError("");

      if (isEditMode && editingPayment) {
        await paymentAPI.update(editingPayment.id, paymentData);
      } else {
        await paymentAPI.create(paymentData);
      }

      // Refresh order data
      const response = await orderAPI.getById(id);
      setOrder(response.data.data);

      setPaymentModalOpen(false);
      setEditingPayment(null);
      setIsEditMode(false);
    } catch (err) {
      console.error("Error saving payment:", err);
      setPaymentError(err.response?.data?.message || "Failed to save payment. Please try again.");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handlePaymentCancel = () => {
    setPaymentModalOpen(false);
    setEditingPayment(null);
    setIsEditMode(false);
    setPaymentError("");
  };

  const handleDeletePayment = (paymentId) => {
    const payment = order.payments.find((p) => p.id === paymentId);
    setPaymentToDelete(payment);
    setDeleteConfirmOpen(true);
  };

  const confirmDeletePayment = async () => {
    if (!paymentToDelete) return;

    try {
      await paymentAPI.delete(paymentToDelete.id);

      const response = await orderAPI.getById(id);
      setOrder(response.data.data);

      setDeleteConfirmOpen(false);
      setPaymentToDelete(null);
    } catch (err) {
      console.error("Error deleting payment:", err);
      setError("Failed to delete payment. Please try again.");
    }
  };

  const cancelDeletePayment = () => {
    setDeleteConfirmOpen(false);
    setPaymentToDelete(null);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex flex-col items-center justify-center py-24">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-gray-200 dark:border-emerald-900/30" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-t-primary dark:border-t-emerald-400 animate-spin" />
          </div>
          <p className="mt-4 text-gray-500 dark:text-emerald-100/60 text-sm">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page-container space-y-5">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-start gap-3">
          <FaExclamationCircle className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error || "Order not found"}</p>
        </div>
        <Link to="/orders" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
          <FaArrowLeft className="w-3 h-3" /> Back to Orders
        </Link>
      </div>
    );
  }

  // Calculate total product amount
  const totalProductAmount = order.orderProductSizes.reduce((sum, item) => {
    return sum + parseFloat(item.quantity_kg) * parseFloat(item.rate_per_kg || item.productSize.rate_per_kg);
  }, 0);

  return (
    <div className="page-container space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/orders"
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] text-gray-600 dark:text-emerald-100/70 hover:bg-gray-50 dark:hover:bg-emerald-500/10 transition-all"
          >
            <FaArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="page-title">Order Details</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
              Order for {order.customer.name}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/orders/edit/${id}`)} className="flex items-center gap-2">
            <FaEdit className="w-4 h-4" /> <span className="hidden sm:inline">Edit</span> Order
          </Button>
          {!order.invoice_id && (
            <Button variant="primary" onClick={() => navigate(`/invoices/generate?order_id=${id}`)} className="flex items-center gap-2">
              <FaFileInvoice className="w-4 h-4" /> <span className="hidden sm:inline">Generate</span> Invoice
            </Button>
          )}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-start gap-3">
          <FaExclamationCircle className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Customer & Order Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        {/* Customer Information */}
        <div className="relative bg-white dark:bg-[#111916] rounded-2xl border border-gray-200/60 dark:border-emerald-900/20 shadow-soft dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] overflow-hidden">
          <div className="hidden dark:block absolute -top-16 -right-16 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative p-4 sm:p-5 border-b border-gray-100 dark:border-emerald-900/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <FaUser className="w-4 h-4" />
              </div>
              <h3 className="text-base font-display font-semibold text-gray-900 dark:text-gray-100">Customer Information</h3>
            </div>
          </div>
          <div className="relative p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#1a2320] flex items-center justify-center">
                <FaUser className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Name</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{order.customer.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#1a2320] flex items-center justify-center">
                <FaPhone className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Phone</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{order.customer.metadata?.phone || <span className="text-gray-400 dark:text-gray-500">N/A</span>}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#1a2320] flex items-center justify-center">
                <FaEnvelope className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Email</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{order.customer.metadata?.email || <span className="text-gray-400 dark:text-gray-500">N/A</span>}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#1a2320] flex items-center justify-center">
                <FaMapMarkerAlt className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Address</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{order.customer.metadata?.address || <span className="text-gray-400 dark:text-gray-500">N/A</span>}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Order Information */}
        <div className="relative bg-white dark:bg-[#111916] rounded-2xl border border-gray-200/60 dark:border-emerald-900/20 shadow-soft dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] overflow-hidden">
          <div className="hidden dark:block absolute -top-16 -left-16 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative p-4 sm:p-5 border-b border-gray-100 dark:border-emerald-900/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <FaClipboardList className="w-4 h-4" />
              </div>
              <h3 className="text-base font-display font-semibold text-gray-900 dark:text-gray-100">Order Information</h3>
            </div>
          </div>
          <div className="relative p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#1a2320] flex items-center justify-center">
                <FaCalendarAlt className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Order Date</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatDate(order.order_date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#1a2320] flex items-center justify-center">
                <FaClipboardList className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Status</p>
                <Badge variant={order.status === "COMPLETED" ? "success" : order.status === "IN_PROGRESS" ? "warning" : "secondary"}>
                  {order.status.replace("_", " ")}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#1a2320] flex items-center justify-center">
                <FaLayerGroup className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Plate Type</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{order.plateType.type_name}</p>
              </div>
            </div>
            {order.invoice_id && (
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#1a2320] flex items-center justify-center">
                  <FaFileInvoice className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Invoice</p>
                  <Link to={`/invoices/${order.invoice_id}`} className="text-sm font-medium text-primary dark:text-emerald-400 hover:text-primary-700 dark:hover:text-emerald-300 transition-colors">
                    View Invoice →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="relative bg-white dark:bg-[#111916] rounded-2xl border border-gray-200/60 dark:border-emerald-900/20 shadow-soft dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] overflow-hidden">
        <div className="hidden dark:block absolute -top-20 -right-20 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative p-4 sm:p-5 border-b border-gray-100 dark:border-emerald-900/20">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <FaBox className="w-4 h-4" />
            </div>
            <h3 className="text-base font-display font-semibold text-gray-900 dark:text-gray-100">Order Items</h3>
          </div>
        </div>
        <div className="relative p-4 md:p-5">
          {/* Mobile Card View for Order Items */}
          <div className="block md:hidden space-y-3">
            {order.orderProductSizes.map((item) => (
              <div key={item.id} className="bg-gray-50 dark:bg-[#161d1a] rounded-xl p-4 border border-gray-200/50 dark:border-emerald-900/20">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{item.productSize.size_label}</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency((item.rate_per_kg || item.productSize.rate_per_kg) * item.quantity_kg)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>{item.quantity_kg} kg × {formatCurrency(item.rate_per_kg || item.productSize.rate_per_kg)}/kg</span>
                </div>
              </div>
            ))}
            {/* Plate Charge */}
            <div className="bg-gray-100 dark:bg-[#1a2320] rounded-xl p-4 border border-gray-200/50 dark:border-emerald-900/20">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Plate Charge ({order.plateType.type_name})
                  {order.custom_plate_charge && <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">(Custom)</span>}
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(order.custom_plate_charge || order.plateType.charge)}</span>
              </div>
            </div>
            {/* Round Off */}
            {order.round_off_amount && parseFloat(order.round_off_amount) !== 0 && (
              <div className="bg-orange-50 dark:bg-orange-500/10 rounded-xl p-4 border border-orange-200/50 dark:border-orange-500/20">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-orange-700 dark:text-orange-400">Round Off</span>
                  <span className="font-medium text-orange-700 dark:text-orange-400">-{formatCurrency(Math.abs(parseFloat(order.round_off_amount)))}</span>
                </div>
              </div>
            )}
            {/* Total */}
            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-4 border border-emerald-200/50 dark:border-emerald-500/20">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900 dark:text-gray-100">Total Order Amount</span>
                <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-xl">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-[#161d1a]">
                  <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-emerald-900/30">Product Size</th>
                  <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-emerald-900/30">Quantity (kg)</th>
                  <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-emerald-900/30">Rate per kg</th>
                  <th className="h-12 px-4 text-right align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-emerald-900/30">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-emerald-900/20">
                {order.orderProductSizes.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-emerald-500/5 transition-colors">
                    <td className="p-4 align-middle font-medium text-gray-900 dark:text-gray-100">{item.productSize.size_label}</td>
                    <td className="p-4 align-middle text-gray-700 dark:text-gray-300">{item.quantity_kg}</td>
                    <td className="p-4 align-middle text-gray-700 dark:text-gray-300">{formatCurrency(item.rate_per_kg || item.productSize.rate_per_kg)}</td>
                    <td className="p-4 align-middle text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency((item.rate_per_kg || item.productSize.rate_per_kg) * item.quantity_kg)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50/80 dark:bg-[#161d1a]">
                  <td colSpan={3} className="p-4 align-middle font-medium text-gray-700 dark:text-gray-300">
                    Plate Charge ({order.plateType.type_name}){order.custom_plate_charge && <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">(Custom)</span>}
                  </td>
                  <td className="p-4 align-middle text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(order.custom_plate_charge || order.plateType.charge)}</td>
                </tr>
                {order.round_off_amount && parseFloat(order.round_off_amount) !== 0 && (
                  <tr className="bg-orange-50 dark:bg-orange-500/10">
                    <td colSpan={3} className="p-4 align-middle font-medium text-orange-700 dark:text-orange-400">
                      Round Off Amount
                    </td>
                    <td className="p-4 align-middle text-right font-medium text-orange-700 dark:text-orange-400">-{formatCurrency(Math.abs(parseFloat(order.round_off_amount)))}</td>
                  </tr>
                )}
                <tr className="bg-emerald-50 dark:bg-emerald-500/10">
                  <td colSpan={3} className="p-4 align-middle font-bold text-gray-900 dark:text-gray-100">
                    Total Order Amount
                  </td>
                  <td className="p-4 align-middle text-right font-bold text-lg text-emerald-600 dark:text-emerald-400">{formatCurrency(order.total_amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <OrderPaymentSummary order={order} onAddPayment={handleAddPayment} onEditPayment={handleEditPayment} onDeletePayment={handleDeletePayment} />

      {/* Payment Modal */}
      <Modal isOpen={paymentModalOpen} title={isEditMode ? "Edit Payment" : "Record Payment"} onClose={handlePaymentCancel} size="md">
        {paymentError && <Alert type="danger" message={paymentError} className="mb-4" />}
        <PaymentForm payment={editingPayment} order={order} onSubmit={handlePaymentSubmit} onCancel={handlePaymentCancel} isEditing={isEditMode} />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteConfirmOpen} title="Delete Payment" onClose={cancelDeletePayment} size="sm">
        <div className="p-4">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Are you sure you want to delete this payment of {paymentToDelete && formatCurrency(paymentToDelete.amount)}? This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-2">
            <Button variant="secondary" onClick={cancelDeletePayment}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeletePayment}>
              Delete Payment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OrderDetails;
