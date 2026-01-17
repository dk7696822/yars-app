import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaPlus, FaSearch, FaExclamationCircle, FaCheckCircle, FaUsers, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { customerAPI } from "../services/api";
import CustomerList from "../components/customers/CustomerList";
import ConfirmationModal from "../components/common/ConfirmationModal";

const CUSTOMERS_PER_PAGE = 10;

const Customers = () => {
  const location = useLocation();
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    // Check for success message in location state
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Clear the message after 3 seconds
      const timer = setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const response = await customerAPI.getAll();
        setCustomers(response.data.data);
        setFilteredCustomers(response.data.data);
      } catch (err) {
        console.error("Error fetching customers:", err);
        setError("Failed to load customers. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredCustomers(customers);
    } else {
      const filtered = customers.filter((customer) => customer.name.toLowerCase().includes(searchTerm.toLowerCase()));
      setFilteredCustomers(filtered);
    }
    setCurrentPage(1); // Reset to first page when search changes
  }, [searchTerm, customers]);

  // Calculate paginated customers
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * CUSTOMERS_PER_PAGE;
    return filteredCustomers.slice(startIndex, startIndex + CUSTOMERS_PER_PAGE);
  }, [filteredCustomers, currentPage]);

  const totalPages = Math.ceil(filteredCustomers.length / CUSTOMERS_PER_PAGE);

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleDelete = (id) => {
    // Find the customer to show its details in the confirmation modal
    const customer = customers.find((c) => c.id === id);
    setCustomerToDelete(customer);
    setShowDeleteModal(true);
  };

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return;

    try {
      await customerAPI.delete(customerToDelete.id);
      setCustomers((prev) => prev.filter((customer) => customer.id !== customerToDelete.id));
      setSuccessMessage("Customer deleted successfully");
    } catch (err) {
      console.error("Error deleting customer:", err);
      setError("Failed to delete customer. Please try again.");
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

      {/* Success alert */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <FaCheckCircle className="text-green-500 mt-0.5 flex-shrink-0" />
          <p className="text-green-700 dark:text-green-400 text-sm">{successMessage}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Manage your customer database
          </p>
        </div>
        <Link
          to="/customers/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95"
        >
          <FaPlus className="h-4 w-4" /> New Customer
        </Link>
      </div>

      {/* Customers list */}
      <div className="relative bg-white dark:bg-[#111916] rounded-2xl border border-gray-200/60 dark:border-emerald-900/20 shadow-soft dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] overflow-hidden">
        {/* Ambient glow */}
        <div className="hidden dark:block absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="hidden dark:block absolute -bottom-20 -left-20 w-48 h-48 bg-emerald-500/3 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 dark:border-emerald-900/20 px-4 sm:px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <FaUsers className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-display font-semibold text-gray-900 dark:text-emerald-50">All Customers</h2>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-emerald-100/60">
                {filteredCustomers.length} {filteredCustomers.length === 1 ? 'customer' : 'customers'}
              </p>
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 dark:text-emerald-500/50">
              <FaSearch className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-11 pr-4 rounded-xl border border-gray-200 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] text-sm text-gray-900 dark:text-emerald-50 placeholder:text-gray-400 dark:placeholder:text-emerald-100/40 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-emerald-500/30 focus:border-primary dark:focus:border-emerald-500/50 transition-all"
            />
          </div>
        </div>
        <div className="relative p-4 md:p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-gray-200 dark:border-emerald-900/30" />
                <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-t-primary dark:border-t-emerald-400 animate-spin" />
              </div>
              <p className="mt-4 text-gray-500 dark:text-emerald-100/60 text-sm">Loading customers...</p>
            </div>
          ) : filteredCustomers.length > 0 ? (
            <>
              <CustomerList customers={paginatedCustomers} onDelete={handleDelete} />

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-emerald-900/20">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-emerald-100/60 order-2 sm:order-1">
                    Showing {((currentPage - 1) * CUSTOMERS_PER_PAGE) + 1} - {Math.min(currentPage * CUSTOMERS_PER_PAGE, filteredCustomers.length)} of {filteredCustomers.length} customers
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
              <div className="w-16 h-16 bg-gray-100 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FaUsers className="w-8 h-8 text-gray-400 dark:text-emerald-400/60" />
              </div>
              <h3 className="text-gray-900 dark:text-gray-100 font-medium mb-1">
                {searchTerm ? "No customers found" : "No customers yet"}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                {searchTerm ? "Try adjusting your search terms" : "Add your first customer to get started."}
              </p>
              {!searchTerm && (
                <Link
                  to="/customers/new"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary dark:text-emerald-400 hover:text-primary-700 dark:hover:text-emerald-300 transition-colors"
                >
                  <FaPlus className="w-3 h-3" /> Add Customer
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteCustomer}
        title="Delete Customer"
        message={customerToDelete ? `Are you sure you want to delete the customer "${customerToDelete.name}"? This action cannot be undone.` : "Are you sure you want to delete this customer?"}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
};

export default Customers;
