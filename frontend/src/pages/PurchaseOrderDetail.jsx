import { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { FaArrowLeft, FaTruckLoading, FaCheckCircle } from "react-icons/fa";
import { purchaseOrderAPI } from "../services/inventoryAPI";
import { formatCurrency, formatDate } from "../utils/formatters";

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

const PurchaseOrderDetail = () => {
  const { id } = useParams();
  const location = useLocation();

  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      window.history.replaceState({}, "");
      const timer = setTimeout(() => setSuccessMessage(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setPo(await purchaseOrderAPI.getById(id));
        setError("");
      } catch (err) {
        console.error("Error loading purchase order:", err);
        setError(err.response?.data?.message || "Failed to load purchase order.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, location.key]);

  if (loading) {
    return <div className="p-6 py-16 text-center text-gray-500 dark:text-gray-400">Loading purchase order…</div>;
  }

  if (error || !po) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <Link to="/purchase-orders" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 min-h-[44px]">
          <FaArrowLeft className="w-3 h-3" /> Back to Purchase Orders
        </Link>
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error || "Purchase order not found."}
        </div>
      </div>
    );
  }

  const canReceive = po.status !== "RECEIVED" && po.status !== "CANCELLED";

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <Link to="/purchase-orders" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 min-h-[44px]">
        <FaArrowLeft className="w-3 h-3" /> Back to Purchase Orders
      </Link>

      {successMessage && (
        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 p-4 flex items-start gap-3">
          <FaCheckCircle className="text-green-500 mt-0.5 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400">{successMessage}</p>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-emerald-50">{po.po_number}</h1>
            <StatusBadge status={po.status} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {po.supplier?.name} · Ordered {formatDate(po.order_date)}
            {po.expected_date ? ` · Expected ${formatDate(po.expected_date)}` : ""}
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-emerald-50 mt-1">
            Total: {formatCurrency(po.total_amount || 0)}
          </p>
        </div>
      </div>

      {canReceive && (
        <Link
          to={`/purchase-orders/${po.id}/receive`}
          className="flex items-center justify-center gap-2 w-full sm:w-auto sm:inline-flex min-h-[52px] px-6 rounded-xl bg-primary text-white font-semibold shadow-lg shadow-primary/25 active:scale-95 transition-all"
        >
          <FaTruckLoading className="w-4 h-4" /> Receive material
        </Link>
      )}

      {/* Ordered vs received — the reason this page exists. */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-emerald-50">Items — ordered vs received</h2>

        {/* Mobile: cards */}
        <div className="space-y-3 md:hidden">
          {po.items.map((line) => (
            <div
              key={line.id}
              className="rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-emerald-50 truncate">{line.item?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Rate {formatCurrency(line.rate)}</p>
                </div>
                {line.quantity_pending === 0 ? (
                  <span className="shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    DONE
                  </span>
                ) : (
                  <span className="shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    PENDING
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Ordered</p>
                  <p className="font-semibold text-gray-900 dark:text-emerald-50">
                    {parseFloat(line.quantity_ordered)} {line.item?.unit}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Received</p>
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">
                    {parseFloat(line.quantity_received)} {line.item?.unit}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Pending</p>
                  <p className={`font-medium ${line.quantity_pending > 0 ? "text-amber-700 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"}`}>
                    {line.quantity_pending} {line.item?.unit}
                  </p>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Item</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Rate</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Ordered</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Received</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-emerald-900/20 bg-white dark:bg-[#161d1a]">
              {po.items.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-emerald-50">{line.item?.name}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">{formatCurrency(line.rate)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-emerald-50">
                    {parseFloat(line.quantity_ordered)} {line.item?.unit}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-emerald-700 dark:text-emerald-400">
                    {parseFloat(line.quantity_received)} {line.item?.unit}
                  </td>
                  <td className={`px-4 py-3 text-right text-sm ${line.quantity_pending > 0 ? "text-amber-700 dark:text-amber-400 font-medium" : "text-gray-500 dark:text-gray-400"}`}>
                    {line.quantity_pending} {line.item?.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipts against this PO */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-emerald-50">Goods receipts</h2>

        {!po.receipts || po.receipts.length === 0 ? (
          <div className="py-8 text-center rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a]">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Nothing received yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {po.receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-4"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-emerald-50">{receipt.receipt_number}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(receipt.receipt_date)}
                    {receipt.supplier_bill_ref ? ` · Bill ${receipt.supplier_bill_ref}` : ""}
                  </p>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {(receipt.items || []).map((line) => parseFloat(line.quantity_received)).reduce((a, b) => a + b, 0)} units
                  <span className="text-xs text-gray-500 dark:text-gray-400"> · {(receipt.items || []).length} line{(receipt.items || []).length === 1 ? "" : "s"}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {po.notes && (
        <div className="rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{po.notes}</p>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderDetail;
