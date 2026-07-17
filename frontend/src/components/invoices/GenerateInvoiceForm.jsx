import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { FaSave, FaTimes, FaExclamationCircle } from "react-icons/fa";
import DatePicker from "react-datepicker";
import Dropdown from "../ui/Dropdown";
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

              // Add plate charge (use custom charge if available, otherwise use plate type charge)
              const plateCharge = order.custom_plate_charge ? parseFloat(order.custom_plate_charge) : order.plateType ? parseFloat(order.plateType.charge) : 0;

              const roundOffAmount = parseFloat(order.round_off_amount || 0);

              // Subtract advance
              const advanceReceived = parseFloat(order.advance_received || 0);

              // Calculate total receivable (including round off)
              const totalReceivable = productAmount + plateCharge - roundOffAmount - advanceReceived;

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
    <div className="generate-invoice-form p-4 sm:p-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-start gap-3 mb-5">
          <FaExclamationCircle className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="customer_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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

          <div>
            <label htmlFor="tax_percent" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
              className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="billing_period_start" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Billing Period Start *
            </label>
            <DatePicker
              id="billing_period_start"
              selected={formData.billing_period_start}
              onChange={(date) => handleDateChange(date, "billing_period_start")}
              selectsStart
              startDate={formData.billing_period_start}
              endDate={formData.billing_period_end}
              className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              dateFormat="dd/MM/yyyy"
              required
              wrapperClassName="w-full"
            />
          </div>

          <div>
            <label htmlFor="billing_period_end" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
              className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              dateFormat="dd/MM/yyyy"
              required
              wrapperClassName="w-full"
            />
          </div>

          <div>
            <label htmlFor="payment_due_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Payment Due Date
            </label>
            <DatePicker
              id="payment_due_date"
              selected={formData.payment_due_date}
              onChange={(date) => handleDateChange(date, "payment_due_date")}
              minDate={new Date()}
              className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              dateFormat="dd/MM/yyyy"
              wrapperClassName="w-full"
            />
          </div>
        </div>

        {selectedCustomer && (
          <div className="orders-section">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Select Orders to Include</h3>

            {availableOrders.length === 0 ? (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400 text-sm">No unbilled orders found for this customer. Please create orders first.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableOrders.map((order) => (
                  <div
                    key={order.id}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all active:scale-[0.98] ${
                      formData.order_ids.includes(order.id)
                        ? "bg-primary/5 dark:bg-primary/10 border-primary shadow-sm"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    onClick={() => handleOrderSelection(order.id)}
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                          Order Date: {formatDate(order.order_date)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Items: {order.orderProductSizes.length}</p>
                      </div>
                      <div className="sm:text-right">
                        <p className="font-semibold text-primary dark:text-primary-400 text-base sm:text-lg">
                          {formatCurrency(order.totalReceivable)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-5 mt-5 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all min-h-[48px]"
          >
            <FaTimes className="w-4 h-4" /> Cancel
          </button>

          <button
            type="submit"
            disabled={isLoading || !formData.customer_id || formData.order_ids.length === 0}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl bg-primary text-white font-semibold shadow-lg shadow-primary/25 hover:bg-primary-700 hover:shadow-xl hover:shadow-primary/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed min-h-[48px]"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FaSave className="w-4 h-4" /> Generate Invoice
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
