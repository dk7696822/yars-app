import { useState, useEffect } from "react";
import { FaSave, FaTimes, FaExclamationCircle } from "react-icons/fa";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
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
    <div>
      {/* Error alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-start gap-3 mb-5">
          <FaExclamationCircle className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        {/* Row 1: Bill Date & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="bill_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Bill Date <span className="text-red-500">*</span>
            </label>
            <DatePicker
              selected={formData.bill_date}
              onChange={(date) => handleDateChange(date, "bill_date")}
              dateFormat="yyyy-MM-dd"
              className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 dark:focus:ring-amber-500/30 focus:border-primary dark:focus:border-amber-500/50 transition-all"
              required
              wrapperClassName="w-full"
            />
          </div>

          <div>
            <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Category <span className="text-red-500">*</span>
            </label>
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

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Description <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary/20 dark:focus:ring-amber-500/30 focus:border-primary dark:focus:border-amber-500/50 transition-all"
            placeholder="Enter expense description"
            required
          />
        </div>

        {/* Vendor */}
        <div>
          <label htmlFor="vendor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Vendor/Supplier <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="vendor"
            name="vendor"
            value={formData.vendor}
            onChange={handleChange}
            className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary/20 dark:focus:ring-amber-500/30 focus:border-primary dark:focus:border-amber-500/50 transition-all"
            placeholder="Enter vendor name"
            required
          />
        </div>

        {/* Row 2: Quantity, Unit Cost, Total Cost */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Quantity
            </label>
            <input
              type="number"
              id="quantity"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 dark:focus:ring-amber-500/30 focus:border-primary dark:focus:border-amber-500/50 transition-all"
              min="1"
              required
            />
          </div>

          <div>
            <label htmlFor="unit_cost" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Unit Cost <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="unit_cost"
              name="unit_cost"
              value={formData.unit_cost}
              onChange={handleChange}
              className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 dark:focus:ring-amber-500/30 focus:border-primary dark:focus:border-amber-500/50 transition-all"
              step="0.01"
              min="0"
              required
            />
          </div>

          <div>
            <label htmlFor="total_cost" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Total Cost
            </label>
            <input
              type="number"
              id="total_cost"
              name="total_cost"
              value={formData.total_cost}
              className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 cursor-not-allowed"
              readOnly
            />
          </div>
        </div>

        {/* Row 3: Due Date & Payment Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Due Date <span className="text-gray-400 dark:text-gray-500 font-normal">(Optional)</span>
            </label>
            <DatePicker
              selected={formData.due_date}
              onChange={(date) => handleDateChange(date, "due_date")}
              dateFormat="yyyy-MM-dd"
              className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/20 dark:focus:ring-amber-500/30 focus:border-primary dark:focus:border-amber-500/50 transition-all"
              isClearable
              placeholderText="Select due date"
              wrapperClassName="w-full"
            />
          </div>

          <div>
            <label htmlFor="payment_status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Payment Status
            </label>
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

        {/* Form Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-5 mt-5 border-t border-gray-100 dark:border-gray-700/50">
          <button
            type="button"
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95"
            onClick={onCancel}
          >
            <FaTimes className="w-4 h-4" /> Cancel
          </button>
          <button
            type="submit"
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl bg-primary text-white font-semibold shadow-lg shadow-primary/25 hover:bg-primary-700 hover:shadow-xl hover:shadow-primary/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <FaSave className="w-4 h-4" /> Save Expense
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExpenseForm;
