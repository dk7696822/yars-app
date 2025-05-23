import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { FaEdit, FaEnvelope, FaPhone, FaMapMarkerAlt } from "react-icons/fa";
import { formatDate } from "../../utils/formatters";
import "./CustomerInfoCard.css";

const CustomerInfoCard = ({ customer }) => {
  if (!customer) return null;

  return (
    <div className="customer-info-card">
      <div className="customer-info">
        <div className="customer-header">
          <h2>{customer.name}</h2>
          <Link to={`/customers/edit/${customer.id}`} className="edit-button">
            <FaEdit /> Edit
          </Link>
        </div>

        <div className="customer-metadata">
          {customer?.metadata?.email && (
            <div className="metadata-item">
              <FaEnvelope className="metadata-icon" />
              <a href={`mailto:${customer.metadata.email}`} className="metadata-value">
                {customer.metadata.email}
              </a>
            </div>
          )}

          {customer?.metadata?.phone && (
            <div className="metadata-item">
              <FaPhone className="metadata-icon" />
              <a href={`tel:${customer.metadata.phone}`} className="metadata-value">
                {customer.metadata.phone}
              </a>
            </div>
          )}

          {customer?.metadata?.address && (
            <div className="metadata-item">
              <FaMapMarkerAlt className="metadata-icon" />
              <span className="metadata-value">{customer.metadata.address}</span>
            </div>
          )}
        </div>

        <p className="customer-since">Customer since: {formatDate(customer.created_at)}</p>
      </div>
    </div>
  );
};

CustomerInfoCard.propTypes = {
  customer: PropTypes.object.isRequired,
};

export default CustomerInfoCard;
