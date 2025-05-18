import { NavLink } from "react-router-dom";
import { FaHome, FaBoxes, FaUsers, FaMoneyBillWave, FaLayerGroup, FaRuler } from "react-icons/fa";
import "./Sidebar.css";

const Sidebar = () => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>YARS</h2>
        <p>Carry Bag Order Tracking</p>
      </div>

      <nav className="sidebar-nav">
        <ul>
          <li>
            <NavLink to="/" className={({ isActive }) => (isActive ? "active" : "")}>
              <FaHome className="icon" />
              <span>Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/orders" className={({ isActive }) => (isActive ? "active" : "")}>
              <FaBoxes className="icon" />
              <span>Orders</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/customers" className={({ isActive }) => (isActive ? "active" : "")}>
              <FaUsers className="icon" />
              <span>Customers</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/plate-types" className={({ isActive }) => (isActive ? "active" : "")}>
              <FaLayerGroup className="icon" />
              <span>Plate Types</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/product-sizes" className={({ isActive }) => (isActive ? "active" : "")}>
              <FaRuler className="icon" />
              <span>Product Sizes</span>
            </NavLink>
          </li>
          <li className="disabled">
            <span className="disabled-link">
              <FaMoneyBillWave className="icon" />
              <span>Expenses</span>
              <span className="coming-soon">Coming Soon</span>
            </span>
          </li>
        </ul>
      </nav>

      <div className="sidebar-footer">
        <p>&copy; {new Date().getFullYear()} YARS</p>
      </div>
    </div>
  );
};

export default Sidebar;
