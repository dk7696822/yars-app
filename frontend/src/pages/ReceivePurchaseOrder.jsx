import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { purchaseOrderAPI } from "../services/inventoryAPI";
import { formatCurrency } from "../utils/formatters";

const todayISO = () => new Date().toISOString().split("T")[0];

const inputClasses =
  "w-full min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-emerald-900/40 bg-white dark:bg-[#161d1a] text-gray-900 dark:text-emerald-50";

const ReceivePurchaseOrder = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [po, setPo] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);

  const [receiptDate, setReceiptDate] = useState(todayISO());
  const [billRef, setBillRef] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await purchaseOrderAPI.getById(id);
        setPo(data);
        // Pre-fill with the pending quantity and the PO rate: "everything
        // arrived as ordered" must be one tap. Both stay editable.
        setLines(
          data.items.map((line) => ({
            purchase_order_item_id: line.id,
            item_name: line.item?.name,
            unit: line.item?.unit,
            pending: line.quantity_pending,
            quantity: line.quantity_pending > 0 ? String(line.quantity_pending) : "0",
            rate: String(parseFloat(line.rate)),
          }))
        );
        setError("");
      } catch (err) {
        console.error("Error loading purchase order:", err);
        setError(err.response?.data?.message || "Failed to load purchase order.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const updateLine = (index, field, value) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    // Zero-quantity lines are simply not part of this delivery.
    const receivedLines = lines.filter((line) => parseFloat(line.quantity) > 0);

    if (receivedLines.length === 0) {
      setError("Enter a received quantity on at least one line.");
      return;
    }

    if (receivedLines.some((line) => !(parseFloat(line.rate) > 0))) {
      setError("Every received line needs a rate greater than zero.");
      return;
    }

    try {
      setSaving(true);

      await purchaseOrderAPI.receive(id, {
        receipt_date: receiptDate,
        supplier_bill_ref: billRef || null,
        notes: notes || null,
        items: receivedLines.map((line) => ({
          purchase_order_item_id: line.purchase_order_item_id,
          quantity_received: parseFloat(line.quantity),
          rate: parseFloat(line.rate),
        })),
      });

      navigate(`/purchase-orders/${id}`, { state: { message: "Material received successfully" } });
    } catch (err) {
      console.error("Error receiving material:", err);
      setError(err.response?.data?.message || "Failed to receive material.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 py-16 text-center text-gray-500 dark:text-gray-400">Loading purchase order…</div>;
  }

  if (!po) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <button
          type="button"
          onClick={() => navigate("/purchase-orders")}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 min-h-[44px]"
        >
          <FaArrowLeft className="w-3 h-3" /> Back
        </button>
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error || "Purchase order not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pb-28">
      <button
        type="button"
        onClick={() => navigate(`/purchase-orders/${id}`)}
        className="flex items-center gap-2 mb-4 text-sm text-gray-600 dark:text-gray-400 min-h-[44px]"
      >
        <FaArrowLeft className="w-3 h-3" /> Back to {po.po_number}
      </button>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-emerald-50 mb-1">Receive Material</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        {po.po_number} · {po.supplier?.name}
      </p>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Receipt date</label>
            <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} className={inputClasses} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Supplier bill ref <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={billRef}
              onChange={(e) => setBillRef(e.target.value)}
              placeholder="e.g. INV-4821"
              className={inputClasses}
            />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-emerald-50">
            Items <span className="font-normal text-gray-500 dark:text-gray-400">(set a quantity to 0 to skip a line)</span>
          </h2>

          {lines.map((line, index) => {
            const quantity = parseFloat(line.quantity) || 0;
            const rate = parseFloat(line.rate) || 0;
            const overReceipt = quantity > line.pending;

            return (
              <div
                key={line.purchase_order_item_id}
                className="rounded-2xl border border-gray-200/60 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-gray-900 dark:text-emerald-50">{line.item_name}</p>
                  <p className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    Pending: <span className="font-semibold">{line.pending} {line.unit}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Received ({line.unit})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, "quantity", e.target.value)}
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
                      className={inputClasses}
                    />
                  </div>
                </div>

                {quantity > 0 && rate > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Line value: <span className="font-semibold text-gray-900 dark:text-emerald-50">{formatCurrency(quantity * rate)}</span>
                  </p>
                )}

                {overReceipt && (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    This is more than the outstanding quantity. Over-receipt will be recorded.
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
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputClasses} py-2`} />
        </div>

        {/* Thumb-reachable primary action, pinned on mobile. */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-[#0f1a16]/95 backdrop-blur border-t border-gray-200 dark:border-emerald-900/30 sm:static sm:p-0 sm:bg-transparent sm:dark:bg-transparent sm:border-0 sm:backdrop-blur-none">
          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[52px] rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Record receipt"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReceivePurchaseOrder;
