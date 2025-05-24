import { useLocation } from "react-router-dom";
import { FaSignOutAlt, FaUser, FaBars, FaTimes } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { ThemeToggle } from "../theme/ThemeToggle";
import PropTypes from "prop-types";

const Header = ({ onSidebarToggle, isSidebarCollapsed, isMobileOpen }) => {
  const location = useLocation();
  const { user, logout } = useAuth();

  // Get page title based on current route
  const getPageTitle = () => {
    const path = location.pathname;

    if (path === "/") return "Dashboard";
    if (path.includes("/orders")) return "Orders";
    if (path.includes("/customers")) return "Customers";
    if (path.includes("/plate-types")) return "Plate Types";
    if (path.includes("/product-sizes")) return "Product Sizes";
    if (path.includes("/expenses")) return "Expenses";
    if (path.includes("/invoices")) return "Invoices";

    return "Non Woven Bags Order Tracking";
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout();
    }
  };

  return (
    <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center space-x-4">
          {/* Mobile hamburger menu */}
          <button
            onClick={onSidebarToggle}
            className="lg:hidden p-2 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle sidebar"
          >
            {isMobileOpen ? <FaTimes className="w-5 h-5" /> : <FaBars className="w-5 h-5" />}
          </button>

          {/* Desktop sidebar toggle */}
          <button
            onClick={onSidebarToggle}
            className="hidden lg:block p-2 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle sidebar"
          >
            <FaBars className="w-4 h-4" />
          </button>

          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{getPageTitle()}</h1>
        </div>

        {user && (
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <div className="flex items-center space-x-2">
              <div className="flex items-center justify-center w-8 h-8 bg-primary/10 text-primary rounded-full">
                <FaUser className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{user.username}</span>
            </div>
            <button
              className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              onClick={handleLogout}
              title="Logout"
            >
              <FaSignOutAlt className="w-4 h-4 mr-1.5" /> Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

Header.propTypes = {
  onSidebarToggle: PropTypes.func,
  isSidebarCollapsed: PropTypes.bool,
  isMobileOpen: PropTypes.bool,
};

export default Header;
