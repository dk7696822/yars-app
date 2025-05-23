import { useState, useEffect } from "react";
import { FaSave, FaTimes } from "react-icons/fa";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Alert from "../common/Alert";
import Spinner from "../common/Spinner";
import Select from "../ui/Select";
import Dropdown from "../ui/Dropdown";

const ExpenseForm = ({ initialData, categories, onSubmit, onCancel, isLoading }) => {
  const [formData, setFormData] = useState({
    bill_date: initialData?.bill_date ? new Date(initialData.bill_date) : new Date(),
    category_id: initialData?.category_id || "",
    description: initialData?.description || "",
    vendor: initialData?.vendor || "",
    quantity: initialData?.quantity || 1,
    unit_cost: initialData?.unit_cost || "",
    total_cost: initialData?.total_cost || "",
    due_date: initialData?.due_date ? new Date(initialData.due_date) : null,
    payment_status: initialData?.payment_status || "UNPAID",
  });
  const [error, setError] = useState("");

  // Calculate total cost when quantity or unit_cost changes
  useEffect(() => {
    if (formData.quantity && formData.unit_cost) {
      const total = parseFloat(formData.quantity) * parseFloat(formData.unit_cost);
      setFormData((prev) => ({ ...prev, total_cost: total.toFixed(2) }));
    }
  }, [formData.quantity, formData.unit_cost]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date, field) => {
    setFormData((prev) => ({ ...prev, [field]: date }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.bill_date || !formData.category_id || !formData.description || !formData.vendor || !formData.unit_cost) {
      setError("Please fill in all required fields");
      return;
    }

    // Format dates for API
    const formattedData = {
      ...formData,
      bill_date: formData.bill_date.toISOString().split("T")[0],
      due_date: formData.due_date ? formData.due_date.toISOString().split("T")[0] : null,
      quantity: parseInt(formData.quantity),
      unit_cost: parseFloat(formData.unit_cost),
      total_cost: parseFloat(formData.total_cost),
    };

    onSubmit(formattedData);
  };

  return (
    <div className="expense-form">
      {error && <Alert type="danger" message={error} />}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="bill_date">Bill Date *</label>
            <DatePicker selected={formData.bill_date} onChange={(date) => handleDateChange(date, "bill_date")} dateFormat="yyyy-MM-dd" className="form-control" required />
          </div>

          <div className="form-group">
            <label htmlFor="category_id">Category *</label>
            <Dropdown
              id="category_id"
              name="category_id"
              value={formData.category_id}
              onChange={handleChange}
              placeholder="Select a category"
              required
              options={[
                { value: "", label: "Select a category" },
                ...categories.map((category) => ({
                  value: category.id,
                  label: category.name,
                })),
              ]}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">Description *</label>
          <input type="text" id="description" name="description" value={formData.description} onChange={handleChange} className="form-control" placeholder="Enter expense description" required />
        </div>

        <div className="form-group">
          <label htmlFor="vendor">Vendor/Supplier *</label>
          <input type="text" id="vendor" name="vendor" value={formData.vendor} onChange={handleChange} className="form-control" placeholder="Enter vendor name" required />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="quantity">Quantity</label>
            <input type="number" id="quantity" name="quantity" value={formData.quantity} onChange={handleChange} className="form-control" min="1" required />
          </div>

          <div className="form-group">
            <label htmlFor="unit_cost">Unit Cost (₹) *</label>
            <input type="number" id="unit_cost" name="unit_cost" value={formData.unit_cost} onChange={handleChange} className="form-control" step="0.01" min="0" required />
          </div>

          <div className="form-group">
            <label htmlFor="total_cost">Total Cost (₹)</label>
            <input type="number" id="total_cost" name="total_cost" value={formData.total_cost} className="form-control" readOnly />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="due_date">Due Date (Optional)</label>
            <DatePicker
              selected={formData.due_date}
              onChange={(date) => handleDateChange(date, "due_date")}
              dateFormat="yyyy-MM-dd"
              className="form-control"
              isClearable
              placeholderText="Select due date (optional)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="payment_status">Payment Status</label>
            <Dropdown
              id="payment_status"
              name="payment_status"
              value={formData.payment_status}
              onChange={handleChange}
              options={[
                { value: "UNPAID", label: "Unpaid" },
                { value: "PAID", label: "Paid" },
              ]}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            <FaTimes /> Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? (
              <>
                <Spinner size="small" color="white" /> Saving...
              </>
            ) : (
              <>
                <FaSave /> Save Expense
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExpenseForm;
