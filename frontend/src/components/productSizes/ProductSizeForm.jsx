import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { FaSave, FaTimes, FaRuler, FaRupeeSign, FaExclamationCircle } from "react-icons/fa";
import "./ProductSizeForm.css";

const ProductSizeForm = ({ initialValues, onSubmit, onCancel, isLoading, error }) => {
  const [formData, setFormData] = useState({
    size_label: "",
    rate_per_kg: 0,
  });

  useEffect(() => {
    if (initialValues) {
      setFormData({
        size_label: initialValues.size_label || "",
        rate_per_kg: initialValues.rate_per_kg || 0,
      });
    }
  }, [initialValues]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "rate_per_kg" ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="product-size-form">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-start gap-3 mb-5">
          <FaExclamationCircle className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="size_label" className="form-label">
            <FaRuler className="form-icon" /> Size Label <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="size_label"
            name="size_label"
            value={formData.size_label}
            onChange={handleChange}
            required
            className="form-control"
            placeholder="Enter size label (e.g. 8x10)"
          />
        </div>

        <div className="form-group">
          <label htmlFor="rate_per_kg" className="form-label">
            <FaRupeeSign className="form-icon" /> Rate per kg <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="rate_per_kg"
            name="rate_per_kg"
            value={formData.rate_per_kg}
            onChange={handleChange}
            required
            min="0"
            step="0.01"
            className="form-control"
            placeholder="Enter rate per kg"
          />
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
                <FaSave /> Save Product Size
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

ProductSizeForm.propTypes = {
  initialValues: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  error: PropTypes.string
};

ProductSizeForm.defaultProps = {
  initialValues: null,
  isLoading: false,
  error: ''
};

export default ProductSizeForm;
