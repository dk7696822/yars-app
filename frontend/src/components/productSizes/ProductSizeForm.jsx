import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { FaSave, FaTimes, FaRuler, FaRupeeSign, FaExclamationCircle, FaWeightHanging } from "react-icons/fa";
import { perPiecePriceHint, perPieceWeightHint } from "../../utils/formatters";
import "./ProductSizeForm.css";

const ProductSizeForm = ({ initialValues, onSubmit, onCancel, isLoading, error }) => {
  const [formData, setFormData] = useState({
    size_label: "",
    rate_per_kg: "",
    piece_price_count: 1,
    piece_price_amount: "",
    weight_pieces_count: "",
    weight_kg: "",
  });
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (initialValues) {
      const v = (x) => (x === null || x === undefined ? "" : x);
      setFormData({
        size_label: initialValues.size_label || "",
        rate_per_kg: v(initialValues.rate_per_kg),
        piece_price_count: initialValues.piece_price_count ?? 1,
        piece_price_amount: v(initialValues.piece_price_amount),
        weight_pieces_count: v(initialValues.weight_pieces_count),
        weight_kg: v(initialValues.weight_kg),
      });
    }
  }, [initialValues]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const blank = (x) => x === "" || x === null || x === undefined;

  const handleSubmit = (e) => {
    e.preventDefault();
    const hasPiecePrice = !blank(formData.piece_price_amount);
    if (blank(formData.rate_per_kg) && !hasPiecePrice) {
      setLocalError("Enter a rate per kg or a piece price (or both).");
      return;
    }
    if (blank(formData.weight_kg) !== blank(formData.weight_pieces_count)) {
      setLocalError("Weight: enter both the number of pieces and the kg.");
      return;
    }
    setLocalError("");
    onSubmit({
      size_label: formData.size_label,
      rate_per_kg: blank(formData.rate_per_kg) ? null : formData.rate_per_kg,
      piece_price_amount: hasPiecePrice ? formData.piece_price_amount : null,
      piece_price_count: hasPiecePrice ? formData.piece_price_count : null,
      weight_kg: blank(formData.weight_kg) ? null : formData.weight_kg,
      weight_pieces_count: blank(formData.weight_pieces_count) ? null : formData.weight_pieces_count,
    });
  };

  return (
    <div className="product-size-form">
      {(localError || error) && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-start gap-3 mb-5">
          <FaExclamationCircle className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-400 text-sm">{localError || error}</p>
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
            <FaRupeeSign className="form-icon" /> Rate per kg
          </label>
          <input type="number" id="rate_per_kg" name="rate_per_kg" value={formData.rate_per_kg} onChange={handleChange}
            min="0" step="0.01" className="form-control" placeholder="Optional if a piece price is set" />
        </div>

        <div className="form-group">
          <label className="form-label">
            <FaRupeeSign className="form-icon" /> Piece price
          </label>
          <div className="flex items-center gap-2">
            <input type="number" name="piece_price_count" aria-label="Number of pieces" value={formData.piece_price_count}
              onChange={handleChange} min="1" step="1" className="form-control w-24" />
            <span className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">piece(s) cost ₹</span>
            <input type="number" name="piece_price_amount" aria-label="Price for those pieces" value={formData.piece_price_amount}
              onChange={handleChange} min="0" step="0.0001" className="form-control" placeholder="e.g. 0.50" />
          </div>
          {formData.piece_price_amount !== "" && Number(formData.piece_price_count) > 1 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{perPiecePriceHint(formData.piece_price_amount, formData.piece_price_count)}</p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">
            <FaWeightHanging className="form-icon" /> Weight
          </label>
          <div className="flex items-center gap-2">
            <input type="number" name="weight_pieces_count" aria-label="Number of pieces weighed" value={formData.weight_pieces_count}
              onChange={handleChange} min="1" step="1" className="form-control w-24" placeholder="10000" />
            <span className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">piece(s) weigh</span>
            <input type="number" name="weight_kg" aria-label="Weight in kg" value={formData.weight_kg}
              onChange={handleChange} min="0" step="0.001" className="form-control" placeholder="100" />
            <span className="text-sm text-gray-600 dark:text-gray-300">kg</span>
          </div>
          {formData.weight_kg !== "" && formData.weight_pieces_count !== "" && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{perPieceWeightHint(formData.weight_kg, formData.weight_pieces_count)}</p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Optional. Used only to estimate kg for orders taken in pieces.</p>
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
