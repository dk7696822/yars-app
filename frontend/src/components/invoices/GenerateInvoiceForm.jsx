import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { FaSave, FaTimes } from "react-icons/fa";
import DatePicker from "react-datepicker";
import Dropdown from "../ui/Dropdown";
import Alert from "../common/Alert";
import Spinner from "../common/Spinner";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { orderAPI } from "../../services/api";
import "react-datepicker/dist/react-datepicker.css";

const GenerateInvoiceForm = ({ customers, onSubmit, onCancel, isLoading }) => {
  const [formData, setFormData] = useState({
    customer_id: "",
    order_ids: [],
    billing_period_start: new Date(),
    billing_period_end: new Date(),
    payment_due_date: new Date(new Date().setDate(new Date().getDate() + 30)),
    tax_percent: 0,
  });
  const [availableOrders, setAvailableOrders] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Reset available orders when customer changes
    if (formData.customer_id) {
      const customer = customers.find((c) => c.id === formData.customer_id);
      setSelectedCustomer(customer);

      // Fetch unbilled orders for this customer
      const fetchUnbilledOrders = async () => {
        try {
          const response = await orderAPI.getAll({
            customer_id: formData.customer_id,
            invoice_id: "null", // Special parameter to get orders without invoice_id
          });

          if (response.data && response.data.data) {
            // Calculate total receivable for each order
            const ordersWithTotal = response.data.data.map((order) => {
              let productAmount = 0;

              // Calculate product amount
              if (order.orderProductSizes) {
                for (const item of order.orderProductSizes) {
                  const itemTotal = parseFloat(item.quantity_kg) * parseFloat(item.rate_per_kg);
                  productAmount += itemTotal;
                }
              }

              // Add plate charge
              const plateCharge = order.plateType ? parseFloat(order.plateType.charge) : 0;

              // Subtract advance
              const advanceReceived = parseFloat(order.advance_received || 0);

              // Calculate total receivable
              const totalReceivable = productAmount + plateCharge - advanceReceived;

              return {
                ...order,
                totalReceivable,
              };
            });

            setAvailableOrders(ordersWithTotal);
          } else {
            setAvailableOrders([]);
          }
        } catch (error) {
          console.error("Error fetching unbilled orders:", error);
          setAvailableOrders([]);
        }
      };

      fetchUnbilledOrders();
      setFormData((prev) => ({ ...prev, order_ids: [] }));
    } else {
      setSelectedCustomer(null);
      setAvailableOrders([]);
    }
  }, [formData.customer_id, customers]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDateChange = (date, field) => {
    setFormData((prev) => ({
      ...prev,
      [field]: date,
    }));
  };

  const handleOrderSelection = (orderId) => {
    setFormData((prev) => {
      const orderIds = [...prev.order_ids];

      if (orderIds.includes(orderId)) {
        // Remove order if already selected
        return {
          ...prev,
          order_ids: orderIds.filter((id) => id !== orderId),
        };
      } else {
        // Add order if not selected
        return {
          ...prev,
          order_ids: [...orderIds, orderId],
        };
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.customer_id) {
      setError("Please select a customer");
      return;
    }

    if (!formData.order_ids.length) {
      setError("Please select at least one order");
      return;
    }

    onSubmit(formData);
  };

  return (
    <div className="generate-invoice-form">
      {error && <Alert type="danger" message={error} />}

      <form onSubmit={handleSubmit}>
        <div className="form-row grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="form-group">
            <label htmlFor="customer_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Customer *
            </label>
            <Dropdown
              id="customer_id"
              name="customer_id"
              value={formData.customer_id}
              onChange={handleChange}
              placeholder="Select Customer"
              required
              options={[
                { value: "", label: "Select Customer" },
                ...customers.map((customer) => ({
                  value: customer.id,
                  label: customer.name,
                })),
              ]}
            />
          </div>

          <div className="form-group">
            <label htmlFor="tax_percent" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tax Percentage (%)
            </label>
            <input
              type="number"
              id="tax_percent"
              name="tax_percent"
              value={formData.tax_percent}
              onChange={handleChange}
              min="0"
              max="100"
              step="0.01"
              className="block w-full p-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>

        <div className="form-row grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="form-group">
            <label htmlFor="billing_period_start" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Billing Period Start *
            </label>
            <DatePicker
              id="billing_period_start"
              selected={formData.billing_period_start}
              onChange={(date) => handleDateChange(date, "billing_period_start")}
              selectsStart
              startDate={formData.billing_period_start}
              endDate={formData.billing_period_end}
              className="block w-full p-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              dateFormat="dd/MM/yyyy"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="billing_period_end" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Billing Period End *
            </label>
            <DatePicker
              id="billing_period_end"
              selected={formData.billing_period_end}
              onChange={(date) => handleDateChange(date, "billing_period_end")}
              selectsEnd
              startDate={formData.billing_period_start}
              endDate={formData.billing_period_end}
              minDate={formData.billing_period_start}
              className="block w-full p-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              dateFormat="dd/MM/yyyy"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="payment_due_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Due Date
            </label>
            <DatePicker
              id="payment_due_date"
              selected={formData.payment_due_date}
              onChange={(date) => handleDateChange(date, "payment_due_date")}
              minDate={new Date()}
              className="block w-full p-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              dateFormat="dd/MM/yyyy"
            />
          </div>
        </div>

        {selectedCustomer && (
          <div className="orders-section mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Select Orders to Include</h3>

            {availableOrders.length === 0 ? (
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md">
                <p className="text-gray-500 dark:text-gray-400">No unbilled orders found for this customer. Please create orders first.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {availableOrders.map((order) => (
                  <div
                    key={order.id}
                    className={`p-4 rounded-md border cursor-pointer transition-colors ${
                      formData.order_ids.includes(order.id) ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    }`}
                    onClick={() => handleOrderSelection(order.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">Order Date: {formatDate(order.order_date)}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Items: {order.orderProductSizes.length}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(order.totalReceivable)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="form-actions flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            <FaTimes className="inline mr-2" /> Cancel
          </button>

          <button
            type="submit"
            disabled={isLoading || !formData.customer_id || formData.order_ids.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Spinner size="small" color="white" /> Generating...
              </>
            ) : (
              <>
                <FaSave className="inline mr-2" /> Generate Invoice
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

GenerateInvoiceForm.propTypes = {
  customers: PropTypes.array.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

GenerateInvoiceForm.defaultProps = {
  isLoading: false,
};

export default GenerateInvoiceForm;
