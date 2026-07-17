import PropTypes from "prop-types";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

/**
 * Server-side pagination control.
 * Deliberately minimal: prev / page indicator / next. Numbered page buttons do
 * not fit on a phone, and this app is used on a phone.
 */
const Pagination = ({ pagination, onPageChange, className = "" }) => {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, totalPages, total, limit } = pagination;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const buttonClasses =
    "flex items-center justify-center min-w-[44px] min-h-[44px] px-4 rounded-xl border border-gray-200 dark:border-emerald-900/40 " +
    "bg-white dark:bg-[#161d1a] text-gray-700 dark:text-emerald-100 " +
    "disabled:opacity-40 disabled:cursor-not-allowed " +
    "hover:bg-gray-50 dark:hover:bg-emerald-500/10 transition-colors";

  return (
    <div className={`flex items-center justify-between gap-3 mt-4 ${className}`}>
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={buttonClasses}
        aria-label="Previous page"
      >
        <FaChevronLeft className="w-4 h-4" />
      </button>

      <div className="text-center">
        <p className="text-sm font-medium text-gray-900 dark:text-emerald-50">
          Page {page} of {totalPages}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {from}–{to} of {total}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className={buttonClasses}
        aria-label="Next page"
      >
        <FaChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

Pagination.propTypes = {
  pagination: PropTypes.shape({
    page: PropTypes.number.isRequired,
    limit: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
    totalPages: PropTypes.number.isRequired,
  }),
  onPageChange: PropTypes.func.isRequired,
  className: PropTypes.string,
};

export default Pagination;
