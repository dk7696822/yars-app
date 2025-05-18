import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaPlus, FaSearch } from "react-icons/fa";
import { customerAPI } from "../services/api";
import CustomerList from "../components/customers/CustomerList";
import Card from "../components/common/Card";
import Spinner from "../components/common/Spinner";
import Alert from "../components/common/Alert";
import ConfirmationModal from "../components/common/ConfirmationModal";
import "./Customers.css";

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
    <div className="customers-page">
      {error && <Alert type="danger" message={error} />}
      {successMessage && <Alert type="success" message={successMessage} />}

      <div className="page-header">
        <div className="search-container">
          <div className="search-input-container">
            <FaSearch className="search-icon" />
            <input type="text" placeholder="Search customers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
          </div>
        </div>

        <Link to="/customers/new" className="btn">
          <FaPlus /> New Customer
        </Link>
      </div>

      <Card title="Customers">
        {loading ? (
          <div className="loading-container">
            <Spinner size="large" />
            <p>Loading customers...</p>
          </div>
        ) : (
          <CustomerList customers={filteredCustomers} onDelete={handleDelete} />
        )}
      </Card>

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
