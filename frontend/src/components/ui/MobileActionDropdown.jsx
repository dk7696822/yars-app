import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaEllipsisV } from "react-icons/fa";
import PropTypes from "prop-types";

const MobileActionDropdown = ({ actions, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleActionClick = (action) => {
    if (action.onClick) {
      action.onClick();
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Desktop view - show individual buttons */}
      <div className="hidden md:flex justify-end items-center space-x-2">
        {actions.map((action, index) =>
          action.to ? (
            <Link
              key={index}
              to={action.to}
              title={action.title}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-0 text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-600"
            >
              <action.icon className={`h-4 w-4 ${action.iconColor || "text-gray-600 dark:text-gray-300"}`} />
            </Link>
          ) : (
            <button
              key={index}
              onClick={action.onClick}
              title={action.title}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-0 text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-600"
            >
              <action.icon className={`h-4 w-4 ${action.iconColor || "text-gray-600 dark:text-gray-300"}`} />
            </button>
          )
        )}
      </div>

      {/* Mobile view - show dropdown */}
      <div className="md:hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-0 text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-600"
          aria-label="Actions"
        >
          <FaEllipsisV className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
            <div className="py-1">
              {actions.map((action, index) =>
                action.to ? (
                  <Link
                    key={index}
                    to={action.to}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <action.icon className={`h-4 w-4 mr-3 ${action.iconColor || "text-gray-600 dark:text-gray-300"}`} />
                    {action.title}
                  </Link>
                ) : (
                  <button
                    key={index}
                    onClick={() => handleActionClick(action)}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <action.icon className={`h-4 w-4 mr-3 ${action.iconColor || "text-gray-600 dark:text-gray-300"}`} />
                    {action.title}
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

MobileActionDropdown.propTypes = {
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      icon: PropTypes.elementType.isRequired,
      iconColor: PropTypes.string,
      to: PropTypes.string,
      onClick: PropTypes.func,
    })
  ).isRequired,
  className: PropTypes.string,
};

export default MobileActionDropdown;
