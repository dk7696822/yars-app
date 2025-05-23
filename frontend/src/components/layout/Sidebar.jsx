import { NavLink } from "react-router-dom";
import { FaHome, FaBoxes, FaUsers, FaMoneyBillWave, FaLayerGroup, FaRuler, FaFileInvoiceDollar } from "react-icons/fa";

const Sidebar = () => {
  const navLinkClasses = ({ isActive }) =>
    `flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
      isActive ? "bg-primary/10 text-primary dark:bg-primary/20" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
    }`;

  return (
    <div className="w-64 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-primary">YARS</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Non Woven Bags</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          <li>
            <NavLink to="/" className={navLinkClasses}>
              <FaHome className="w-5 h-5 mr-3" />
              <span>Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/orders" className={navLinkClasses}>
              <FaBoxes className="w-5 h-5 mr-3" />
              <span>Orders</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/customers" className={navLinkClasses}>
              <FaUsers className="w-5 h-5 mr-3" />
              <span>Customers</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/plate-types" className={navLinkClasses}>
              <FaLayerGroup className="w-5 h-5 mr-3" />
              <span>Plate Types</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/product-sizes" className={navLinkClasses}>
              <FaRuler className="w-5 h-5 mr-3" />
              <span>Product Sizes</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/expenses" className={navLinkClasses}>
              <FaMoneyBillWave className="w-5 h-5 mr-3" />
              <span>Expenses</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/invoices" className={navLinkClasses}>
              <FaFileInvoiceDollar className="w-5 h-5 mr-3" />
              <span>Invoices</span>
            </NavLink>
          </li>
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">&copy; {new Date().getFullYear()} YARS</p>
      </div>
    </div>
  );
};

export default Sidebar;
