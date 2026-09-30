import { useState } from "react";
import PropTypes from "prop-types";
import { Trash2, ChevronDown } from "lucide-react";
import Field from "../../../ui/Field";
import NumberInput from "../../../ui/NumberInput";
import IconButton from "../../../ui/IconButton";
import Button from "../../../ui/Button";
import { Money } from "../../../ui/Money";
import { INPUT, INPUT_INVALID } from "../../../ui/styles";
import SizePicker from "./SizePicker";
import { linePreview, unitPriceHint, pickSize } from "./draft";
import { applySizeWeight } from "../../../utils/orderFormLines";
import { formatSizePricing, formatKg, formatCurrency, perPiecePriceHint, perPieceWeightHint } from "../../../utils/formatters";
import { parseNumber } from "../../../utils/numberInput";
import { errorText } from "../../../lib/errors";

function Pair({ legend, error, hint, children }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-[0.8rem] font-semibold text-ink-2">{legend}</legend>
      <div className="flex items-center gap-2">{children}</div>
      {error ? <p role="alert" className="text-xs font-medium text-status-critical">{error}</p> : hint ? <p className="text-xs text-ink-2">{hint}</p> : null}
    </fieldset>
  );
}

Pair.propTypes = { legend: PropTypes.node.isRequired, error: PropTypes.string, hint: PropTypes.node, children: PropTypes.node };

export default function LineCard({ line, index, sizes, errors, onChange, onRemove, canRemove, onSaveSizeWeight }) {
  const [picking, setPicking] = useState(false);
  const [weightDraft, setWeightDraft] = useState(null); // { count, kg, saving, error } while setting a size weight
  const size = sizes.find((s) => s.id === line.product_size_id);
  const hint = unitPriceHint(line, size);
  const { amount, kg } = linePreview(line, size);
  const set = (patch) => onChange({ ...line, ...patch });
  const n = index + 1;
  const sizeHasWeight = Boolean(size) && size.weight_kg !== null && size.weight_kg !== undefined;
  const lineHasWeight = String(line.weight_kg ?? "") !== "";
  const price = { amount: parseNumber(line.price_amount, { dp: 4 }).value, count: parseNumber(line.price_pieces_count, { whole: true }).value };
  const weight = { kg: parseNumber(line.weight_kg, { dp: 3 }).value, count: parseNumber(line.weight_pieces_count, { whole: true }).value };

  const saveWeight = async () => {
    const count = parseNumber(weightDraft.count, { whole: true }).value;
    const w = parseNumber(weightDraft.kg, { dp: 3 }).value;
    if (count === null || w === null) {
      setWeightDraft((d) => ({ ...d, error: "Enter both: how many pieces and their weight in kg" }));
      return;
    }
    setWeightDraft((d) => ({ ...d, saving: true, error: "" }));
    try {
      const updated = await onSaveSizeWeight(size, { weight_pieces_count: count, weight_kg: w });
      onChange(applySizeWeight(line, updated));
      setWeightDraft(null);
    } catch (err) {
      setWeightDraft((d) => ({ ...d, saving: false, error: errorText(err, "Couldn't save the weight") }));
    }
  };

  return (
    <div className="space-y-4 rounded-3xl bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-2">Size {n}</p>
        {canRemove && <IconButton label={`Remove size ${n}`} onClick={onRemove} className="h-9 w-9 bg-transparent text-ink-2"><Trash2 className="h-4 w-4" /></IconButton>}
      </div>

      <Field label="Size" htmlFor={`line-${n}-size`} error={errors.size}>
        <button type="button" onClick={() => setPicking(true)} className={`${INPUT} flex items-center justify-between gap-2 text-left ${errors.size ? INPUT_INVALID : ""}`}>
          {size ? <span className="truncate font-semibold">{size.size_label}</span> : <span className="text-ink-2">Choose a size</span>}
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
        </button>
      </Field>
      {size && <p className="-mt-2 text-xs text-ink-2">{formatSizePricing(size)}</p>}

      <div role="radiogroup" aria-label={`Sold by — size ${n}`} className="inline-flex rounded-2xl bg-raised p-1">
        {[["KG", "Kg"], ["PIECES", "Pcs"]].map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={line.unit === value} onClick={() => set({ unit: value })}
            className={`h-9 rounded-xl px-5 text-sm font-semibold ${line.unit === value ? "bg-brass text-brass-on" : "text-ink-2"}`}>
            {label}
          </button>
        ))}
      </div>
      {hint && <p className="-mt-2 text-xs text-status-warn">{hint}</p>}

      {line.unit === "PIECES" ? (
        <>
          <Field label="Quantity" htmlFor={`line-${n}-pcs`} error={errors.quantity}>
            <NumberInput whole value={line.quantity_pieces} onChange={(v) => set({ quantity_pieces: v })} suffix="pcs" />
          </Field>
          <Pair legend="Price" error={errors.price} hint={price.amount && price.count ? perPiecePriceHint(price.amount, price.count) : undefined}>
            <div className="w-28 shrink-0"><NumberInput whole aria-label="Number of pieces priced" value={line.price_pieces_count} onChange={(v) => set({ price_pieces_count: v })} /></div>
            <span className="shrink-0 text-sm text-ink-2">pcs cost</span>
            <div className="min-w-0 flex-1"><NumberInput aria-label="Price for those pieces" prefix="₹" value={line.price_amount} onChange={(v) => set({ price_amount: v })} /></div>
          </Pair>
          <Pair legend={<>Weight <span className="font-normal">(optional)</span></>} error={errors.weight}
            hint={weight.kg && weight.count ? `${perPieceWeightHint(weight.kg, weight.count)}${line.weight_source === "MANUAL" ? " · measured for this order" : ""}` : undefined}>
            <div className="w-28 shrink-0"><NumberInput whole aria-label="Number of pieces weighed" value={line.weight_pieces_count} onChange={(v) => set({ weight_pieces_count: v, weight_source: "MANUAL" })} /></div>
            <span className="shrink-0 text-sm text-ink-2">pcs weigh</span>
            <div className="min-w-0 flex-1"><NumberInput aria-label="Weight in kg" suffix="kg" value={line.weight_kg} onChange={(v) => set({ weight_kg: v, weight_source: "MANUAL" })} /></div>
          </Pair>
          {size && !sizeHasWeight && !lineHasWeight && (
            <div className="space-y-2 rounded-2xl border border-status-warn/35 bg-status-warn/10 p-3 text-sm text-status-warn">
              <p>Weight not set for {size.size_label}, so this line&apos;s kg can&apos;t be worked out. Add it for the size, type a measured weight above, or skip.</p>
              {!weightDraft ? (
                <Button size="sm" variant="secondary" onClick={() => setWeightDraft({ count: "", kg: "", saving: false, error: "" })}>Set weight for {size.size_label}</Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-28 shrink-0"><NumberInput whole aria-label="Pieces" placeholder="10000" value={weightDraft.count} onChange={(v) => setWeightDraft((d) => ({ ...d, count: v }))} /></div>
                    <span className="shrink-0 text-ink-2">pcs weigh</span>
                    <div className="min-w-0 flex-1"><NumberInput aria-label="Kg" suffix="kg" placeholder="100" value={weightDraft.kg} onChange={(v) => setWeightDraft((d) => ({ ...d, kg: v }))} /></div>
                  </div>
                  {weightDraft.error && <p role="alert" className="text-xs text-status-critical">{weightDraft.error}</p>}
                  <Button size="sm" loading={weightDraft.saving} onClick={saveWeight}>Save to size</Button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" htmlFor={`line-${n}-kg`} error={errors.quantity}>
            <NumberInput value={line.quantity_kg} onChange={(v) => set({ quantity_kg: v })} suffix="kg" />
          </Field>
          <Field label="Rate per kg" htmlFor={`line-${n}-rate`} error={errors.rate} hint={Number(size?.rate_per_kg) > 0 ? `Size rate ${formatCurrency(size.rate_per_kg)}` : undefined}>
            <NumberInput value={line.rate_per_kg} onChange={(v) => set({ rate_per_kg: v })} prefix="₹" />
          </Field>
        </div>
      )}

      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="text-sm text-ink-2">
          Amount
          {line.unit === "PIECES" && amount !== null && <span className="ml-2 text-xs">{kg === null ? "kg: weight not set" : `≈ ${formatKg(kg)}`}</span>}
        </span>
        {amount === null ? <span className="text-sm text-ink-2">—</span> : <Money value={amount} className="font-semibold" />}
      </div>

      <SizePicker open={picking} sizes={sizes} onClose={() => setPicking(false)} onPick={(s) => { onChange(pickSize(line, s)); setPicking(false); }} />
    </div>
  );
}

LineCard.propTypes = {
  line: PropTypes.object.isRequired, index: PropTypes.number.isRequired, sizes: PropTypes.array.isRequired, errors: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired, onRemove: PropTypes.func.isRequired, canRemove: PropTypes.bool.isRequired, onSaveSizeWeight: PropTypes.func.isRequired,
};
