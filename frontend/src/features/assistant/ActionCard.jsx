import { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import Button from "../../ui/Button";
import { cardState } from "./cardState";

const TONE = { info: "text-brass", good: "text-status-good", muted: "text-ink-2", critical: "text-status-critical" };

/** One proposal: what will be saved, and Confirm / Open in form / Cancel. Nothing is saved until Confirm. */
export default function ActionCard({ action, onConfirm, onCancel }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);
  const s = cardState(action);
  const run = async (kind, fn) => {
    setBusy(kind);
    try {
      await fn(action);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label={action.card.title} className="mt-2 rounded-2xl border border-line bg-raised/60 p-3">
      <h3 className="text-sm font-semibold text-ink">{action.card.title}</h3>
      <dl className="mt-2 space-y-1 text-sm">
        {action.card.rows.map((r, i) => (
          <div key={`${r.label}-${i}`} className="flex justify-between gap-3">
            <dt className="shrink-0 text-ink-2">{r.label}</dt>
            <dd className="text-right font-num tabular-nums text-ink">
              {r.before !== undefined ? <><span className="text-ink-2">{r.before}</span> → <span className="font-semibold">{r.after}</span></> : r.value}
            </dd>
          </div>
        ))}
      </dl>
      {(action.card.warnings || []).map((w) => (
        <p key={w} role="note" className="mt-2 rounded-xl bg-status-warn/10 px-3 py-2 text-xs text-status-warn">{w}</p>
      ))}
      <p className={`mt-2 text-xs ${TONE[s.tone]}`}>
        {s.status === "confirmed" && <Check className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
        {s.note}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {s.canAct && <Button size="sm" loading={busy === "confirm"} disabled={Boolean(busy)} onClick={() => run("confirm", onConfirm)}>Confirm</Button>}
        {s.canOpenForm && <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => navigate(action.formLink)}>Open in form</Button>}
        {s.canAct && <Button size="sm" variant="ghost" loading={busy === "cancel"} disabled={Boolean(busy)} onClick={() => run("cancel", onCancel)}>Cancel</Button>}
        {s.status === "confirmed" && action.resultLink && <Button size="sm" variant="secondary" onClick={() => navigate(action.resultLink)}>Open</Button>}
      </div>
    </section>
  );
}

ActionCard.propTypes = {
  action: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    card: PropTypes.shape({ title: PropTypes.string.isRequired, rows: PropTypes.array.isRequired, warnings: PropTypes.array }).isRequired,
    error: PropTypes.string,
    formLink: PropTypes.string,
    resultLink: PropTypes.string,
    expiresAt: PropTypes.string,
  }).isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
