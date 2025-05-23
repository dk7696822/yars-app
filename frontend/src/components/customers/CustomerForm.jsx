import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { FaSave, FaTimes, FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt } from "react-icons/fa";
import Alert from "../common/Alert";
import Spinner from "../common/Spinner";
import "./CustomerForm.css";

const CustomerForm = ({ initialValues, onSubmit, onCancel, isLoading, error }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (initialValues) {
      setName(initialValues.name || "");

      // Extract metadata fields if they exist
      const metadata = initialValues.metadata || {};
      setEmail(metadata.email || "");
      setPhone(metadata.phone || "");
      setAddress(metadata.address || "");
    }
  }, [initialValues]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      name,
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
    });
  };

  return (
    <div className="customer-form">
      {error && <Alert type="danger" message={error} />}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name" className="form-label">
            <FaUser className="form-icon" /> Customer Name *
          </label>
          <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required className="form-control" placeholder="Enter customer name" />
        </div>

        <div className="form-group">
          <label htmlFor="email" className="form-label">
            <FaEnvelope className="form-icon" /> Email (Optional)
          </label>
          <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-control" placeholder="Enter customer email" />
        </div>

        <div className="form-group">
          <label htmlFor="phone" className="form-label">
            <FaPhone className="form-icon" /> Phone (Optional)
          </label>
          <input type="tel" id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="form-control" placeholder="Enter customer phone number" />
        </div>

        <div className="form-group">
          <label htmlFor="address" className="form-label">
            <FaMapMarkerAlt className="form-icon" /> Address (Optional)
          </label>
          <textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} className="form-control" placeholder="Enter customer address" rows="3" />
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
