import { useState } from "react";
import PropTypes from "prop-types";
import { FaTrash, FaExclamationTriangle } from "react-icons/fa";
import Dropdown from "../ui/Dropdown";
import { formatCurrency, formatKg, formatPiecePrice, perPieceWeightHint } from "../../utils/formatters";
import { availableUnits, applySizeSelection, applySizeWeight, previewLine } from "../../utils/orderFormLines";

const sizeOptionLabel = (size) => {
  const parts = [];
  if (size.rate_per_kg !== null && size.rate_per_kg !== undefined) parts.push(`${formatCurrency(size.rate_per_kg)}/kg`);
  if (size.piece_price_amount !== null && size.piece_price_amount !== undefined) parts.push(formatPiecePrice(size.piece_price_amount, size.piece_price_count));
  return `${size.size_label} (${parts.join(" · ")})`;
};

const OrderLineFields = ({ item, index, productSizes, onChange, onRemove, canRemove, onSaveSizeWeight }) => {
  const size = productSizes.find((ps) => ps.id === item.product_size_id);
  const units = availableUnits(size);
  const { amount, kg } = previewLine(item, size);
  const [weightDraft, setWeightDraft] = useState({ open: false, count: "", kg: "", saving: false, error: "" });

  const set = (patch) => onChange(index, { ...item, ...patch });
  const sizeHasWeight = size && size.weight_kg !== null && size.weight_kg !== undefined;
  const lineHasWeight = item.weight_kg !== "" && item.weight_kg !== null;

  const saveWeight = async () => {
    setWeightDraft((d) => ({ ...d, saving: true, error: "" }));
    try {
      const updated = await onSaveSizeWeight(size, { weight_pieces_count: weightDraft.count, weight_kg: weightDraft.kg });
      onChange(index, applySizeWeight(item, updated));
      setWeightDraft({ open: false, count: "", kg: "", saving: false, error: "" });
    } catch (err) {
      setWeightDraft((d) => ({ ...d, saving: false, error: err.response?.data?.message || "Could not save the weight" }));
    }
  };

  return (
    <div className="product-size-row">
      <div className="form-group">
        <label htmlFor={`product_size_${index}`}>Size</label>
        <Dropdown
          id={`product_size_${index}`}
          name={`product_size_${index}`}
          value={item.product_size_id}
          onChange={(e) => onChange(index, applySizeSelection(item, productSizes.find((ps) => ps.id === e.target.value)))}
          placeholder="Select Size"
          required
          options={[{ value: "", label: "Select Size" }, ...productSizes.map((s) => ({ value: s.id, label: sizeOptionLabel(s) }))]}
        />
      </div>

      <div className="form-group">
        <label>Unit</label>
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-emerald-900/30 overflow-hidden" role="group" aria-label="Unit">
          {[["KG", "Kg"], ["PIECES", "Pcs"]].map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={!units.includes(value)}
              onClick={() => set({ unit: value })}
              className={`px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                item.unit === value ? "bg-primary text-white" : "bg-white dark:bg-[#161d1a] text-gray-700 dark:text-emerald-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {item.unit === "KG" ? (
        <>
          <div className="form-group">
            <label htmlFor={`quantity_${index}`}>Quantity (kg)</label>
            <input type="number" id={`quantity_${index}`} value={item.quantity_kg}
              onChange={(e) => set({ quantity_kg: parseFloat(e.target.value) })}
              min="0.1" step="0.1" required className="form-control" />
          </div>
          <div className="form-group">
            <label htmlFor={`rate_${index}`}>
              Rate/kg
              {size && (
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">(Default: {formatCurrency(size.rate_per_kg || 0)})</span>
              )}
            </label>
            <input type="number" id={`rate_${index}`} value={item.rate_per_kg || ""}
              onChange={(e) => set({ rate_per_kg: e.target.value ? parseFloat(e.target.value) : null })}
              min="0" step="0.01" placeholder="Custom rate (optional)" className="form-control" />
          </div>
        </>
      ) : (
        <>
          <div className="form-group">
            <label htmlFor={`quantity_pcs_${index}`}>Quantity (pcs)</label>
            <input type="number" id={`quantity_pcs_${index}`} value={item.quantity_pieces}
              onChange={(e) => set({ quantity_pieces: e.target.value === "" ? "" : Number(e.target.value) })}
              min="1" step="1" required className="form-control" />
          </div>
          <div className="form-group">
            <label>Price</label>
            <div className="flex items-center gap-2">
              <input type="number" aria-label="Priced per number of pieces" value={item.price_pieces_count}
                onChange={(e) => set({ price_pieces_count: e.target.value === "" ? "" : Number(e.target.value) })}
                min="1" step="1" required className="form-control w-24" />
              <span className="text-sm whitespace-nowrap text-gray-600 dark:text-gray-300">pcs cost ₹</span>
              <input type="number" aria-label="Price for those pieces" value={item.price_amount}
                onChange={(e) => set({ price_amount: e.target.value === "" ? "" : parseFloat(e.target.value) })}
                min="0" step="0.0001" required className="form-control" />
            </div>
          </div>
          <div className="form-group">
            <label>Weight <span className="text-xs text-gray-500">(optional)</span></label>
            <div className="flex items-center gap-2">
              <input type="number" aria-label="Number of pieces weighed" value={item.weight_pieces_count}
                onChange={(e) => set({ weight_pieces_count: e.target.value === "" ? "" : Number(e.target.value), weight_source: "MANUAL" })}
                min="1" step="1" className="form-control w-24" />
              <span className="text-sm whitespace-nowrap text-gray-600 dark:text-gray-300">pcs weigh</span>
              <input type="number" aria-label="Weight in kg" value={item.weight_kg}
                onChange={(e) => set({ weight_kg: e.target.value === "" ? "" : parseFloat(e.target.value), weight_source: "MANUAL" })}
                min="0" step="0.001" className="form-control" />
              <span className="text-sm text-gray-600 dark:text-gray-300">kg</span>
            </div>
            {item.weight_source === "MANUAL" && lineHasWeight && <p className="text-xs text-gray-500 mt-1">Measured weight for this order</p>}
          </div>

          {size && !sizeHasWeight && !lineHasWeight && (
            <div className="sm:col-span-full rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-3 text-sm text-amber-800 dark:text-amber-300">
              <p className="flex items-start gap-2">
                <FaExclamationTriangle className="mt-0.5 flex-shrink-0" />
                <span>Weight not set for {size.size_label}, so this line&apos;s kg can&apos;t be calculated. Add it for the size, type a measured weight above, or skip.</span>
              </p>
              {!weightDraft.open ? (
                <button type="button" className="btn-sm mt-2" onClick={() => setWeightDraft((d) => ({ ...d, open: true }))}>
                  Set weight for {size.size_label}
                </button>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="number" aria-label="Pieces" value={weightDraft.count} onChange={(e) => setWeightDraft((d) => ({ ...d, count: e.target.value }))}
                    min="1" step="1" className="form-control w-24" placeholder="10000" />
                  <span>pcs weigh</span>
                  <input type="number" aria-label="Kg" value={weightDraft.kg} onChange={(e) => setWeightDraft((d) => ({ ...d, kg: e.target.value }))}
                    min="0" step="0.001" className="form-control w-28" placeholder="100" />
                  <span>kg</span>
                  {weightDraft.count && weightDraft.kg && <span className="text-xs">{perPieceWeightHint(weightDraft.kg, weightDraft.count)}</span>}
                  <button type="button" className="btn-sm" disabled={!weightDraft.count || !weightDraft.kg || weightDraft.saving} onClick={saveWeight}>
                    {weightDraft.saving ? "Saving..." : "Save to size"}
                  </button>
                  {weightDraft.error && <p className="w-full text-red-600">{weightDraft.error}</p>}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="form-group amount-column">
        <label>Amount</label>
        <div className="amount-display">
          {formatCurrency(amount ?? 0)}
          {item.unit === "PIECES" && amount !== null && (
            <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">{kg === null ? "kg: weight not set" : `≈ ${formatKg(kg)}`}</span>
          )}
        </div>
      </div>

      <button type="button" className="btn-icon remove-btn" onClick={() => onRemove(index)} disabled={!canRemove}>
        <FaTrash />
      </button>
    </div>
  );
};

OrderLineFields.propTypes = {
  item: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  productSizes: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  canRemove: PropTypes.bool.isRequired,
  onSaveSizeWeight: PropTypes.func.isRequired,
};

export default OrderLineFields;
