import { useState } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { FaEdit, FaEye } from "react-icons/fa";
import DeleteIcon from "../common/DeleteIcon";
import { formatCurrency, formatDate } from "../../utils/formatters";
import "./OrderList.css";

const OrderList = ({ orders, onDelete }) => {
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const toggleOrderDetails = (orderId) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(orderId);
    }
  };

  if (!orders || orders.length === 0) {
    return (
      <div className="no-orders">
        <p>No orders found. Try adjusting your filters or create a new order.</p>
      </div>
    );
  }

  return (
    <div className="order-list">
      <table className="table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Order Date</th>
            <th>Product Sizes</th>
            <th>Plate Type</th>
            <th>Status</th>
            <th>Advance</th>
            <th>Total Receivable</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <>
              <tr key={order.id} className={expandedOrderId === order.id ? "expanded" : ""}>
                <td>{order.customer.name}</td>
                <td>{formatDate(order.order_date)}</td>
                <td>
                  <button className="btn-link" onClick={() => toggleOrderDetails(order.id)}>
                    {order.orderProductSizes.length} items
                  </button>
                </td>
                <td>{order.plateType.type_name}</td>
                <td>
                  <span className={`status-badge status-${order.status.toLowerCase()}`}>{order.status.replace("_", " ")}</span>
                </td>
                <td>{formatCurrency(order.advance_received)}</td>
                <td className="total-receivable">{formatCurrency(order.totalReceivable)}</td>
                <td>
                  <div className="action-buttons">
                    <Link to={`/orders/${order.id}`} className="btn-icon" title="View">
                      <FaEye />
                    </Link>
                    <Link to={`/orders/edit/${order.id}`} className="btn-icon" title="Edit">
                      <FaEdit />
                    </Link>
                    <button
                      style={{
                        backgroundColor: "white",
                        border: "none",
                        padding: "8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                      onClick={() => onDelete(order.id)}
                      title="Delete"
                    >
                      <DeleteIcon color="red" size={16} />
                    </button>
                  </div>
                </td>
              </tr>
              {expandedOrderId === order.id && (
                <tr className="details-row">
                  <td colSpan="8">
                    <div className="order-details">
                      <h4>Order Details</h4>
                      <table className="details-table">
                        <thead>
                          <tr>
                            <th>Product Size</th>
                            <th>Quantity (kg)</th>
                            <th>Rate per kg</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.orderProductSizes.map((item) => (
                            <tr key={item.id}>
                              <td>{item.productSize.size_label}</td>
                              <td>{item.quantity_kg}</td>
                              <td>{formatCurrency(item.rate_per_kg || item.productSize.rate_per_kg)}</td>
                              <td>{formatCurrency(item.quantity_kg * (item.rate_per_kg || item.productSize.rate_per_kg))}</td>
                            </tr>
                          ))}
                          <tr className="plate-charge">
                            <td colSpan="3">Plate Charge ({order.plateType.type_name})</td>
                            <td>{formatCurrency(order.plateType.charge)}</td>
                          </tr>
                          <tr className="advance">
                            <td colSpan="3">Advance Received</td>
                            <td>-{formatCurrency(order.advance_received)}</td>
                          </tr>
                          <tr className="total">
                            <td colSpan="3">Total Receivable</td>
                            <td>{formatCurrency(order.totalReceivable)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
};

OrderList.propTypes = {
  orders: PropTypes.array.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default OrderList;
