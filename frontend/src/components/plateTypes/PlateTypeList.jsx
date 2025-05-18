import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { FaEdit } from "react-icons/fa";
import DeleteIcon from "../common/DeleteIcon";
import { formatCurrency } from "../../utils/formatters";
import "./PlateTypeList.css";

const PlateTypeList = ({ plateTypes, onDelete }) => {
  if (!plateTypes || plateTypes.length === 0) {
    return (
      <div className="no-plate-types">
        <p>No plate types found. Create a new plate type to get started.</p>
      </div>
    );
  }

  return (
    <div className="plate-type-list">
      <table className="table">
        <thead>
          <tr>
            <th>Type Name</th>
            <th>Charge</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {plateTypes.map((plateType) => (
            <tr key={plateType.id}>
              <td>{plateType.type_name}</td>
              <td>{formatCurrency(plateType.charge)}</td>
              <td>
                <div className="action-buttons">
                  <Link to={`/plate-types/edit/${plateType.id}`} className="btn-icon" title="Edit">
                    <FaEdit />
                  </Link>
                  <button style={{
                        backgroundColor: "white",
                        border: "none",
                        padding: "8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }} onClick={() => onDelete(plateType.id)} title="Delete">
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

PlateTypeList.propTypes = {
  plateTypes: PropTypes.array.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default PlateTypeList;
