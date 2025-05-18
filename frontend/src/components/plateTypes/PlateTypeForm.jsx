import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FaSave, FaTimes } from 'react-icons/fa';
import Alert from '../common/Alert';
import Spinner from '../common/Spinner';
import './PlateTypeForm.css';

const PlateTypeForm = ({ initialValues, onSubmit, onCancel, isLoading, error }) => {
  const [formData, setFormData] = useState({
    type_name: '',
    charge: 0
  });
  
  useEffect(() => {
    if (initialValues) {
      setFormData({
        type_name: initialValues.type_name || '',
        charge: initialValues.charge || 0
      });
    }
  }, [initialValues]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'charge' ? parseFloat(value) || 0 : value
    }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };
  
  return (
    <div className="plate-type-form">
      {error && <Alert type="danger" message={error} />}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="type_name">Type Name *</label>
          <input
            type="text"
            id="type_name"
            name="type_name"
            value={formData.type_name}
            onChange={handleChange}
            required
            className="form-control"
            placeholder="Enter plate type name"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="charge">Charge (₹) *</label>
          <input
            type="number"
            id="charge"
            name="charge"
            value={formData.charge}
            onChange={handleChange}
            required
            min="0"
            step="0.01"
            className="form-control"
            placeholder="Enter charge amount"
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
                <FaSave /> Save Plate Type
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

PlateTypeForm.propTypes = {
  initialValues: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  error: PropTypes.string
};

PlateTypeForm.defaultProps = {
  initialValues: null,
  isLoading: false,
  error: ''
};

export default PlateTypeForm;
