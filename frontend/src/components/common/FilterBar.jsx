import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FaSearch, FaSlidersH, FaChevronDown, FaTimes } from "react-icons/fa";

/**
 * The app-wide filter pattern:
 *  - search stays visible and applies as you type (pages debounce the fetch)
 *  - every other control lives in a panel that is COLLAPSED by default,
 *    behind a "Filters" button with an active-count badge
 *  - active filters render as removable chips below the bar, visible even
 *    while the panel is closed, plus a "Clear all"
 *
 * Pages pass their own inputs as children; changes should apply immediately
 * (no Apply button).
 */
const FilterBar = ({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  activeCount = 0,
  chips = [],
  onClearAll,
  trailing = null,
  children,
}) => {
  const [open, setOpen] = useState(false);
  // Popovers (date pickers, dropdown menus) inside the panel need
  // overflow-visible, but the collapse animation needs overflow-hidden.
  // Switch after the 300ms open transition finishes.
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!open) {
      setSettled(false);
      return;
    }
    const timer = setTimeout(() => setSettled(true), 320);
    return () => clearTimeout(timer);
  }, [open]);

  const hasSearch = typeof onSearchChange === "function";

  return (
    <div className="space-y-3">
      <div className="flex gap-2 sm:gap-3">
        {hasSearch && (
          <div className="relative flex-1 min-w-0">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full min-h-[44px] pl-11 pr-4 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-sm text-gray-900 dark:text-emerald-50 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary dark:focus:border-emerald-500/50 transition-all"
            />
          </div>
        )}

        {children && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className={`relative inline-flex items-center justify-center gap-2 min-h-[44px] px-3.5 sm:px-4 rounded-xl border text-sm font-medium transition-all active:scale-95 whitespace-nowrap ${
              open || activeCount > 0
                ? "border-primary/40 bg-primary/5 text-primary dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-gray-700 dark:text-emerald-100"
            }`}
          >
            <FaSlidersH className="w-4 h-4" />
            <span className={hasSearch ? "hidden sm:inline" : ""}>Filters</span>
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary dark:bg-emerald-500 text-[10px] font-bold text-white leading-none">
                {activeCount}
              </span>
            )}
            <FaChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>
        )}

        {trailing}
      </div>

      {children && (
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className={settled ? "overflow-visible" : "overflow-hidden"}>
            <div className="rounded-2xl border border-gray-200/70 dark:border-emerald-900/30 bg-gray-50/80 dark:bg-[#0d1411] p-4 sm:p-5">
              {children}
            </div>
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 animate-fade-in">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              title="Remove filter"
              className="group inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-primary/10 dark:bg-emerald-500/15 text-xs font-medium text-primary-700 dark:text-emerald-300 hover:bg-primary/15 dark:hover:bg-emerald-500/25 transition-colors"
            >
              {chip.label}
              <FaTimes className="w-3 h-3 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
          {onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
};

FilterBar.propTypes = {
  search: PropTypes.string,
  onSearchChange: PropTypes.func,
  searchPlaceholder: PropTypes.string,
  activeCount: PropTypes.number,
  chips: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      onRemove: PropTypes.func.isRequired,
    })
  ),
  onClearAll: PropTypes.func,
  trailing: PropTypes.node,
  children: PropTypes.node,
};

export default FilterBar;
