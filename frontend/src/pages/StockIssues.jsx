import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaPlus, FaCheckCircle, FaClipboardList } from "react-icons/fa";
import { stockIssueAPI } from "../services/inventoryAPI";
import { formatCurrency, formatDate } from "../utils/formatters";
import Pagination from "../components/common/Pagination";
import FilterBar from "../components/common/FilterBar";
import { CardListSkeleton, TableSkeleton } from "../components/common/Skeleton";

const ISSUE_TYPES = ["ISSUE", "WASTAGE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"];

const TYPE_BADGES = {
  ISSUE: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  WASTAGE: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300",
  ADJUSTMENT_IN: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300",
  ADJUSTMENT_OUT: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
};

const TypeBadge = ({ type }) => (
  <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${TYPE_BADGES[type] || TYPE_BADGES.ISSUE}`}>
    {type.replace(/_/g, " ")}
  </span>
);

const inputClasses =
  "min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-sm text-gray-900 dark:text-emerald-50";

const StockIssues = () => {
  const location = useLocation();

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [search, setSearch] = useState("");
  const [issueType, setIssueType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  // Success banner from the entry form's navigation state.
  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      window.history.replaceState({}, "");
      const timer = setTimeout(() => setSuccessMessage(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search.trim()) params.search = search.trim();
      if (issueType) params.issue_type = issueType;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const { rows: data, pagination: meta } = await stockIssueAPI.getAll(params);
      setRows(data);
      setPagination(meta);
      setError("");
    } catch (err) {
      console.error("Error fetching stock issues:", err);
      setError("Failed to load stock issues. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, search, issueType, fromDate, toDate]);

  useEffect(() => {
    const timer = setTimeout(fetchIssues, 300);
    return () => clearTimeout(timer);
  }, [fetchIssues]);

  useEffect(() => {
    setPage(1);
  }, [search, issueType, fromDate, toDate]);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {successMessage && (
        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 p-4 flex items-start gap-3">
          <FaCheckCircle className="text-green-500 mt-0.5 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400">{successMessage}</p>
        </div>
      )}

      <div className="hidden sm:block">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-emerald-50">Stock Issues</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Material consumed, wasted, or adjusted</p>
      </div>

      {/* The daily action — first thing on the page, full width on a phone. */}
      <Link
        to="/stock-issues/new"
        className="flex items-center justify-center gap-2 w-full sm:w-auto sm:inline-flex min-h-[52px] px-6 rounded-xl bg-primary text-white font-semibold shadow-lg shadow-primary/25 active:scale-95 transition-all"
      >
        <FaPlus className="w-4 h-4" /> Record issue
      </Link>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search issue number…"
        activeCount={(issueType ? 1 : 0) + (fromDate ? 1 : 0) + (toDate ? 1 : 0)}
        chips={[
          issueType && { key: "type", label: issueType.replace(/_/g, " "), onRemove: () => setIssueType("") },
          fromDate && { key: "from", label: `From ${fromDate}`, onRemove: () => setFromDate("") },
          toDate && { key: "to", label: `To ${toDate}`, onRemove: () => setToDate("") },
        ].filter(Boolean)}
        onClearAll={() => {
          setIssueType("");
          setFromDate("");
          setToDate("");
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
            <select value={issueType} onChange={(e) => setIssueType(e.target.value)} className={`w-full ${inputClasses}`}>
              <option value="">All types</option>
              {ISSUE_TYPES.map((type) => (
                <option key={type} value={type}>{type.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From date</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={`w-full ${inputClasses}`} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To date</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={`w-full ${inputClasses}`} />
          </div>
        </div>
      </FilterBar>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <>
          <div className="md:hidden">
            <CardListSkeleton count={5} />
          </div>
          <div className="hidden md:block">
            <TableSkeleton rows={8} columns={5} />
          </div>
        </>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center">
          <FaClipboardList className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">No stock issues found</p>
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden stagger-list">
            {rows.map((issue) => (
              <div
                key={issue.id}
                className="rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-emerald-50">{issue.issue_number}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(issue.issue_date)}</p>
                  </div>
                  <TypeBadge type={issue.issue_type} />
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Items</p>
                    <p className="font-medium text-gray-900 dark:text-emerald-50">{issue.items?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Total cost</p>
                    <p className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(issue.total_cost || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Wastage</p>
                    <p className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(issue.total_wastage_cost || 0)}</p>
                  </div>
                </div>

                {issue.order && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Order: {formatDate(issue.order.order_date)}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200/60 dark:border-emerald-900/30">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#0f1a16]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Issue</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Total cost</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Wastage cost</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-emerald-900/20 bg-white dark:bg-[#161d1a]">
                {rows.map((issue) => (
                  <tr key={issue.id} className="hover:bg-gray-50 dark:hover:bg-emerald-500/5">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-emerald-50">{issue.issue_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDate(issue.issue_date)}</td>
                    <td className="px-4 py-3"><TypeBadge type={issue.issue_type} /></td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">{issue.items?.length || 0}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">{formatCurrency(issue.total_cost || 0)}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">{formatCurrency(issue.total_wastage_cost || 0)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {issue.order ? formatDate(issue.order.order_date) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default StockIssues;
