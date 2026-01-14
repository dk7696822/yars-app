import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaPlus, FaSearch, FaExclamationCircle, FaCheckCircle, FaUsers } from "react-icons/fa";
import { customerAPI } from "../services/api";
import CustomerList from "../components/customers/CustomerList";
import ConfirmationModal from "../components/common/ConfirmationModal";

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
  }, [searchTerm, customers]);

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
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 shadow-soft overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="section-title">All Customers</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({filteredCustomers.length})
            </span>
          </div>
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400">
              <FaSearch className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-11 pr-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>
        <div className="p-4 md:p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              </div>
              <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">Loading customers...</p>
            </div>
          ) : filteredCustomers.length > 0 ? (
            <CustomerList customers={filteredCustomers} onDelete={handleDelete} />
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FaUsers className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-medium mb-1">
                {searchTerm ? "No customers found" : "No customers yet"}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                {searchTerm ? "Try adjusting your search terms" : "Add your first customer to get started."}
              </p>
              {!searchTerm && (
                <Link
                  to="/customers/new"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-700"
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
