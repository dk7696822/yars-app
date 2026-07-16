import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { FaArrowLeft, FaBoxOpen, FaRupeeSign, FaLayerGroup } from "react-icons/fa";
import { stockAPI } from "../services/inventoryAPI";
import { formatCurrency, formatDate } from "../utils/formatters";
import Pagination from "../components/common/Pagination";

const MOVEMENT_TYPES = ["RECEIPT", "ISSUE", "WASTAGE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"];
const INBOUND_TYPES = ["RECEIPT", "ADJUSTMENT_IN"];

const StatTile = ({ icon, label, value, tone = "default" }) => {
  const Icon = icon;
  const tones = {
    default: "bg-white dark:bg-[#161d1a] border-gray-200/60 dark:border-emerald-900/30",
    warning: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gray-500 dark:text-emerald-400" />
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-emerald-50 break-all">{value}</p>
    </div>
  );
};

const AttributeChips = ({ attributes }) => {
  if (!attributes || attributes.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {attributes.map((attribute) => (
        <span
          key={attribute.value_id}
          title={`${attribute.attribute_name}: ${attribute.value}`}
          className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-emerald-500/10 text-gray-600 dark:text-emerald-300"
        >
          {attribute.value}
        </span>
      ))}
    </div>
  );
};

const movementColor = (type) =>
  INBOUND_TYPES.includes(type)
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";

const movementSign = (type) => (INBOUND_TYPES.includes(type) ? "+" : "−");

const StockItemDetail = () => {
  const { itemId } = useParams();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [movements, setMovements] = useState([]);
  const [movementsPagination, setMovementsPagination] = useState(null);
  const [movementType, setMovementType] = useState("");
  const [movementsPage, setMovementsPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await stockAPI.getItemStock(itemId);
        setDetail(data);
        setError("");
      } catch (err) {
        console.error("Error loading item stock:", err);
        setError(err.response?.data?.message || "Failed to load item. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [itemId]);

  const fetchMovements = useCallback(async () => {
    try {
      const params = { page: movementsPage, limit: 20 };
      if (movementType) params.movement_type = movementType;
      const { rows, pagination } = await stockAPI.getItemMovements(itemId, params);
      setMovements(rows);
      setMovementsPagination(pagination);
    } catch (err) {
      console.error("Error loading movements:", err);
    }
  }, [itemId, movementType, movementsPage]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  useEffect(() => {
    setMovementsPage(1);
  }, [movementType]);

  if (loading) {
    return <div className="p-6 py-16 text-center text-gray-500 dark:text-gray-400">Loading item…</div>;
  }

  if (error || !detail) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <Link to="/stock" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 min-h-[44px]">
          <FaArrowLeft className="w-3 h-3" /> Back to Stock
        </Link>
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error || "Item not found."}
        </div>
      </div>
    );
  }

  const { item, in_stock, stock_value, batches } = detail;
  const reorderLevel = parseFloat(item.reorder_level) || 0;
  const isLow = reorderLevel > 0 && in_stock <= reorderLevel;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <Link to="/stock" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 min-h-[44px]">
        <FaArrowLeft className="w-3 h-3" /> Back to Stock
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-emerald-50 truncate">{item.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {item.category?.name}
            {item.item_code ? ` · ${item.item_code}` : ""} · {item.unit}
          </p>
          <AttributeChips attributes={item.attributes} />
        </div>
        {isLow && (
          <span className="shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
            LOW
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatTile icon={FaBoxOpen} label="In stock" value={`${in_stock} ${item.unit}`} tone={isLow ? "warning" : "default"} />
        <StatTile icon={FaRupeeSign} label="Stock value" value={formatCurrency(stock_value)} />
        <StatTile
          icon={FaLayerGroup}
          label="Reorder level"
          value={reorderLevel > 0 ? `${reorderLevel} ${item.unit}` : "—"}
          tone={isLow ? "warning" : "default"}
        />
      </div>

      {/* Open batches — FIFO order; the top row is what the next issue consumes. */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-emerald-50">
          Open batches <span className="font-normal text-gray-500 dark:text-gray-400">(oldest first — consumed first)</span>
        </h2>

        {batches.length === 0 ? (
          <div className="py-10 text-center rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a]">
            <p className="text-gray-500 dark:text-gray-400 text-sm">No stock on hand</p>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="space-y-3 md:hidden">
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className="rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-4"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="font-semibold text-gray-900 dark:text-emerald-50">{formatDate(batch.received_date)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{batch.supplier?.name || "—"}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Remaining</p>
                      <p className="font-semibold text-gray-900 dark:text-emerald-50">
                        {batch.quantity_remaining} {item.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Rate</p>
                      <p className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(batch.rate)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Value</p>
                      <p className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(batch.value)}</p>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Received</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Supplier</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Remaining</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-emerald-900/20 bg-white dark:bg-[#161d1a]">
                  {batches.map((batch) => (
                    <tr key={batch.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-emerald-50">{formatDate(batch.received_date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{batch.supplier?.name || "—"}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">{formatCurrency(batch.rate)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-emerald-50">
                        {batch.quantity_remaining} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">{formatCurrency(batch.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Movement history */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-emerald-50">Movement history</h2>
          <select
            value={movementType}
            onChange={(e) => setMovementType(e.target.value)}
            className="min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-sm text-gray-900 dark:text-emerald-50"
          >
            <option value="">All movements</option>
            {MOVEMENT_TYPES.map((type) => (
              <option key={type} value={type}>{type.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        {movements.length === 0 ? (
          <div className="py-10 text-center rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a]">
            <p className="text-gray-500 dark:text-gray-400 text-sm">No movements yet</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {movements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-4"
                >
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${movementColor(movement.movement_type)}`}>
                      {movement.movement_type.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(movement.movement_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${movementColor(movement.movement_type)}`}>
                      {movementSign(movement.movement_type)}{parseFloat(movement.quantity)} {item.unit}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(movement.total_cost)}</p>
                  </div>
                </div>
              ))}
            </div>

            <Pagination pagination={movementsPagination} onPageChange={setMovementsPage} />
          </>
        )}
      </div>
    </div>
  );
};

export default StockItemDetail;
