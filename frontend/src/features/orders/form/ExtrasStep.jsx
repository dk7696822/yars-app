import { useState } from "react";
import PropTypes from "prop-types";
import { ChevronDown } from "lucide-react";
import Field from "../../../ui/Field";
import NumberInput from "../../../ui/NumberInput";
import Chips from "../../../ui/Chips";
import ReviewBlock from "../../../ui/ReviewBlock";
import { Money } from "../../../ui/Money";
import { linePreview } from "./draft";
import { ORDER_FLOW, ORDER_STATUS } from "../../../utils/statusMeta";
import { inr, shortDate } from "../../../utils/dashboardFormat";
import { qtyText } from "../../../utils/itemsText";
import { parseNumber } from "../../../utils/numberInput";

const STATUS_OPTIONS = ORDER_FLOW.map((s) => ({ value: s, label: ORDER_STATUS[s].label }));

export default function ExtrasStep({ draft, update, plates, sizes, errors, isEdit, totals, onGo }) {
  const plate = plates.find((p) => p.id === draft.plateTypeId);
  const hasExtras = Boolean(draft.customPlateCharge || draft.roundOff || draft.advance || errors.customPlateCharge || errors.roundOff || errors.advance);
  const [moreOpen, setMoreOpen] = useState(hasExtras);
  const more = moreOpen || hasExtras;

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-[0.8rem] font-semibold text-ink-2">Plate type</legend>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
          {plates.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={p.id === draft.plateTypeId} onClick={() => update({ plateTypeId: p.id })}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${p.id === draft.plateTypeId ? "border-brass bg-brass/10 text-ink" : "border-line bg-surface text-ink-2"}`}>
              <span className="font-semibold">{p.type_name}</span>
              <Money value={Number(p.charge)} />
            </button>
          ))}
        </div>
        {errors.plate && <p role="alert" className="mt-1.5 text-xs font-medium text-status-critical">{errors.plate}</p>}
      </fieldset>

      {more ? (
        <div className="space-y-4 rounded-3xl bg-surface p-4">
          <Field label="Custom plate charge" htmlFor="order-custom-plate" optional error={errors.customPlateCharge}
            hint={`Leave empty to use ${plate ? `${plate.type_name}'s ${inr(plate.charge)}` : "the plate type's charge"}`}>
            <NumberInput prefix="₹" value={draft.customPlateCharge} onChange={(v) => update({ customPlateCharge: v })} />
          </Field>
          <Field label="Round off" htmlFor="order-round-off" optional error={errors.roundOff} hint="Taken off the total — e.g. 5 turns ₹10,005 into ₹10,000">
            <NumberInput signed prefix="₹" value={draft.roundOff} onChange={(v) => update({ roundOff: v })} />
          </Field>
          {isEdit ? (
            <p className="text-xs text-ink-2">To add or correct an advance, record it as a payment on the order page.</p>
          ) : (
            <Field label="Advance received" htmlFor="order-advance" optional error={errors.advance} hint="Saved as an advance payment on the order date">
              <NumberInput prefix="₹" value={draft.advance} onChange={(v) => update({ advance: v })} />
            </Field>
          )}
          <div>
            <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-2">Status</p>
            <Chips label="Order status" options={STATUS_OPTIONS} value={ORDER_FLOW.includes(draft.status) ? draft.status : ""} onChange={(status) => update({ status })} />
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setMoreOpen(true)} className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 text-sm text-ink-2">
          <span>More options · custom plate charge, round off, advance, status</span>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">Review</h2>
        <ReviewBlock title="Customer & date" onEdit={() => onGo(0)}>
          <p className="font-semibold">{draft.customer?.name || "—"}</p>
          <p className="text-ink-2">{draft.orderDate ? shortDate(draft.orderDate) : "—"}</p>
        </ReviewBlock>
        <ReviewBlock title="Items" onEdit={() => onGo(1)}>
          <ul className="space-y-1">
            {draft.lines.map((line) => {
              const size = sizes.find((s) => s.id === line.product_size_id);
              const { amount } = linePreview(line, size);
              const quantity = line.unit === "PIECES" ? parseNumber(line.quantity_pieces, { whole: true }).value : parseNumber(line.quantity_kg).value;
              return (
                <li key={line.key} className="flex justify-between gap-3">
                  <span className="truncate">{size?.size_label || "—"}{quantity !== null ? ` · ${qtyText({ unit: line.unit, quantity })}` : ""}</span>
                  {amount === null ? <span className="text-ink-2">—</span> : <Money value={amount} />}
                </li>
              );
            })}
          </ul>
        </ReviewBlock>
        <dl className="space-y-1 rounded-2xl bg-surface px-4 py-3 text-sm">
          <div className="flex justify-between text-ink-2"><dt>Items</dt><dd><Money value={totals.products} /></dd></div>
          <div className="flex justify-between text-ink-2"><dt>Plate</dt><dd><Money value={totals.plateCharge} /></dd></div>
          {totals.roundOff !== 0 && <div className="flex justify-between text-ink-2"><dt>Round off</dt><dd className="font-num tabular-nums">{totals.roundOff > 0 ? "−" : "+"}{inr(Math.abs(totals.roundOff))}</dd></div>}
          <div className="flex justify-between border-t border-line pt-2 font-semibold text-ink"><dt>Total</dt><dd><Money value={totals.total} /></dd></div>
        </dl>
      </div>
    </div>
  );
}

ExtrasStep.propTypes = {
  draft: PropTypes.object.isRequired, update: PropTypes.func.isRequired, plates: PropTypes.array.isRequired, sizes: PropTypes.array.isRequired,
  errors: PropTypes.object.isRequired, isEdit: PropTypes.bool.isRequired, totals: PropTypes.object.isRequired, onGo: PropTypes.func.isRequired,
};
