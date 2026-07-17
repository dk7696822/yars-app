import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaTrash, FaArrowLeft } from "react-icons/fa";
import { inventoryItemAPI, supplierAPI, purchaseOrderAPI } from "../services/inventoryAPI";
import { formatCurrency } from "../utils/formatters";

const todayISO = () => new Date().toISOString().split("T")[0];

const inputClasses =
  "w-full min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-gray-900 dark:text-emerald-50";

const lineTotal = (line) => (parseFloat(line.quantity) || 0) * (parseFloat(line.rate) || 0);

const CreatePurchaseOrder = () => {
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);

  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(todayISO());
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([{ item_id: "", quantity: "", rate: "" }]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [supplierData, itemData] = await Promise.all([
          supplierAPI.getAllForPicker(),
          inventoryItemAPI.getAllForPicker(),
        ]);
        setSuppliers(supplierData);
        setItems(itemData);
      } catch (err) {
        console.error("Error loading purchase order form:", err);
        setError("Failed to load suppliers and items. Please try again.");
      }
    };
    load();
  }, []);

  const updateLine = (index, field, value) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  };

  const addLine = () => setLines((current) => [...current, { item_id: "", quantity: "", rate: "" }]);

  const removeLine = (index) => setLines((current) => current.filter((_, i) => i !== index));

  const grandTotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const validLines = lines.filter(
      (line) => line.item_id && parseFloat(line.quantity) > 0 && parseFloat(line.rate) > 0
    );

    if (!supplierId) {
      setError("Choose a supplier.");
      return;
    }

    if (validLines.length === 0) {
      setError("Add at least one item with a quantity and rate.");
      return;
    }

    try {
      setSaving(true);

      const response = await purchaseOrderAPI.create({
        supplier_id: supplierId,
        order_date: orderDate,
        expected_date: expectedDate || null,
        notes: notes || null,
        items: validLines.map((line) => ({
          item_id: line.item_id,
          quantity_ordered: parseFloat(line.quantity),
          rate: parseFloat(line.rate),
        })),
      });

      const created = response.data.data;
      navigate(`/purchase-orders/${created.id}`, {
        state: { message: "Purchase order created successfully" },
      });
    } catch (err) {
      console.error("Error creating purchase order:", err);
      setError(err.response?.data?.message || "Failed to create purchase order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 pb-28">
      <button
        type="button"
        onClick={() => navigate("/purchase-orders")}
        className="flex items-center gap-2 mb-4 text-sm text-gray-600 dark:text-gray-400 min-h-[44px]"
      >
        <FaArrowLeft className="w-3 h-3" /> Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-emerald-50 mb-1">New Purchase Order</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Order raw material from a supplier</p>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Supplier <span className="text-red-500">*</span>
          </label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClasses} required>
            <option value="">Select supplier…</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Order date</label>
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={inputClasses} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Expected delivery <span className="text-gray-400">(optional)</span>
            </label>
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={inputClasses} />
          </div>
        </div>

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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Quantity{selectedItem ? ` (${selectedItem.unit})` : ""}
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
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Rate (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={line.rate}
                      onChange={(e) => updateLine(index, "rate", e.target.value)}
                      placeholder="0"
                      className={inputClasses}
                    />
                  </div>
                </div>

                {lineTotal(line) > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Line total: <span className="font-semibold text-gray-900 dark:text-emerald-50">{formatCurrency(lineTotal(line))}</span>
                  </p>
                )}
              </div>
            );
          })}

          <div className="flex items-center justify-between rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-gray-50 dark:bg-[#0f1a16] p-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Grand total</p>
            <p className="text-lg font-bold text-gray-900 dark:text-emerald-50">{formatCurrency(grandTotal)}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputClasses} py-2`} />
        </div>

        {/* Thumb-reachable primary action, pinned on mobile. */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-[#0f1a16]/95 backdrop-blur border-t border-gray-200 dark:border-emerald-900/30 sm:static sm:p-0 sm:bg-transparent sm:dark:bg-transparent sm:border-0 sm:backdrop-blur-none">
          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[52px] rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Create purchase order"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePurchaseOrder;
