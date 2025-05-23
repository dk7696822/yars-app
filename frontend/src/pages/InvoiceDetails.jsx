import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { invoiceAPI, paymentAPI } from "../services/api";
import InvoiceDetailsComponent from "../components/invoices/InvoiceDetails";
import PaymentForm from "../components/payments/PaymentForm";
import Card from "../components/common/Card";
import Spinner from "../components/common/Spinner";
import Alert from "../components/common/Alert";
import ConfirmationModal from "../components/common/ConfirmationModal";
import Modal from "../components/common/Modal";

const InvoiceDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        setLoading(true);
        const response = await invoiceAPI.getById(id);
        setInvoice(response.data.data);
        setError("");
      } catch (err) {
        console.error("Error fetching invoice:", err);
        setError("Failed to load invoice. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id]);

  const handleStatusChange = (invoiceId, status) => {
    setNewStatus(status);
    setStatusModalOpen(true);
  };

  const handleStatusChangeConfirm = async () => {
    try {
      await invoiceAPI.updateStatus(id, { status: newStatus });

      // Update the invoice status in the local state
      setInvoice((prevInvoice) => ({
        ...prevInvoice,
        status: newStatus,
      }));

      setStatusModalOpen(false);
      setNewStatus("");
    } catch (err) {
      console.error("Error updating invoice status:", err);
      setError("Failed to update invoice status. Please try again later.");
    }
  };

  const handleAddPayment = () => {
    setPaymentError("");
    setPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (paymentData) => {
    try {
      setPaymentSubmitting(true);
      setPaymentError("");

      // Add invoice_id to payment data
      const data = {
        ...paymentData,
        invoice_id: id,
      };

      await paymentAPI.create(data);

      // Refresh invoice data
      const response = await invoiceAPI.getById(id);
      setInvoice(response.data.data);

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

  return (
    <div className="invoice-details-page">
      <div className="page-header flex items-center mb-6">
        <Link to="/invoices" className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
          <FaArrowLeft />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoice Details</h1>
      </div>

      {error && <Alert type="danger" message={error} />}

      <Card>
        <InvoiceDetailsComponent invoice={invoice} onStatusChange={handleStatusChange} onAddPayment={handleAddPayment} />
      </Card>

      {/* Status Change Confirmation Modal */}
      <ConfirmationModal
        isOpen={statusModalOpen}
        title={`Mark Invoice as ${newStatus}`}
        message={`Are you sure you want to mark this invoice as ${newStatus}?`}
        confirmText="Yes, Update Status"
        cancelText="Cancel"
        onConfirm={handleStatusChangeConfirm}
        onCancel={() => setStatusModalOpen(false)}
      />

      {/* Payment Modal */}
      <Modal isOpen={paymentModalOpen} title="Record Payment" onClose={() => setPaymentModalOpen(false)} size="md">
        {paymentError && <Alert type="danger" message={paymentError} className="mb-4" />}
        <PaymentForm invoice={invoice} onSubmit={handlePaymentSubmit} onCancel={() => setPaymentModalOpen(false)} />
      </Modal>
    </div>
  );
};

export default InvoiceDetails;
