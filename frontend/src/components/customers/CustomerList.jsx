import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { FaEye, FaEdit } from "react-icons/fa";
import DeleteIcon from "../common/DeleteIcon";
import { formatDate } from "../../utils/formatters";
import "./CustomerList.css";

const CustomerList = ({ customers, onDelete }) => {
  if (!customers || customers.length === 0) {
    return (
      <div className="no-customers">
        <p>No customers found. Create a new customer to get started.</p>
      </div>
    );
  }

  return (
    <div className="customer-list">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id}>
              <td>{customer.name}</td>
              <td>{formatDate(customer.created_at)}</td>
              <td>
                <div className="action-buttons">
                  <Link to={`/customers/${customer.id}`} className="btn-icon" title="View Orders">
                    <FaEye />
                  </Link>
                  <Link to={`/customers/edit/${customer.id}`} className="btn-icon" title="Edit">
                    <FaEdit />
                  </Link>
                  <button style={{
                        backgroundColor: "white",
                        border: "none",
                        padding: "8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }} onClick={() => onDelete(customer.id)} title="Delete">
                    <DeleteIcon color="red" size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

CustomerList.propTypes = {
  customers: PropTypes.array.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default CustomerList;
