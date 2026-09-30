import { useState } from "react";
import PropTypes from "prop-types";
import SearchPicker from "../../ui/SearchPicker";
import { useOrderList } from "../orders/api";
import useDebounced from "../../ui/useDebounced";
import { itemsText } from "../../utils/itemsText";
import { shortDate } from "../../utils/dashboardFormat";

/** Which customer order the material was used for (optional). */
export default function OrderPicker({ open, onClose, onPick }) {
  const [query, setQuery] = useState("");
  const term = useDebounced(query.trim());
  const list = useOrderList({ chip: "all", search: term || undefined });
  const rows = (list.data?.pages?.[0]?.rows || []).filter((o) => !o.cancelled);
  return (
    <SearchPicker open={open} title="Choose order" query={query} onQuery={setQuery} placeholder="Search customer or size"
      loading={list.isPending} error={list.isError ? "Couldn't load orders." : undefined}
      items={rows} getKey={(o) => o.id} onClose={onClose}
      onPick={(o) => { onPick({ id: o.id, label: `${o.customer.name} · ${shortDate(o.orderDate)}` }); setQuery(""); }}
      empty={term ? `No order matches “${term}”` : "No orders yet"}
      renderItem={(o) => (
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{o.customer.name}</span>
          <span className="block truncate text-xs text-ink-2">{shortDate(o.orderDate)} · {itemsText(o.items)}</span>
        </span>
      )} />
  );
}

OrderPicker.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onPick: PropTypes.func.isRequired };
