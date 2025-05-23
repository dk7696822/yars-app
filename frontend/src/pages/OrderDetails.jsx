import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaEdit, FaFileInvoice } from "react-icons/fa";
import { orderAPI, paymentAPI } from "../services/api";
import OrderPaymentSummary from "../components/payments/OrderPaymentSummary";
import PaymentForm from "../components/payments/PaymentForm";
import Card from "../components/common/Card";
import Spinner from "../components/common/Spinner";
import Alert from "../components/common/Alert";
import Modal from "../components/common/Modal";
import { formatCurrency, formatDate } from "../utils/formatters";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../components/ui/Table";

const OrderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState("");

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
    setPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (paymentData) => {
    try {
      setPaymentSubmitting(true);
      setPaymentError("");

      await paymentAPI.create(paymentData);

      // Refresh order data
      const response = await orderAPI.getById(id);
      setOrder(response.data.data);

      setPaymentModalOpen(false);
    } catch (err) {
      console.error("Error recording payment:", err);
      setPaymentError(err.response?.data?.message || "Failed to record payment. Please try again.");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="large" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <Alert type="danger" message={error || "Order not found"} />
        <div className="mt-4">
          <Link to="/orders" className="text-blue-500 hover:underline">
            &larr; Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  // Calculate total product amount
  const totalProductAmount = order.orderProductSizes.reduce((sum, item) => {
    return sum + parseFloat(item.quantity_kg) * parseFloat(item.rate_per_kg || item.productSize.rate_per_kg);
  }, 0);

  return (
    <div className="order-details-page">
      <div className="page-header flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link to="/orders" className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
            <FaArrowLeft />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Order Details</h1>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => navigate(`/orders/edit/${id}`)} className="flex items-center gap-2">
            <FaEdit /> Edit Order
          </Button>
          {!order.invoice_id && (
            <Button variant="primary" onClick={() => navigate(`/invoices/generate?order_id=${id}`)} className="flex items-center gap-2">
              <FaFileInvoice /> Generate Invoice
            </Button>
          )}
        </div>
      </div>

      {error && <Alert type="danger" message={error} />}

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Customer Information</h3>
            <p className="text-gray-700 dark:text-gray-300">
              <strong>Name:</strong> {order.customer.name}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              <strong>Phone:</strong> {order.customer.metadata?.phone || "N/A"}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              <strong>Email:</strong> {order.customer.metadata?.email || "N/A"}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              <strong>Address:</strong> {order.customer.metadata?.address || "N/A"}
            </p>
          </div>
          <div>
            <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Order Information</h3>
            <p className="text-gray-700 dark:text-gray-300">
              <strong>Order Date:</strong> {formatDate(order.order_date)}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              <strong>Status:</strong> <Badge variant={order.status === "COMPLETED" ? "success" : order.status === "IN_PROGRESS" ? "warning" : "secondary"}>{order.status.replace("_", " ")}</Badge>
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              <strong>Plate Type:</strong> {order.plateType.type_name}
            </p>
            {order.invoice_id && (
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Invoice:</strong>{" "}
                <Link to={`/invoices/${order.invoice_id}`} className="text-blue-500 hover:underline">
                  View Invoice
                </Link>
              </p>
            )}
          </div>
        </div>

        <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Order Items</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Size</TableHead>
                <TableHead>Quantity (kg)</TableHead>
                <TableHead>Rate per kg</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.orderProductSizes.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.productSize.size_label}</TableCell>
                  <TableCell>{item.quantity_kg}</TableCell>
                  <TableCell>{formatCurrency(item.rate_per_kg || item.productSize.rate_per_kg)}</TableCell>
                  <TableCell className="text-right">{formatCurrency((item.rate_per_kg || item.productSize.rate_per_kg) * item.quantity_kg)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/30 dark:bg-gray-700/30">
                <TableCell colSpan={3} className="font-medium">
                  Plate Charge ({order.plateType.type_name})
                </TableCell>
                <TableCell className="text-right">{formatCurrency(order.plateType.charge)}</TableCell>
              </TableRow>
              <TableRow className="bg-primary/5 dark:bg-primary-900/20">
                <TableCell colSpan={3} className="font-bold">
                  Total Order Amount
                </TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(order.total_amount)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>

      <OrderPaymentSummary order={order} onAddPayment={handleAddPayment} />

      {/* Payment Modal */}
      <Modal isOpen={paymentModalOpen} title="Record Payment" onClose={() => setPaymentModalOpen(false)} size="md">
        {paymentError && <Alert type="danger" message={paymentError} className="mb-4" />}
        <PaymentForm order={order} onSubmit={handlePaymentSubmit} onCancel={() => setPaymentModalOpen(false)} />
      </Modal>
    </div>
  );
};

export default OrderDetails;
