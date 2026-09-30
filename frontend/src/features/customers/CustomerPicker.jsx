import { useState } from "react";
import PropTypes from "prop-types";
import SearchPicker from "../../ui/SearchPicker";
import Button from "../../ui/Button";
import { Money } from "../../ui/Money";
import QuickCustomerSheet from "./QuickCustomerSheet";
import { useDirectory } from "./api";
import useDebounced from "../../ui/useDebounced";
import { shortDate } from "../../utils/dashboardFormat";

/** Search customers (recent first when empty); "＋ New customer" adds one without leaving the form. */
export default function CustomerPicker({ open, onClose, onPick }) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(0); // 0 = closed; otherwise the sheet's key
  const term = useDebounced(query.trim());
  const list = useDirectory({ sort: term ? "name" : "recent", search: term || undefined });
  const rows = list.data?.pages?.[0]?.rows || [];

  const pick = (c) => {
    onPick({ id: c.id, name: c.name, phone: c.phone || null, due: c.due || 0 });
    setQuery("");
    setCreating(0);
  };

  return (
    <>
      <SearchPicker open={open && !creating} title="Choose customer" query={query} onQuery={setQuery} placeholder="Search name or phone"
        loading={list.isPending} error={list.isError ? "Couldn't load customers." : undefined}
        items={rows} getKey={(c) => c.id} onPick={pick} onClose={onClose}
        empty={term ? `No customer matches “${term}”` : "No customers yet"}
        renderItem={(c) => (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink">{c.name}</span>
              <span className="block text-xs text-ink-2">{c.lastOrderDate ? `Last order ${shortDate(c.lastOrderDate)}` : "No orders yet"}</span>
            </span>
            {c.due > 0 && <Money value={c.due} className="text-sm font-semibold text-status-critical" />}
          </>
        )}
        footer={<Button variant="secondary" block onClick={() => setCreating(Date.now())}>＋ New customer{term ? ` “${term}”` : ""}</Button>} />
      {creating > 0 && (
        <QuickCustomerSheet key={creating} open={open} initialName={term} onClose={() => setCreating(0)} onCreated={pick} />
      )}
    </>
  );
}

CustomerPicker.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onPick: PropTypes.func.isRequired };
