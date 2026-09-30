import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import SearchPicker from "../../ui/SearchPicker";
import { buttonClass } from "../../ui/styles";
import { useItemsPicker, useStockList, rowsOf } from "./api";
import { qty, attributesText } from "./labels";
import { recentItemIds } from "./recentItems";
import useDebounced from "../../ui/useDebounced";

/** Search items. withStock shows what is on hand (from the stock list) — used when issuing. */
export default function ItemPicker({ open, onClose, onPick, withStock = false }) {
  const [query, setQuery] = useState("");
  const term = useDebounced(query.trim());
  const all = useItemsPicker();
  const stock = useStockList(term ? { search: term } : {}, withStock && open);
  const source = withStock ? stock : all;
  const items = useMemo(() => {
    let rows = withStock ? rowsOf(stock) : all.data || [];
    if (!withStock && term) {
      const t = term.toLowerCase();
      rows = rows.filter((i) => i.name.toLowerCase().includes(t) || (i.item_code || "").toLowerCase().includes(t));
    }
    if (!term) {
      const recent = recentItemIds();
      const rank = (i) => (recent.includes(i.id) ? recent.indexOf(i.id) : recent.length);
      rows = [...rows].sort((a, b) => rank(a) - rank(b));
    }
    return rows;
  }, [withStock, stock, all.data, term]);

  return (
    <SearchPicker open={open} title="Choose item" query={query} onQuery={setQuery} placeholder="Search item name or code"
      loading={source.isPending} error={source.isError ? "Couldn't load items." : undefined}
      items={items} getKey={(i) => i.id} onClose={onClose}
      onPick={(i) => { onPick({ id: i.id, name: i.name, unit: i.unit, in_stock: withStock ? Number(i.in_stock) : undefined }); setQuery(""); }}
      empty={term ? `No item matches “${term}”` : "No items yet"}
      renderItem={(i) => (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-ink">{i.name}</span>
            <span className="block truncate text-xs text-ink-2">{[i.category?.name, attributesText(i)].filter(Boolean).join(" · ") || i.item_code || ""}</span>
          </span>
          {withStock && <span className="shrink-0 font-num text-sm tabular-nums text-ink-2">{qty(i.in_stock, i.unit)}</span>}
        </>
      )}
      footer={<a href="/inventory-items/new" className={buttonClass({ variant: "secondary", block: true })}>＋ New item (opens the item form)</a>} />
  );
}

ItemPicker.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onPick: PropTypes.func.isRequired, withStock: PropTypes.bool };
