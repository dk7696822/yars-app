import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaFileInvoice } from "react-icons/fa";
import { purchaseOrderAPI, supplierAPI } from "../services/inventoryAPI";
import { formatCurrency, formatDate } from "../utils/formatters";
import Pagination from "../components/common/Pagination";
import FilterBar from "../components/common/FilterBar";
import { CardListSkeleton, TableSkeleton } from "../components/common/Skeleton";

const STATUSES = ["PENDING", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"];

const STATUS_BADGES = {
  PENDING: "bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300",
  PARTIALLY_RECEIVED: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
  RECEIVED: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  CANCELLED: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300",
};

const StatusBadge = ({ status }) => (
  <span className={`px-2 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${STATUS_BADGES[status] || STATUS_BADGES.PENDING}`}>
    {status.replace(/_/g, " ")}
  </span>
);

const inputClasses =
  "min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-sm text-gray-900 dark:text-emerald-50";

const PurchaseOrders = () => {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search.trim()) params.search = search.trim();
      if (supplierId) params.supplier_id = supplierId;
      if (status) params.status = status;

      const { rows: data, pagination: meta } = await purchaseOrderAPI.getAll(params);
      setRows(data);
      setPagination(meta);
      setError("");
    } catch (err) {
      console.error("Error fetching purchase orders:", err);
      setError("Failed to load purchase orders. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, search, supplierId, status]);

  useEffect(() => {
    const timer = setTimeout(fetchOrders, 300);
    return () => clearTimeout(timer);
  }, [fetchOrders]);

  useEffect(() => {
    setPage(1);
  }, [search, supplierId, status]);

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        setSuppliers(await supplierAPI.getAllForPicker());
      } catch (err) {
        console.error("Error loading suppliers:", err);
      }
    };
    loadSuppliers();
  }, []);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="hidden sm:block">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-emerald-50">Purchase Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Material ordered from suppliers</p>
        </div>
        <Link
          to="/purchase-orders/new"
          className="flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/25 active:scale-95 transition-all"
        >
          <FaPlus className="w-3 h-3" />
          <span className="hidden sm:inline">New PO</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search PO number…"
        activeCount={(supplierId ? 1 : 0) + (status ? 1 : 0)}
        chips={[
          supplierId && {
            key: "supplier",
            label: suppliers.find((supplier) => supplier.id === supplierId)?.name || "Supplier",
            onRemove: () => setSupplierId(""),
          },
          status && { key: "status", label: status.replace(/_/g, " "), onRemove: () => setStatus("") },
        ].filter(Boolean)}
        onClearAll={() => {
          setSupplierId("");
          setStatus("");
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Supplier</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={`w-full ${inputClasses}`}>
              <option value="">All suppliers</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`w-full ${inputClasses}`}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
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
          <FaFileInvoice className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">No purchase orders found</p>
          <Link to="/purchase-orders/new" className="inline-block mt-3 text-primary dark:text-emerald-400 font-medium">
            Create a purchase order
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden stagger-list">
            {rows.map((po) => (
              <Link
                key={po.id}
                to={`/purchase-orders/${po.id}`}
                className="block rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-emerald-50">{po.po_number}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{po.supplier?.name}</p>
                  </div>
                  <StatusBadge status={po.status} />
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Ordered</p>
                    <p className="font-medium text-gray-900 dark:text-emerald-50">{formatDate(po.order_date)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Expected</p>
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      {po.expected_date ? formatDate(po.expected_date) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Value</p>
                    <p className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(po.total_amount || 0)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200/60 dark:border-emerald-900/30">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#0f1a16]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">PO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Order date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Expected</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-emerald-900/20 bg-white dark:bg-[#161d1a]">
                {rows.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-emerald-500/5">
                    <td className="px-4 py-3">
                      <Link to={`/purchase-orders/${po.id}`} className="font-medium text-gray-900 dark:text-emerald-50 hover:text-primary">
                        {po.po_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{po.supplier?.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDate(po.order_date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {po.expected_date ? formatDate(po.expected_date) : "—"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={po.status} /></td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">{formatCurrency(po.total_amount || 0)}</td>
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

export default PurchaseOrders;
