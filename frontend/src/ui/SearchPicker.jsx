import PropTypes from "prop-types";
import Sheet from "./Sheet";
import TextInput from "./TextInput";
import { ListSkeleton } from "./States";

/** A searchable list in a sheet — customer and size pickers. */
export default function SearchPicker({ open, title, query, onQuery, placeholder, loading, error, items, getKey, renderItem, onPick, onClose, empty, footer }) {
  return (
    <Sheet open={open} title={title} onClose={onClose} footer={footer}>
      <div className="sticky -top-3 z-10 -mx-5 bg-surface px-5 pb-3 pt-1">
        <TextInput autoFocus type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder} enterKeyHint="search" />
      </div>
      {error ? (
        <p role="alert" className="py-6 text-center text-sm text-status-critical">{error}</p>
      ) : loading ? (
        <ListSkeleton rows={5} />
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-2">{empty}</p>
      ) : (
        <ul className="-mx-2">
          {items.map((item) => (
            <li key={getKey(item)}>
              <button type="button" onClick={() => onPick(item)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">
                {renderItem(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

SearchPicker.propTypes = {
  open: PropTypes.bool.isRequired, title: PropTypes.string.isRequired, query: PropTypes.string.isRequired, onQuery: PropTypes.func.isRequired,
  placeholder: PropTypes.string.isRequired, loading: PropTypes.bool, error: PropTypes.string, items: PropTypes.array.isRequired,
  getKey: PropTypes.func.isRequired, renderItem: PropTypes.func.isRequired, onPick: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired,
  empty: PropTypes.node.isRequired, footer: PropTypes.node,
};
