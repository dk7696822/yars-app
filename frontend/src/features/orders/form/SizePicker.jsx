import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import SearchPicker from "../../../ui/SearchPicker";
import { formatSizePricing } from "../../../utils/formatters";

export default function SizePicker({ open, sizes, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const items = useMemo(() => sizes.filter((s) => s.size_label.toLowerCase().includes(q)), [sizes, q]);
  return (
    <SearchPicker open={open} title="Choose size" query={query} onQuery={setQuery} placeholder="Search sizes" items={items} getKey={(s) => s.id}
      renderItem={(s) => (
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">{s.size_label}</span>
          <span className="block text-xs text-ink-2">{formatSizePricing(s)}</span>
        </span>
      )}
      onPick={(s) => { onPick(s); setQuery(""); }} onClose={onClose}
      empty={q ? `No size matches “${query.trim()}”` : "No sizes yet — add them under Sizes"} />
  );
}

SizePicker.propTypes = { open: PropTypes.bool.isRequired, sizes: PropTypes.array.isRequired, onPick: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired };
