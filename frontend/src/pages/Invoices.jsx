import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaExclamationCircle, FaFileInvoiceDollar, FaFilter } from "react-icons/fa";
import { invoiceAPI, customerAPI } from "../services/api";
import { formatDateForAPI } from "../utils/formatters";
import InvoiceFilter from "../components/invoices/InvoiceFilter";
import InvoiceList from "../components/invoices/InvoiceList";
import ConfirmationModal from "../components/common/ConfirmationModal";

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
          <h1 className="page-title">Invoices</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Generate and manage tax invoices
          </p>
        </div>
        <Link
          to="/invoices/generate"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95"
        >
          <FaPlus className="h-4 w-4" /> Generate Invoice
        </Link>
      </div>

      {/* Filter section */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 shadow-soft overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <h2 className="section-title flex items-center gap-2">
            <FaFilter className="w-4 h-4 text-gray-400" />
            Filter Invoices
          </h2>
        </div>
        <div className="p-4 md:p-5">
          <InvoiceFilter customers={customers} onFilter={handleFilter} />
        </div>
      </div>

      {/* Invoices list */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 shadow-soft overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <h2 className="section-title">All Invoices</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}
          </span>
        </div>
        <div className="p-4 md:p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              </div>
              <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">Loading invoices...</p>
            </div>
          ) : invoices.length > 0 ? (
            <InvoiceList
              invoices={invoices}
              onDelete={handleDeleteClick}
              onStatusChange={handleStatusChangeClick}
            />
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FaFileInvoiceDollar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-medium mb-1">No invoices found</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                Generate your first invoice to get started.
              </p>
              <Link
                to="/invoices/generate"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-700"
              >
                <FaPlus className="w-3 h-3" /> Generate Invoice
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? This action cannot be undone."
        confirmText="Delete"
        type="danger"
      />

      {/* Status Change Confirmation Modal */}
      <ConfirmationModal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        onConfirm={handleStatusChangeConfirm}
        title={`Mark Invoice as ${newStatus}`}
        message={`Are you sure you want to mark this invoice as ${newStatus}?`}
        confirmText="Yes, Update Status"
        type="info"
      />
    </div>
  );
};

export default Invoices;
