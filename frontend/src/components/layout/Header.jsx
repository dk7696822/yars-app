import { useState } from "react";
import { useLocation } from "react-router-dom";
import { FaSignOutAlt, FaUser, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { ThemeToggle } from "../theme/ThemeToggle";
import ConfirmationModal from "../common/ConfirmationModal";
import PropTypes from "prop-types";

// Most specific prefix first — "/stock-issues" must win over "/stock".
const PAGE_TITLES = [
  ["/orders/new", "New Order"],
  ["/orders/edit", "Edit Order"],
  ["/orders", "Orders"],
  ["/customers/new", "New Customer"],
  ["/customers/edit", "Edit Customer"],
  ["/customers", "Customers"],
  ["/plate-types/new", "New Plate Type"],
  ["/plate-types/edit", "Edit Plate Type"],
  ["/plate-types", "Plate Types"],
  ["/product-sizes/new", "New Product Size"],
  ["/product-sizes/edit", "Edit Product Size"],
  ["/product-sizes", "Product Sizes"],
  ["/expense-categories", "Expense Categories"],
  ["/expenses/new", "New Expense"],
  ["/expenses/edit", "Edit Expense"],
  ["/expenses", "Expenses"],
  ["/invoices/generate", "Generate Invoice"],
  ["/invoices", "Invoices"],
  ["/history", "History"],
  ["/stock-issues/new", "New Stock Issue"],
  ["/stock-issues", "Stock Issues"],
  ["/stock", "Stock"],
  ["/inventory-items/new", "New Inventory Item"],
  ["/inventory-items/edit", "Edit Inventory Item"],
  ["/inventory-items", "Inventory Items"],
  ["/purchase-orders/new", "New Purchase Order"],
  ["/purchase-orders", "Purchase Orders"],
  ["/suppliers/new", "New Supplier"],
  ["/suppliers/edit", "Edit Supplier"],
  ["/suppliers", "Suppliers"],
  ["/inventory-categories", "Inventory Categories"],
  ["/item-attributes", "Item Attributes"],
];

const Header = ({ onSidebarToggle, isSidebarCollapsed }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/") return "Dashboard";
    const match = PAGE_TITLES.find(([prefix]) => path.startsWith(prefix));
    return match ? match[1] : "YARS";
  };

  return (
    <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0d1210]/90 backdrop-blur-xl border-b border-gray-200/60 dark:border-emerald-900/20">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        {/* Left section */}
        <div className="flex items-center gap-3">
          {/* Desktop sidebar toggle — phones navigate via the bottom tab bar */}
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
              onClick={() => setShowLogoutModal(true)}
              title="Logout"
            >
              <FaSignOutAlt className="w-4 h-4" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={logout}
        title="Log out"
        message="You will need to sign in again to use the app."
        confirmText="Log out"
        cancelText="Stay"
        type="warning"
      />
    </header>
  );
};

Header.propTypes = {
  onSidebarToggle: PropTypes.func,
  isSidebarCollapsed: PropTypes.bool,
};

export default Header;
