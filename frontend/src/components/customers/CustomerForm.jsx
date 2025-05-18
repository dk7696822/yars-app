import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { FaSave, FaTimes } from "react-icons/fa";
import Alert from "../common/Alert";
import Spinner from "../common/Spinner";
import "./CustomerForm.css";

const CustomerForm = ({ initialValues, onSubmit, onCancel, isLoading, error }) => {
  const [name, setName] = useState("");

  useEffect(() => {
    if (initialValues) {
      setName(initialValues.name || "");
    }
  }, [initialValues]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ name });
  };

  return (
    <div className="customer-form">
      {error && <Alert type="danger" message={error} />}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Customer Name *</label>
          <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required className="form-control" placeholder="Enter customer name" />
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
                <FaSave /> Save Customer
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

CustomerForm.propTypes = {
  initialValues: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  error: PropTypes.string,
};

CustomerForm.defaultProps = {
  initialValues: null,
  isLoading: false,
  error: "",
};

export default CustomerForm;
