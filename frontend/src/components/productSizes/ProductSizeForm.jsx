import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FaSave, FaTimes } from 'react-icons/fa';
import Alert from '../common/Alert';
import Spinner from '../common/Spinner';
import './ProductSizeForm.css';

const ProductSizeForm = ({ initialValues, onSubmit, onCancel, isLoading, error }) => {
  const [formData, setFormData] = useState({
    size_label: '',
    rate_per_kg: 0
  });
  
  useEffect(() => {
    if (initialValues) {
      setFormData({
        size_label: initialValues.size_label || '',
        rate_per_kg: initialValues.rate_per_kg || 0
      });
    }
  }, [initialValues]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'rate_per_kg' ? parseFloat(value) || 0 : value
    }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };
  
  return (
    <div className="product-size-form">
      {error && <Alert type="danger" message={error} />}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="size_label">Size Label *</label>
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
          <label htmlFor="rate_per_kg">Rate per kg (₹) *</label>
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
                <Spinner size="small" color="white" /> Saving...
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
