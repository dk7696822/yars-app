import { NavLink } from "react-router-dom";
import { FaHome, FaBoxes, FaUsers, FaMoneyBillWave, FaLayerGroup, FaRuler, FaFileInvoiceDollar } from "react-icons/fa";
import PropTypes from "prop-types";

const Sidebar = ({ isCollapsed = false, isMobileOpen = false, onToggle }) => {
  const navLinkClasses = ({ isActive }) =>
    `flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
      isActive ? "bg-primary/10 text-primary dark:bg-primary/20" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
    }`;

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={onToggle} />}

      {/* Sidebar */}
      <div
        className={`
        ${isCollapsed ? "w-16" : "w-64"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        flex flex-col transition-all duration-300 ease-in-out
      `}
      >
        <div className={`${isCollapsed ? "p-4" : "p-6"} border-b border-gray-200 dark:border-gray-700 transition-all duration-300`}>
          {isCollapsed ? (
            <div className="flex justify-center">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-sm">Y</span>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-primary">YARS</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Non Woven Bags</p>
            </>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            <li>
              <NavLink to="/" className={navLinkClasses} onClick={() => window.innerWidth < 1024 && onToggle?.()}>
                <FaHome className={`w-5 h-5 ${isCollapsed ? "" : "mr-3"} flex-shrink-0`} />
                {!isCollapsed && <span>Dashboard</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="/orders" className={navLinkClasses} onClick={() => window.innerWidth < 1024 && onToggle?.()}>
                <FaBoxes className={`w-5 h-5 ${isCollapsed ? "" : "mr-3"} flex-shrink-0`} />
                {!isCollapsed && <span>Orders</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="/customers" className={navLinkClasses} onClick={() => window.innerWidth < 1024 && onToggle?.()}>
                <FaUsers className={`w-5 h-5 ${isCollapsed ? "" : "mr-3"} flex-shrink-0`} />
                {!isCollapsed && <span>Customers</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="/plate-types" className={navLinkClasses} onClick={() => window.innerWidth < 1024 && onToggle?.()}>
                <FaLayerGroup className={`w-5 h-5 ${isCollapsed ? "" : "mr-3"} flex-shrink-0`} />
                {!isCollapsed && <span>Plate Types</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="/product-sizes" className={navLinkClasses} onClick={() => window.innerWidth < 1024 && onToggle?.()}>
                <FaRuler className={`w-5 h-5 ${isCollapsed ? "" : "mr-3"} flex-shrink-0`} />
                {!isCollapsed && <span>Product Sizes</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="/expenses" className={navLinkClasses} onClick={() => window.innerWidth < 1024 && onToggle?.()}>
                <FaMoneyBillWave className={`w-5 h-5 ${isCollapsed ? "" : "mr-3"} flex-shrink-0`} />
                {!isCollapsed && <span>Expenses</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="/invoices" className={navLinkClasses} onClick={() => window.innerWidth < 1024 && onToggle?.()}>
                <FaFileInvoiceDollar className={`w-5 h-5 ${isCollapsed ? "" : "mr-3"} flex-shrink-0`} />
                {!isCollapsed && <span>Invoices</span>}
              </NavLink>
            </li>
          </ul>
        </nav>

        {!isCollapsed && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">&copy; {new Date().getFullYear()} YARS</p>
          </div>
        )}
      </div>
    </>
  );
};

Sidebar.propTypes = {
  isCollapsed: PropTypes.bool,
  isMobileOpen: PropTypes.bool,
  onToggle: PropTypes.func,
};

export default Sidebar;
