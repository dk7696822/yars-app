import { useState, useEffect } from "react";
import { FaHistory, FaFilter, FaChevronLeft, FaChevronRight, FaExclamationCircle } from "react-icons/fa";
import { auditLogAPI } from "../services/api";
import HistoryFilter from "../components/history/HistoryFilter";
import HistoryList from "../components/history/HistoryList";

const LOGS_PER_PAGE = 20;

// Skeleton loading component
const HistorySkeleton = () => (
  <div className="space-y-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="history-skeleton-item">
        <div className="history-skeleton history-skeleton-icon" />
        <div className="history-skeleton-content">
          <div className="flex gap-2 mb-2">
            <div className="history-skeleton history-skeleton-line" style={{ width: "60px", height: "24px" }} />
            <div className="history-skeleton history-skeleton-line" style={{ width: "70px", height: "24px" }} />
          </div>
          <div className="history-skeleton history-skeleton-line history-skeleton-line-medium" />
          <div className="history-skeleton history-skeleton-line history-skeleton-line-long" />
          <div className="history-skeleton history-skeleton-line history-skeleton-line-short" style={{ marginTop: "8px" }} />
        </div>
      </div>
    ))}
  </div>
);

const History = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: LOGS_PER_PAGE,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async (filterParams = {}, page = 1) => {
    try {
      setLoading(true);

      const params = { ...filterParams, page, limit: LOGS_PER_PAGE };

      const response = await auditLogAPI.getAll(params);

      setLogs(response.data.data.logs);
      setPagination(response.data.data.pagination);
      setError("");
    } catch (err) {
      console.error("Error fetching audit logs:", err);
      setError("Failed to load history. Please try again later.");
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleFilter = (filterParams) => {
    setFilters(filterParams);
    fetchLogs(filterParams, 1);
  };

  const handlePageChange = (newPage) => {
    fetchLogs(filters, newPage);
    // Scroll to top of list on page change
    document.querySelector('.history-list-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="page-container space-y-5 md:space-y-6">
      {/* Error alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <FaExclamationCircle className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Header */}
      <div className="history-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">History</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Track payment and order changes</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="history-btn inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all sm:hidden"
        >
          <FaFilter className={`h-4 w-4 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
          {showFilters ? "Hide Filters" : "Show Filters"}
        </button>
      </div>

      {/* Filter section */}
      <div
        className={`history-filter-section history-card relative bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200/60 dark:border-gray-700/50 shadow-soft transition-all duration-300 ease-out ${
          showFilters
            ? ""
            : "hidden sm:block"
        }`}
      >
        <div className="relative flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50 px-5 py-4">
          <h2 className="section-title flex items-center gap-2">
            <FaFilter className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            Filter History
          </h2>
        </div>
        <div className="relative p-4 md:p-5 overflow-visible">
          <HistoryFilter onFilter={handleFilter} />
        </div>
      </div>

      {/* History list */}
      <div className="history-list-section history-card relative bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200/60 dark:border-gray-700/50 shadow-soft overflow-hidden">
        <div className="relative flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50 px-5 py-4">
          <h2 className="section-title flex items-center gap-2">
            <FaHistory className="w-4 h-4 text-gray-400" />
            Activity Log
          </h2>
          <span className={`text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-3 py-1 rounded-full transition-all duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
            {pagination.total} {pagination.total === 1 ? "entry" : "entries"}
          </span>
        </div>
        <div className="relative p-4 md:p-5">
          {loading ? (
            <HistorySkeleton />
          ) : (
            <>
              <HistoryList logs={logs} key={pagination.page} />

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="history-pagination flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="history-pagination-btn inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <FaChevronLeft className="w-3 h-3" />
                    </button>
                    <span className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                      className="history-pagination-btn inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <FaChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default History;
