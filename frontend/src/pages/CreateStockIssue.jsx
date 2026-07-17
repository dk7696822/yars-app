import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaTrash, FaArrowLeft } from "react-icons/fa";
import { inventoryItemAPI, stockIssueAPI, stockAPI } from "../services/inventoryAPI";
import { orderAPI } from "../services/api";

const RECENT_ITEMS_KEY = "yars_recent_inventory_items";

/** Item ids the user issued most recently, newest first. Kept on the device. */
const getRecentItemIds = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_ITEMS_KEY) || "[]");
  } catch {
    return [];
  }
};

const rememberRecentItems = (itemIds) => {
  const existing = getRecentItemIds();
  const merged = [...itemIds, ...existing.filter((id) => !itemIds.includes(id))];
  localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(merged.slice(0, 8)));
};

const todayISO = () => new Date().toISOString().split("T")[0];

const CreateStockIssue = () => {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stockByItem, setStockByItem] = useState({});

  const [issueDate, setIssueDate] = useState(todayISO());
  const [issueType, setIssueType] = useState("ISSUE");
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([{ item_id: "", quantity: "", wastage_quantity: "" }]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isAdjustment = issueType === "ADJUSTMENT_IN" || issueType === "ADJUSTMENT_OUT";

  useEffect(() => {
    const load = async () => {
      try {
        const [itemData, orderResponse] = await Promise.all([
          inventoryItemAPI.getAllForPicker(),
          orderAPI.getAll(),
        ]);

        // Recently-issued items float to the top of the picker: on a phone,
        // scrolling a 40-item dropdown every day is the difference between
        // this getting used and not.
        const recent = getRecentItemIds();
        const sorted = [...itemData].sort((a, b) => {
          const aRank = recent.indexOf(a.id);
          const bRank = recent.indexOf(b.id);
          if (aRank === -1 && bRank === -1) return a.name.localeCompare(b.name);
          if (aRank === -1) return 1;
          if (bRank === -1) return -1;
          return aRank - bRank;
        });

        setItems(sorted);
        setOrders(orderResponse.data.data || []);
      } catch (err) {
        console.error("Error loading issue form:", err);
        setError("Failed to load items. Please try again.");
      }
    };
    load();
  }, []);

  /** Show available stock next to the quantity box, so an over-issue is obvious BEFORE saving. */
  const loadStockFor = async (itemId) => {
    if (!itemId || stockByItem[itemId] !== undefined) return;
    try {
      const data = await stockAPI.getItemStock(itemId);
      setStockByItem((current) => ({ ...current, [itemId]: data.in_stock }));
    } catch (err) {
      console.error("Error loading item stock:", err);
    }
  };

  const updateLine = (index, field, value) => {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    );
    if (field === "item_id") loadStockFor(value);
  };

  const addLine = () => setLines((current) => [...current, { item_id: "", quantity: "", wastage_quantity: "" }]);

  const removeLine = (index) => setLines((current) => current.filter((_, i) => i !== index));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const validLines = lines.filter((line) => line.item_id && parseFloat(line.quantity) > 0);

    if (validLines.length === 0) {
      setError("Add at least one item with a quantity.");
      return;
    }

    if (isAdjustment && !reason.trim()) {
      setError("A reason is required for a stock adjustment.");
      return;
    }

    try {
      setSaving(true);

      await stockIssueAPI.create({
        issue_date: issueDate,
        issue_type: issueType,
        order_id: !isAdjustment && orderId ? orderId : null,
        reason: isAdjustment ? reason : null,
        notes: notes || null,
        items: validLines.map((line) => ({
          item_id: line.item_id,
          quantity: parseFloat(line.quantity),
          wastage_quantity: line.wastage_quantity ? parseFloat(line.wastage_quantity) : 0,
        })),
      });

      rememberRecentItems(validLines.map((line) => line.item_id));

      navigate("/stock-issues", { state: { message: "Stock issue recorded successfully" } });
    } catch (err) {
      console.error("Error recording stock issue:", err);
      // The backend's insufficient-stock message names the item and the shortfall.
      // Surface it verbatim — it is the most useful error in the app.
      setError(err.response?.data?.message || "Failed to record stock issue.");
    } finally {
      setSaving(false);
    }
  };

  const inputClasses =
    "w-full min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-gray-900 dark:text-emerald-50";

  return (
    <div className="p-4 sm:p-6 pb-28">
      <button
        type="button"
        onClick={() => navigate("/stock-issues")}
        className="flex items-center gap-2 mb-4 text-sm text-gray-600 dark:text-gray-400 min-h-[44px]"
      >
        <FaArrowLeft className="w-3 h-3" /> Back
      </button>

      <h1 className="hidden sm:block text-2xl font-bold text-gray-900 dark:text-emerald-50 mb-1">Record Stock Issue</h1>
      <p className="hidden sm:block text-sm text-gray-500 dark:text-gray-400 mb-5">Material used in production today</p>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className={inputClasses}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <select value={issueType} onChange={(e) => setIssueType(e.target.value)} className={inputClasses}>
              <option value="ISSUE">Production issue</option>
              <option value="WASTAGE">Wastage write-off</option>
              <option value="ADJUSTMENT_OUT">Adjustment — remove stock</option>
              <option value="ADJUSTMENT_IN">Adjustment — add stock</option>
            </select>
          </div>
        </div>

        {isAdjustment && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Stock take shortfall, water damage"
              className={inputClasses}
              required
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Required. In six months this is the only thing that will explain the correction.
            </p>
          </div>
        )}

        {!isAdjustment && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Customer order <span className="text-gray-400">(optional)</span>
            </label>
            <select value={orderId} onChange={(e) => setOrderId(e.target.value)} className={inputClasses}>
              <option value="">Not linked to an order</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.customer?.name} — {new Date(order.order_date).toLocaleDateString("en-IN")}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-emerald-50">Items</h2>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-primary text-white text-sm font-medium"
            >
              <FaPlus className="w-3 h-3" /> Add item
            </button>
          </div>

          {lines.map((line, index) => {
            const selectedItem = items.find((item) => item.id === line.item_id);
            const available = stockByItem[line.item_id];
            const requested =
              (parseFloat(line.quantity) || 0) + (parseFloat(line.wastage_quantity) || 0);
            const exceedsStock = available !== undefined && requested > available;

            return (
              <div
                key={index}
                className="rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-4 space-y-3"
              >
                <div className="flex items-start gap-2">
                  <select
                    value={line.item_id}
                    onChange={(e) => updateLine(index, "item_id", e.target.value)}
                    className={inputClasses}
                  >
                    <option value="">Select item…</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.unit})
                      </option>
                    ))}
                  </select>

                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="shrink-0 flex items-center justify-center w-11 h-11 rounded-xl border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400"
                      aria-label="Remove item"
                    >
                      <FaTrash className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {available !== undefined && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Available: <span className="font-semibold">{available} {selectedItem?.unit}</span>
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Quantity used
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, "quantity", e.target.value)}
                      placeholder="0"
                      className={inputClasses}
                    />
                  </div>

                  {!isAdjustment && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Wastage <span className="text-gray-400">(optional)</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={line.wastage_quantity}
                        onChange={(e) => updateLine(index, "wastage_quantity", e.target.value)}
                        placeholder="0"
                        className={inputClasses}
                      />
                    </div>
                  )}
                </div>

                {exceedsStock && (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">
                    Only {available} {selectedItem?.unit} in stock — this needs {requested}.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={`${inputClasses} py-2`}
          />
        </div>

        {/* Thumb-reachable primary action, pinned on mobile. */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-[#0f1a16]/95 backdrop-blur border-t border-gray-200 dark:border-emerald-900/30 sm:static sm:p-0 sm:bg-transparent sm:dark:bg-transparent sm:border-0 sm:backdrop-blur-none">
          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[52px] rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Record issue"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateStockIssue;
