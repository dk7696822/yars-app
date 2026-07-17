import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaPlus, FaSearch, FaCheckCircle, FaTruck, FaEdit, FaTrash } from "react-icons/fa";
import { supplierAPI } from "../services/inventoryAPI";
import Pagination from "../components/common/Pagination";
import { CardListSkeleton, TableSkeleton } from "../components/common/Skeleton";
import ConfirmationModal from "../components/common/ConfirmationModal";

const inputClasses =
  "min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-sm text-gray-900 dark:text-emerald-50";

const Suppliers = () => {
  const location = useLocation();

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      window.history.replaceState({}, "");
      const timer = setTimeout(() => setSuccessMessage(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search.trim()) params.search = search.trim();

      const { rows: data, pagination: meta } = await supplierAPI.getAll(params);
      setRows(data);
      setPagination(meta);
      setError("");
    } catch (err) {
      console.error("Error fetching suppliers:", err);
      setError("Failed to load suppliers. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(fetchSuppliers, 300);
    return () => clearTimeout(timer);
  }, [fetchSuppliers]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await supplierAPI.delete(deleteTarget.id);
      setSuccessMessage("Supplier deleted successfully");
      setTimeout(() => setSuccessMessage(""), 4000);
      fetchSuppliers();
    } catch (err) {
      console.error("Error deleting supplier:", err);
      // 409: "Cannot delete this supplier as it is being used by purchase orders or goods receipts"
      setError(err.response?.data?.message || "Failed to delete supplier.");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {successMessage && (
        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 p-4 flex items-start gap-3">
          <FaCheckCircle className="text-green-500 mt-0.5 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400">{successMessage}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-emerald-50">Suppliers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Who you buy raw material from</p>
        </div>
        <Link
          to="/suppliers/new"
          className="flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/25 active:scale-95 transition-all"
        >
          <FaPlus className="w-3 h-3" />
          <span className="hidden sm:inline">New Supplier</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      <div className="relative">
        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, or GST…"
          className={`w-full pl-11 pr-4 ${inputClasses}`}
        />
      </div>

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
          <FaTruck className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">No suppliers found</p>
          <Link to="/suppliers/new" className="inline-block mt-3 text-primary dark:text-emerald-400 font-medium">
            Add a supplier
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden stagger-list">
            {rows.map((supplier) => (
              <div
                key={supplier.id}
                className="rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/suppliers/${supplier.id}`} className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-emerald-50 truncate">{supplier.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {supplier.phone || "No phone"}
                      {supplier.gst_number ? ` · GST ${supplier.gst_number}` : ""}
                    </p>
                  </Link>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      to={`/suppliers/edit/${supplier.id}`}
                      className="flex items-center justify-center w-11 h-11 rounded-xl border border-gray-200 dark:border-emerald-900/40 text-gray-600 dark:text-emerald-100"
                      aria-label="Edit supplier"
                    >
                      <FaEdit className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(supplier)}
                      className="flex items-center justify-center w-11 h-11 rounded-xl border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400"
                      aria-label="Delete supplier"
                    >
                      <FaTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200/60 dark:border-emerald-900/30">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#0f1a16]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">GST</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-emerald-900/20 bg-white dark:bg-[#161d1a]">
                {rows.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-emerald-500/5">
                    <td className="px-4 py-3">
                      <Link to={`/suppliers/${supplier.id}`} className="font-medium text-gray-900 dark:text-emerald-50 hover:text-primary">
                        {supplier.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{supplier.phone || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{supplier.email || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{supplier.gst_number || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/suppliers/edit/${supplier.id}`}
                          className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-emerald-900/40 text-gray-600 dark:text-emerald-100 hover:bg-gray-50 dark:hover:bg-emerald-500/10"
                          aria-label="Edit supplier"
                        >
                          <FaEdit className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(supplier)}
                          className="flex items-center justify-center w-9 h-9 rounded-lg border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                          aria-label="Delete supplier"
                        >
                          <FaTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete supplier"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
};

export default Suppliers;
