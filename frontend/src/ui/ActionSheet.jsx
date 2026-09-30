import PropTypes from "prop-types";
import Sheet from "./Sheet";

/** The ⋯ menu: a short list of actions. Destructive ones use tone "danger" and open their own confirm. */
export default function ActionSheet({ open, title, actions, onClose }) {
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <ul className="-mx-2 space-y-1">
        {actions.filter(Boolean).map((a) => (
          <li key={a.label}>
            <button type="button" onClick={() => { onClose(); a.onSelect(); }}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[0.95rem] font-medium hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass ${a.tone === "danger" ? "text-status-critical" : "text-ink"}`}>
              {a.icon}
              {a.label}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

ActionSheet.propTypes = {
  open: PropTypes.bool.isRequired, title: PropTypes.string.isRequired, onClose: PropTypes.func.isRequired,
  actions: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.bool, PropTypes.shape({ label: PropTypes.string.isRequired, onSelect: PropTypes.func.isRequired, tone: PropTypes.string, icon: PropTypes.node })])).isRequired,
};
