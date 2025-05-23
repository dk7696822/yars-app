import { useState, useEffect, forwardRef } from "react";
import PropTypes from "prop-types";
import { FaSave, FaTimes, FaCalendarAlt } from "react-icons/fa";
import DatePicker from "react-datepicker";
import { Button } from "../ui/Button";
import Dropdown from "../ui/Dropdown";
import "react-datepicker/dist/react-datepicker.css";

// Custom DatePicker input component with dark mode support
const CustomDatePickerInput = forwardRef(({ value, onClick, className }, ref) => (
  <div className="relative">
    <input ref={ref} className={`${className} pr-10`} value={value} onClick={onClick} readOnly />
    <FaCalendarAlt className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400" onClick={onClick} />
  </div>
));

CustomDatePickerInput.displayName = "CustomDatePickerInput";

const PaymentForm = ({ payment, invoice, order, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    amount: "",
    payment_date: new Date(),
    payment_method: "CASH",
    payment_type: order ? (invoice ? "PARTIAL" : "ADVANCE") : "PARTIAL",
    reference_number: "",
    notes: "",
  });

  useEffect(() => {
    if (payment) {
      // Edit mode - populate form with payment data
      setFormData({
        amount: payment.amount,
        payment_date: payment.payment_date ? new Date(payment.payment_date) : new Date(),
        payment_method: payment.payment_method || "CASH",
        payment_type: payment.payment_type || "PARTIAL",
        reference_number: payment.reference_number || "",
        notes: payment.notes || "",
      });
    } else if (invoice) {
      // New payment mode with invoice - set default amount to remaining balance
      const remainingBalance = invoice.payment_summary?.remaining_balance || 0;
      setFormData({
        ...formData,
        amount: remainingBalance > 0 ? remainingBalance.toString() : "",
        payment_type: "PARTIAL",
      });
    } else if (order) {
      // New payment mode with order - set default amount to remaining balance
      const remainingBalance = order.payment_summary?.remaining_balance || 0;
      setFormData({
        ...formData,
        amount: remainingBalance > 0 ? remainingBalance.toString() : "",
        payment_type: invoice ? "PARTIAL" : "ADVANCE",
      });
    }
  }, [payment, invoice, order]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date) => {
    setFormData((prev) => ({ ...prev, payment_date: date }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Prepare data for submission
    const paymentData = {
      ...formData,
      amount: parseFloat(formData.amount),
    };

    // Add invoice_id if applicable
    if (payment?.invoice_id || invoice?.id) {
      paymentData.invoice_id = payment?.invoice_id || invoice?.id;
    }

    // Add order_id if applicable
    if (payment?.order_id || order?.id) {
      paymentData.order_id = payment?.order_id || order?.id;
    }

    onSubmit(paymentData);
  };

  const paymentMethods = [
    { value: "CASH", label: "Cash" },
    { value: "BANK_TRANSFER", label: "Bank Transfer" },
    { value: "UPI", label: "UPI" },
    { value: "CHECK", label: "Check" },
    { value: "OTHER", label: "Other" },
  ];

  const paymentTypes = [
    { value: "ADVANCE", label: "Advance Payment" },
    { value: "PARTIAL", label: "Partial Payment" },
    { value: "FINAL", label: "Final Payment" },
    { value: "REFUND", label: "Refund" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="amount" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Amount *
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            value={formData.amount}
            onChange={handleChange}
            className="block w-full p-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="payment_date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Payment Date *
          </label>
          <DatePicker
            id="payment_date"
            selected={formData.payment_date}
            onChange={handleDateChange}
            className="block w-full p-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            dateFormat="dd/MM/yyyy"
            required
            customInput={<CustomDatePickerInput className="block w-full p-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white" />}
            popperClassName="react-datepicker-dark"
            calendarClassName="dark-calendar"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="payment_method" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Payment Method *
          </label>
          <Dropdown id="payment_method" name="payment_method" value={formData.payment_method} onChange={handleChange} options={paymentMethods} required />
        </div>

        <div className="space-y-2">
          <label htmlFor="payment_type" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Payment Type *
          </label>
          <Dropdown id="payment_type" name="payment_type" value={formData.payment_type} onChange={handleChange} options={paymentTypes} required />
        </div>

        <div className="space-y-2">
          <label htmlFor="reference_number" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Reference Number
          </label>
          <input
            id="reference_number"
            name="reference_number"
            type="text"
            value={formData.reference_number}
            onChange={handleChange}
            className="block w-full p-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            placeholder="Transaction ID, Check Number, etc."
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="notes" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="block w-full p-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          placeholder="Additional information about this payment"
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} className="flex items-center gap-2">
          <FaTimes /> Cancel
        </Button>
        <Button type="submit" variant="primary" className="flex items-center gap-2">
          <FaSave /> {payment ? "Update Payment" : "Record Payment"}
        </Button>
      </div>
    </form>
  );
};

PaymentForm.propTypes = {
  payment: PropTypes.object,
  invoice: PropTypes.object,
  order: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default PaymentForm;
