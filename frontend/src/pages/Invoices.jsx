import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaExclamationCircle } from "react-icons/fa";
import { invoiceAPI, customerAPI } from "../services/api";
import { formatDateForAPI } from "../utils/formatters";
import InvoiceFilter from "../components/invoices/InvoiceFilter";
import InvoiceList from "../components/invoices/InvoiceList";
import ConfirmationModal from "../components/common/ConfirmationModal";
import Card from "../components/common/Card";
import Spinner from "../components/common/Spinner";
import Alert from "../components/common/Alert";

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [invoiceToUpdate, setInvoiceToUpdate] = useState(null);
  const [newStatus, setNewStatus] = useState("");

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await customerAPI.getAll();
        setCustomers(response.data.data);
      } catch (err) {
        console.error("Error fetching customers:", err);
        // Don't set error here as it's not critical for the page
      }
    };

    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async (filterParams = {}) => {
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

      const response = await invoiceAPI.getAll(params);
      setInvoices(response.data.data);
      setError("");
    } catch (err) {
      console.error("Error fetching invoices:", err);
      setError("Failed to load invoices. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = (filterParams) => {
    setFilters(filterParams);
    fetchInvoices(filterParams);
  };

  const handleDeleteClick = (invoiceId) => {
    setInvoiceToDelete(invoiceId);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await invoiceAPI.delete(invoiceToDelete);
      setInvoices((prevInvoices) => prevInvoices.filter((invoice) => invoice.id !== invoiceToDelete));
      setDeleteModalOpen(false);
      setInvoiceToDelete(null);
    } catch (err) {
      console.error("Error deleting invoice:", err);
      setError("Failed to delete invoice. Please try again later.");
    }
  };

  const handleStatusChangeClick = (invoiceId, status) => {
    setInvoiceToUpdate(invoiceId);
    setNewStatus(status);
    setStatusModalOpen(true);
  };

  const handleStatusChangeConfirm = async () => {
    try {
      await invoiceAPI.updateStatus(invoiceToUpdate, { status: newStatus });
      
      // Update the invoice status in the local state
      setInvoices((prevInvoices) =>
        prevInvoices.map((invoice) =>
          invoice.id === invoiceToUpdate ? { ...invoice, status: newStatus } : invoice
        )
      );
      
      setStatusModalOpen(false);
      setInvoiceToUpdate(null);
      setNewStatus("");
    } catch (err) {
      console.error("Error updating invoice status:", err);
      setError("Failed to update invoice status. Please try again later.");
    }
  };

  return (
    <div className="invoices-page">
      <div className="page-header flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoices</h1>
        
        <Link to="/invoices/generate" className="btn-primary flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          <FaPlus /> Generate Invoice
        </Link>
      </div>
      
      <InvoiceFilter customers={customers} onFilter={handleFilter} />
      
      <Card>
        {error && <Alert type="danger" message={error} />}
        
        {loading ? (
          <div className="flex justify-center items-center p-8">
            <Spinner size="large" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <FaExclamationCircle className="text-gray-400 text-5xl mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">No invoices found. Generate your first invoice to get started.</p>
            <Link to="/invoices/generate" className="btn-primary flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
              <FaPlus /> Generate Invoice
            </Link>
          </div>
        ) : (
          <InvoiceList
            invoices={invoices}
            onDelete={handleDeleteClick}
            onStatusChange={handleStatusChangeClick}
          />
        )}
      </Card>
      
      <ConfirmationModal
        isOpen={deleteModalOpen}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModalOpen(false)}
      />
      
      <ConfirmationModal
        isOpen={statusModalOpen}
        title={`Mark Invoice as ${newStatus}`}
        message={`Are you sure you want to mark this invoice as ${newStatus}?`}
        confirmText="Yes, Update Status"
        cancelText="Cancel"
        onConfirm={handleStatusChangeConfirm}
        onCancel={() => setStatusModalOpen(false)}
      />
    </div>
  );
};

export default Invoices;
