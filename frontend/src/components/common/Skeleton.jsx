import PropTypes from "prop-types";

/**
 * Shimmer placeholder shown while data loads. Compose freely:
 *   <Skeleton className="h-4 w-32" />
 * Card/table helpers below match the app's list layouts.
 */

export const Skeleton = ({ className = "" }) => (
  <div
    className={`animate-shimmer rounded-lg bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 dark:from-[#161d1a] dark:via-[#1e2823] dark:to-[#161d1a] bg-[length:200%_100%] ${className}`}
  />
);

Skeleton.propTypes = {
  className: PropTypes.string,
};

/** Placeholder for a list of mobile cards. */
export const CardListSkeleton = ({ count = 4 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }, (_, index) => (
      <div
        key={index}
        className="rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-4"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      </div>
    ))}
  </div>
);

CardListSkeleton.propTypes = {
  count: PropTypes.number,
};

/** Placeholder for a desktop table. */
export const TableSkeleton = ({ rows = 6, columns = 5 }) => (
  <div className="overflow-hidden rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a]">
    <div className="bg-gray-50 dark:bg-[#0f1a16] px-4 py-3">
      <Skeleton className="h-3 w-1/3" />
    </div>
    <div className="divide-y divide-gray-100 dark:divide-emerald-900/20">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: columns }, (_, colIndex) => (
            <Skeleton key={colIndex} className={`h-4 ${colIndex === 0 ? "w-1/4" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

TableSkeleton.propTypes = {
  rows: PropTypes.number,
  columns: PropTypes.number,
};

export default Skeleton;
