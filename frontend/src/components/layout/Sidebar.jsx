import { NavLink } from "react-router-dom";
import { FaHome, FaBoxes, FaUsers, FaMoneyBillWave, FaLayerGroup, FaRuler, FaFileInvoiceDollar, FaTimes, FaHistory } from "react-icons/fa";
import PropTypes from "prop-types";

const Sidebar = ({ isCollapsed = false, isMobileOpen = false, onToggle }) => {
  const navItems = [
    { to: "/", icon: FaHome, label: "Dashboard" },
    { to: "/orders", icon: FaBoxes, label: "Orders" },
    { to: "/customers", icon: FaUsers, label: "Customers" },
    { to: "/plate-types", icon: FaLayerGroup, label: "Plate Types" },
    { to: "/product-sizes", icon: FaRuler, label: "Product Sizes" },
    { to: "/expenses", icon: FaMoneyBillWave, label: "Expenses" },
    { to: "/invoices", icon: FaFileInvoiceDollar, label: "Invoices" },
    { to: "/history", icon: FaHistory, label: "History" },
  ];

  const navLinkClasses = ({ isActive }) =>
    `group flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
      isActive
        ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-400 shadow-sm"
        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200"
    }`;

  const handleNavClick = () => {
    if (window.innerWidth < 1024) {
      onToggle?.();
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${isCollapsed ? "w-20" : "w-72"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
          fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
          h-full flex flex-col
          bg-white dark:bg-gray-900
          border-r border-gray-200/80 dark:border-gray-800
          transition-all duration-300 ease-out
          shadow-xl lg:shadow-none
        `}
      >
        {/* Header */}
        <div className={`${isCollapsed ? "px-4 py-5" : "px-6 py-6"} border-b border-gray-100 dark:border-gray-800 transition-all duration-300`}>
          <div className="flex items-center justify-between">
            {isCollapsed ? (
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-700 rounded-xl flex items-center justify-center shadow-md shadow-primary/20 mx-auto">
                <span className="text-xl font-bold text-white font-display">Y</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-primary to-primary-700 rounded-xl flex items-center justify-center shadow-md shadow-primary/20 flex-shrink-0">
                  <span className="text-lg font-bold text-white font-display">Y</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white font-display tracking-tight">YARS</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-500">Non Woven Bags</p>
                </div>
              </div>
            )}

            {/* Mobile close button */}
            {!isCollapsed && (
              <button
                onClick={onToggle}
                className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close sidebar"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 no-scrollbar">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={navLinkClasses}
                  onClick={handleNavClick}
                  title={isCollapsed ? item.label : undefined}
                >
                  <item.icon className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? "mx-auto" : ""} transition-transform group-hover:scale-110`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        {!isCollapsed && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-gray-500 dark:text-gray-400">System Active</span>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center mt-3">
              &copy; {new Date().getFullYear()} YARS
            </p>
          </div>
        )}
      </aside>
    </>
  );
};

Sidebar.propTypes = {
  isCollapsed: PropTypes.bool,
  isMobileOpen: PropTypes.bool,
  onToggle: PropTypes.func,
};

export default Sidebar;
