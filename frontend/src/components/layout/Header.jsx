import { useLocation } from "react-router-dom";
import { FaSignOutAlt, FaUser, FaBars, FaChevronLeft, FaChevronRight } from "react-icons/fa";
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
    if (path.includes("/orders/new")) return "New Order";
    if (path.includes("/orders/edit")) return "Edit Order";
    if (path.includes("/orders")) return "Orders";
    if (path.includes("/customers/new")) return "New Customer";
    if (path.includes("/customers/edit")) return "Edit Customer";
    if (path.includes("/customers")) return "Customers";
    if (path.includes("/plate-types/new")) return "New Plate Type";
    if (path.includes("/plate-types/edit")) return "Edit Plate Type";
    if (path.includes("/plate-types")) return "Plate Types";
    if (path.includes("/product-sizes/new")) return "New Product Size";
    if (path.includes("/product-sizes/edit")) return "Edit Product Size";
    if (path.includes("/product-sizes")) return "Product Sizes";
    if (path.includes("/expenses/new")) return "New Expense";
    if (path.includes("/expenses/edit")) return "Edit Expense";
    if (path.includes("/expense-categories")) return "Expense Categories";
    if (path.includes("/expenses")) return "Expenses";
    if (path.includes("/invoices/generate")) return "Generate Invoice";
    if (path.includes("/invoices")) return "Invoices";

    return "YARS";
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout();
    }
  };

  return (
    <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0d1210]/90 backdrop-blur-xl border-b border-gray-200/60 dark:border-emerald-900/20">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        {/* Left section */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger menu */}
          <button
            onClick={onSidebarToggle}
            className="lg:hidden p-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-95"
            aria-label="Toggle sidebar"
          >
            <FaBars className="w-5 h-5" />
          </button>

          {/* Desktop sidebar toggle */}
          <button
            onClick={onSidebarToggle}
            className="hidden lg:flex items-center justify-center w-9 h-9 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-all"
            aria-label="Toggle sidebar"
          >
            {isSidebarCollapsed ? (
              <FaChevronRight className="w-3.5 h-3.5" />
            ) : (
              <FaChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Page title */}
          <div className="flex items-center gap-2">
            <h1 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white font-display tracking-tight">
              {getPageTitle()}
            </h1>
          </div>
        </div>

        {/* Right section */}
        {user && (
          <div className="flex items-center gap-2 md:gap-3">
            {/* Theme toggle */}
            <ThemeToggle />

            {/* User info - hidden on mobile */}
            <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 bg-gray-50 dark:bg-emerald-500/5 rounded-xl border border-transparent dark:border-emerald-500/10">
              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-primary/10 to-primary/20 dark:from-emerald-500/20 dark:to-emerald-500/10 text-primary dark:text-emerald-400 rounded-lg">
                <FaUser className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-emerald-100 max-w-[100px] truncate">
                {user.username}
              </span>
            </div>

            {/* Logout button */}
            <button
              className="flex items-center gap-2 px-3 md:px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-[#161d1a] rounded-xl hover:bg-gray-200 dark:hover:bg-emerald-500/10 hover:text-gray-900 dark:hover:text-emerald-300 border border-transparent dark:border-emerald-900/30 transition-all active:scale-95"
              onClick={handleLogout}
              title="Logout"
            >
              <FaSignOutAlt className="w-4 h-4" />
              <span className="hidden md:inline">Logout</span>
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
