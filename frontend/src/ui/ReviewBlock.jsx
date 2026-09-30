import PropTypes from "prop-types";

/** One section of a review step, with an Edit button that jumps back to it. */
export default function ReviewBlock({ title, onEdit, children }) {
  return (
    <section className="rounded-2xl bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-ink-2">{title}</h3>
        <button type="button" onClick={onEdit} className="rounded-full px-3 py-1 text-sm font-semibold text-brass hover:bg-raised" aria-label={`Edit ${title}`}>Edit</button>
      </div>
      <div className="mt-1 text-sm text-ink">{children}</div>
    </section>
  );
}

ReviewBlock.propTypes = { title: PropTypes.string.isRequired, onEdit: PropTypes.func.isRequired, children: PropTypes.node };
