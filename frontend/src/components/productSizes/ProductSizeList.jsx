import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { FaEdit } from "react-icons/fa";
import DeleteIcon from "../common/DeleteIcon";
import { formatCurrency } from "../../utils/formatters";
import "./ProductSizeList.css";

const ProductSizeList = ({ productSizes, onDelete }) => {
  if (!productSizes || productSizes.length === 0) {
    return (
      <div className="no-product-sizes">
        <p>No product sizes found. Create a new product size to get started.</p>
      </div>
    );
  }

  return (
    <div className="product-size-list">
      <table className="table">
        <thead>
          <tr>
            <th>Size Label</th>
            <th>Rate per kg</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {productSizes.map((productSize) => (
            <tr key={productSize.id}>
              <td>{productSize.size_label}</td>
              <td>{formatCurrency(productSize.rate_per_kg)}</td>
              <td>
                <div className="action-buttons">
                  <Link to={`/product-sizes/edit/${productSize.id}`} className="btn-icon" title="Edit">
                    <FaEdit />
                  </Link>
                  <button style={{
                        backgroundColor: "white",
                        border: "none",
                        padding: "8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }} onClick={() => onDelete(productSize.id)} title="Delete">
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

ProductSizeList.propTypes = {
  productSizes: PropTypes.array.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default ProductSizeList;
