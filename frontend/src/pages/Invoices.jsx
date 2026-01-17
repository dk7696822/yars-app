import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaExclamationCircle, FaFileInvoiceDollar, FaFilter, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { invoiceAPI, customerAPI } from "../services/api";
import { formatDateForAPI } from "../utils/formatters";
import InvoiceFilter from "../components/invoices/InvoiceFilter";
import InvoiceList from "../components/invoices/InvoiceList";
import ConfirmationModal from "../components/common/ConfirmationModal";

const INVOICES_PER_PAGE = 10;

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
  const [currentPage, setCurrentPage] = useState(1);

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

  // Calculate paginated invoices
  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * INVOICES_PER_PAGE;
    return invoices.slice(startIndex, startIndex + INVOICES_PER_PAGE);
  }, [invoices, currentPage]);

  const totalPages = Math.ceil(invoices.length / INVOICES_PER_PAGE);

  const handleFilter = (filterParams) => {
    setFilters(filterParams);
    setCurrentPage(1); // Reset to first page when filters change
    fetchInvoices(filterParams);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
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
      <div className="relative bg-white dark:bg-[#111916] rounded-2xl border border-gray-200/60 dark:border-emerald-900/20 shadow-soft dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] overflow-hidden">
        {/* Ambient glow */}
        <div className="hidden dark:block absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-center justify-between border-b border-gray-100 dark:border-emerald-900/20 px-5 py-4">
          <h2 className="section-title flex items-center gap-2">
            <FaFilter className="w-4 h-4 text-gray-400 dark:text-emerald-500/50" />
            Filter Invoices
          </h2>
        </div>
        <div className="relative p-4 md:p-5">
          <InvoiceFilter customers={customers} onFilter={handleFilter} />
        </div>
      </div>

      {/* Invoices list */}
      <div className="relative bg-white dark:bg-[#111916] rounded-2xl border border-gray-200/60 dark:border-emerald-900/20 shadow-soft dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] overflow-hidden">
        {/* Ambient glow */}
        <div className="hidden dark:block absolute -top-20 -left-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="hidden dark:block absolute -bottom-20 -right-20 w-48 h-48 bg-emerald-500/3 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 dark:border-emerald-900/20 px-4 sm:px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <FaFileInvoiceDollar className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-display font-semibold text-gray-900 dark:text-emerald-50">All Invoices</h2>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-emerald-100/60">
                {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}
              </p>
            </div>
          </div>
        </div>
        <div className="relative p-4 md:p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-primary/20 dark:border-primary/30 border-t-primary animate-spin" />
              </div>
              <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">Loading invoices...</p>
            </div>
          ) : invoices.length > 0 ? (
            <>
              <InvoiceList
                invoices={paginatedInvoices}
                onDelete={handleDeleteClick}
                onStatusChange={handleStatusChangeClick}
              />

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-emerald-900/20">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-emerald-100/60 order-2 sm:order-1">
                    Showing {((currentPage - 1) * INVOICES_PER_PAGE) + 1} - {Math.min(currentPage * INVOICES_PER_PAGE, invoices.length)} of {invoices.length} invoices
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
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FaFileInvoiceDollar className="w-8 h-8 text-blue-500 dark:text-blue-400/60" />
              </div>
              <h3 className="text-gray-900 dark:text-gray-100 font-medium mb-1">No invoices found</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                Generate your first invoice to get started.
              </p>
              <Link
                to="/invoices/generate"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary dark:text-blue-400 hover:text-primary-700 dark:hover:text-blue-300 transition-colors"
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
