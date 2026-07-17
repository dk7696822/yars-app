import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import DatePicker from "react-datepicker";
import { FaPlus, FaTrash, FaSave, FaTimes, FaExclamationCircle } from "react-icons/fa";
import { formatCurrency } from "../../utils/formatters";
import Dropdown from "../ui/Dropdown";
import "react-datepicker/dist/react-datepicker.css";
import "./OrderForm.css";

const OrderForm = ({ initialValues, customers, productSizes, plateTypes, onSubmit, onCancel, isLoading, error }) => {
  const [formData, setFormData] = useState({
    customer_id: "",
    order_date: new Date(),
    advance_received: 0,
    plate_type_id: "",
    status: "PENDING",
    custom_plate_charge: null,
    round_off_amount: 0,
    product_sizes: [{ product_size_id: "", quantity_kg: 1, rate_per_kg: 0 }],
  });

  const [totalAmount, setTotalAmount] = useState(0);
  const [plateCharge, setPlateCharge] = useState(0);
  const [totalReceivable, setTotalReceivable] = useState(0);

  // Initialize form with initial values if provided
  useEffect(() => {
    if (initialValues) {
      const productSizesData =
        initialValues.orderProductSizes?.map((item) => ({
          product_size_id: item.product_size_id,
          quantity_kg: parseFloat(item.quantity_kg),
          rate_per_kg: parseFloat(item.rate_per_kg || item.productSize.rate_per_kg),
        })) || [{ product_size_id: "", quantity_kg: 1 }];

      setFormData({
        customer_id: initialValues.customer_id || "",
        order_date: initialValues.order_date ? new Date(initialValues.order_date) : new Date(),
        advance_received: parseFloat(initialValues.advance_received) || 0,
        plate_type_id: initialValues.plate_type_id || "",
        status: initialValues.status || "PENDING",
        custom_plate_charge: initialValues.custom_plate_charge ? parseFloat(initialValues.custom_plate_charge) : null,
        round_off_amount: parseFloat(initialValues.round_off_amount) || 0,
        product_sizes: productSizesData,
      });
    }
  }, [initialValues]);

  // Calculate totals whenever form data changes
  useEffect(() => {
    // Calculate product amount
    let amount = 0;
    formData.product_sizes.forEach((item) => {
      const productSize = productSizes.find((ps) => ps.id === item.product_size_id);
      if (productSize && item.quantity_kg) {
        // Use the stored rate if available, otherwise use the current product size rate
        const rate = item.rate_per_kg || parseFloat(productSize.rate_per_kg);
        amount += rate * parseFloat(item.quantity_kg);
      }
    });

    // Get plate charge (use custom charge if available, otherwise use plate type charge)
    const selectedPlateType = plateTypes.find((pt) => pt.id === formData.plate_type_id);
    const defaultCharge = selectedPlateType ? parseFloat(selectedPlateType.charge) : 0;
    const charge = formData.custom_plate_charge !== null ? parseFloat(formData.custom_plate_charge || 0) : defaultCharge;

    // Calculate total before round off
    const totalBeforeRoundOff = amount + charge;

    // Apply round off amount
    const roundOffAmount = parseFloat(formData.round_off_amount || 0);
    const totalAfterRoundOff = totalBeforeRoundOff - roundOffAmount;

    // Calculate total receivable (after round off minus advance)
    const receivable = totalAfterRoundOff - parseFloat(formData.advance_received || 0);

    setTotalAmount(amount);
    setPlateCharge(charge);
    setTotalReceivable(receivable);
  }, [formData, productSizes, plateTypes]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDateChange = (date) => {
    setFormData((prev) => ({
      ...prev,
      order_date: date,
    }));
  };

  const handleProductSizeChange = (index, field, value) => {
    const updatedProductSizes = [...formData.product_sizes];

    // If changing the product size, also update the rate_per_kg
    if (field === "product_size_id") {
      const productSize = productSizes.find((ps) => ps.id === value);
      updatedProductSizes[index] = {
        ...updatedProductSizes[index],
        [field]: value,
        // Only set the rate if this is a new product size selection (not editing an existing order item)
        rate_per_kg: !updatedProductSizes[index].rate_per_kg ? (productSize ? parseFloat(productSize.rate_per_kg) : 0) : updatedProductSizes[index].rate_per_kg,
      };
    } else {
      updatedProductSizes[index] = {
        ...updatedProductSizes[index],
        [field]: value,
      };
    }

    setFormData((prev) => ({
      ...prev,
      product_sizes: updatedProductSizes,
    }));
  };

  const addProductSize = () => {
    setFormData((prev) => ({
      ...prev,
      product_sizes: [...prev.product_sizes, { product_size_id: "", quantity_kg: 1, rate_per_kg: 0 }],
    }));
  };

  const removeProductSize = (index) => {
    if (formData.product_sizes.length === 1) {
      return; // Keep at least one product size
    }

    const updatedProductSizes = [...formData.product_sizes];
    updatedProductSizes.splice(index, 1);

    setFormData((prev) => ({
      ...prev,
      product_sizes: updatedProductSizes,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="order-form">
      {/* Error alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-start gap-3 mb-5">
          <FaExclamationCircle className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="customer_id">
              Customer <span className="text-red-500">*</span>
            </label>
            <Dropdown
              id="customer_id"
              name="customer_id"
              value={formData.customer_id}
              onChange={handleChange}
              placeholder="Select Customer"
              required
              options={[{ value: "", label: "Select Customer" }, ...customers.map((customer) => ({ value: customer.id, label: customer.name }))]}
            />
          </div>

          <div className="form-group">
            <label htmlFor="order_date">
              Order Date <span className="text-red-500">*</span>
            </label>
            <DatePicker id="order_date" selected={formData.order_date} onChange={handleDateChange} dateFormat="dd/MM/yyyy" className="form-control" required />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="plate_type_id">
              Plate Type <span className="text-red-500">*</span>
            </label>
            <Dropdown
              id="plate_type_id"
              name="plate_type_id"
              value={formData.plate_type_id}
              onChange={handleChange}
              placeholder="Select Plate Type"
              required
              options={[
                { value: "", label: "Select Plate Type" },
                ...plateTypes.map((plateType) => ({
                  value: plateType.id,
                  label: `${plateType.type_name} (${formatCurrency(plateType.charge)})`,
                })),
              ]}
            />
          </div>

          <div className="form-group">
            <label htmlFor="custom_plate_charge">
              Custom Plate Charge
              {formData.plate_type_id && (
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">(Default: {formatCurrency(plateTypes.find((pt) => pt.id === formData.plate_type_id)?.charge || 0)})</span>
              )}
            </label>
            <input
              type="number"
              id="custom_plate_charge"
              name="custom_plate_charge"
              value={formData.custom_plate_charge || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  custom_plate_charge: e.target.value ? parseFloat(e.target.value) : null,
                }))
              }
              min="0"
              step="0.01"
              placeholder="Enter custom charge (optional)"
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="round_off_amount">
              Round Off Amount
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">(Amount to subtract)</span>
            </label>
            <input type="number" id="round_off_amount" name="round_off_amount" value={formData.round_off_amount || ""} onChange={handleChange} step="0.01" placeholder="e.g., 5 for ₹10005 → ₹10000" className="form-control" />
          </div>

          <div className="form-group">
            <label htmlFor="advance_received">Advance Received</label>
            <input type="number" id="advance_received" name="advance_received" value={formData.advance_received} onChange={handleChange} min="0" step="0.01" className="form-control" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="status">
              Order Status <span className="text-red-500">*</span>
            </label>
            <Dropdown
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              required
              options={[
                { value: "PENDING", label: "Pending" },
                { value: "IN_PROGRESS", label: "In Progress" },
                { value: "COMPLETED", label: "Completed" },
                { value: "DELIVERED", label: "Delivered" },
                { value: "CANCELLED", label: "Cancelled" },
              ]}
            />
          </div>
        </div>

        <div className="product-sizes-section">
          <div className="section-header">
            <h3>
              Product Sizes <span className="text-red-500">*</span>
            </h3>
            <button type="button" className="btn-sm" onClick={addProductSize}>
              <FaPlus /> Add Product Size
            </button>
          </div>

          {formData.product_sizes.map((item, index) => (
            <div key={index} className="product-size-row">
              <div className="form-group">
                <label htmlFor={`product_size_${index}`}>Size</label>
                <Dropdown
                  id={`product_size_${index}`}
                  name={`product_size_${index}`}
                  value={item.product_size_id}
                  onChange={(e) => handleProductSizeChange(index, "product_size_id", e.target.value)}
                  placeholder="Select Size"
                  required
                  options={[
                    { value: "", label: "Select Size" },
                    ...productSizes.map((size) => ({
                      value: size.id,
                      label: `${size.size_label} (${formatCurrency(size.rate_per_kg)}/kg)`,
                    })),
                  ]}
                />
              </div>

              <div className="form-group">
                <label htmlFor={`quantity_${index}`}>Quantity (kg)</label>
                <input
                  type="number"
                  id={`quantity_${index}`}
                  value={item.quantity_kg}
                  onChange={(e) => handleProductSizeChange(index, "quantity_kg", parseFloat(e.target.value))}
                  min="0.1"
                  step="0.1"
                  required
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor={`rate_${index}`}>
                  Rate/kg
                  {item.product_size_id && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">(Default: {formatCurrency(productSizes.find((ps) => ps.id === item.product_size_id)?.rate_per_kg || 0)})</span>
                  )}
                </label>
                <input
                  type="number"
                  id={`rate_${index}`}
                  value={item.rate_per_kg || ""}
                  onChange={(e) => handleProductSizeChange(index, "rate_per_kg", e.target.value ? parseFloat(e.target.value) : null)}
                  min="0"
                  step="0.01"
                  placeholder="Custom rate (optional)"
                  className="form-control"
                />
              </div>

              <div className="form-group amount-column">
                <label>Amount</label>
                <div className="amount-display">
                  {item.product_size_id && item.quantity_kg
                    ? formatCurrency((item.rate_per_kg || parseFloat(productSizes.find((ps) => ps.id === item.product_size_id)?.rate_per_kg || 0)) * parseFloat(item.quantity_kg))
                    : formatCurrency(0)}
                </div>
              </div>

              <button type="button" className="btn-icon remove-btn" onClick={() => removeProductSize(index)} disabled={formData.product_sizes.length === 1}>
                <FaTrash />
              </button>
            </div>
          ))}
        </div>

        <div className="order-summary">
          <div className="summary-row">
            <span>Total Product Amount:</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
          <div className="summary-row">
            <span>Plate Charge:</span>
            <span>{formatCurrency(plateCharge)}</span>
          </div>
          <div className="summary-row">
            <span>Advance Received:</span>
            <span>-{formatCurrency(parseFloat(formData.advance_received || 0))}</span>
          </div>
          <div className="summary-row total">
            <span>Total Receivable:</span>
            <span>{formatCurrency(totalReceivable)}</span>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            <FaTimes /> Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <FaSave /> Save Order
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

OrderForm.propTypes = {
  initialValues: PropTypes.object,
  customers: PropTypes.array.isRequired,
  productSizes: PropTypes.array.isRequired,
  plateTypes: PropTypes.array.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  error: PropTypes.string,
};

OrderForm.defaultProps = {
  initialValues: null,
  isLoading: false,
  error: "",
};

export default OrderForm;
