import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { customerAPI, orderAPI, invoiceAPI } from "../services/api";
import GenerateInvoiceForm from "../components/invoices/GenerateInvoiceForm";
import Card from "../components/common/Card";
import Alert from "../components/common/Alert";
import Spinner from "../components/common/Spinner";

const GenerateInvoice = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch customers
        const customersRes = await customerAPI.getAll();
        setCustomers(customersRes.data.data);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      setError("");

      // Format dates for API
      const apiData = {
        ...formData,
        billing_period_start: formData.billing_period_start.toISOString().split("T")[0],
        billing_period_end: formData.billing_period_end.toISOString().split("T")[0],
        payment_due_date: formData.payment_due_date ? formData.payment_due_date.toISOString().split("T")[0] : null,
      };

      const response = await invoiceAPI.generate(apiData);

      // Navigate to the invoice details page
      navigate(`/invoices/${response.data.data.id}`);
    } catch (err) {
      console.error("Error generating invoice:", err);
      setError(err.response?.data?.message || "Failed to generate invoice. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/invoices");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="large" />
      </div>
    );
  }

  return (
    <div className="generate-invoice-page">
      <div className="page-header flex items-center mb-6">
        <Link to="/invoices" className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
          <FaArrowLeft />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Generate New Invoice</h1>
      </div>

      <Card>
        {error && <Alert type="danger" message={error} />}

        <GenerateInvoiceForm customers={customers} onSubmit={handleSubmit} onCancel={handleCancel} isLoading={submitting} />
      </Card>
    </div>
  );
};

export default GenerateInvoice;
