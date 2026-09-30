import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { useSimilar } from "./api";
import useDebounced from "../../ui/useDebounced";
import { inr } from "../../utils/dashboardFormat";

/** "Is it one of these?" — never blocks saving. With onPick (inside an order), choosing one uses that customer. */
export default function SimilarWarning({ name, excludeId, onPick }) {
  const term = useDebounced(name.trim(), 350);
  const { data } = useSimilar(term, excludeId);
  if (!data?.length) return null;
  const label = (c) => `${c.name} · ${c.due > 0 ? `owes ${inr(c.due)}` : "paid up"}`;
  return (
    <div role="status" className="rounded-2xl border border-status-warn/35 bg-status-warn/10 px-3 py-2.5 text-sm text-status-warn">
      <p>Similar names already exist — is it one of these?</p>
      <ul className="mt-1.5 space-y-1">
        {data.map((c) => (
          <li key={c.id}>
            {onPick ? (
              <button type="button" onClick={() => onPick(c)} className="text-left font-semibold text-ink hover:underline">{label(c)} — use this one</button>
            ) : (
              <Link to={`/customers/${c.id}`} className="font-semibold text-ink hover:underline">{label(c)} ›</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

SimilarWarning.propTypes = { name: PropTypes.string.isRequired, excludeId: PropTypes.string, onPick: PropTypes.func };
