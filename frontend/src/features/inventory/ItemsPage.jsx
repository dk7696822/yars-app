import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Ellipsis } from "lucide-react";
import { useItemList, useInvCategories, rowsOf } from "./api";
import { qty, attributesText, UNIT_LABEL } from "./labels";
import PageHeader from "../../ui/PageHeader";
import TextInput from "../../ui/TextInput";
import Chips from "../../ui/Chips";
import IconButton from "../../ui/IconButton";
import ActionSheet from "../../ui/ActionSheet";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";

export default function ItemsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const search = params.get("q") || "";
  const categoryId = params.get("cat") || "";
  const term = useDebounced(search.trim());
  const query = useMemo(() => ({ ...(term ? { search: term } : {}), ...(categoryId ? { category_id: categoryId } : {}) }), [term, categoryId]);
  const list = useItemList(query);
  const categories = useInvCategories();
  const sentinel = useInfiniteSentinel(list);
  const rows = rowsOf(list);
  const setParam = (key, value) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (value) next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });
  const catChips = [{ value: "", label: "All" }, ...(categories.data || []).map((c) => ({ value: c.id, label: c.name }))];

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Items" subtitle="Materials you buy and use" actions={<>
        <IconButton label="More item actions" onClick={() => setMenuOpen(true)}><Ellipsis className="h-5 w-5" /></IconButton>
        <Link to="/inventory-items/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>
      </>} />
      <div className="mt-3 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setParam("q", e.target.value)} placeholder="Search name or code" aria-label="Search items" enterKeyHint="search" />
        {catChips.length > 1 && <Chips label="Category" options={catChips} value={categoryId} onChange={(v) => setParam("cat", v)} />}
      </div>
      <div className={`mt-4 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? <ListSkeleton /> : list.isError && rows.length === 0 ? <ErrorState title="Couldn't load items." onRetry={() => list.refetch()} /> : rows.length === 0 ? (
          <EmptyState title="No items here" body={term || categoryId ? "Try another search or category." : "Add the materials you buy, like PP granules or ink."}
            action={<Link to="/inventory-items/new" className={buttonClass()}>Add an item</Link>} />
        ) : (
          <>
            <ul className="overflow-hidden rounded-2xl bg-surface">
              {rows.map((it) => (
                <li key={it.id} className="border-b border-line/60 last:border-0">
                  <Link to={`/inventory-items/edit/${it.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{it.name}{it.item_code ? <span className="font-normal text-ink-2"> · {it.item_code}</span> : null}</span>
                      <span className="block truncate text-xs text-ink-2">{[it.category?.name, attributesText(it)].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-ink-2">
                      <span className="block font-semibold text-ink">{UNIT_LABEL[it.unit]?.[1] || it.unit}</span>
                      Reorder at {qty(it.reorder_level, it.unit)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div ref={sentinel} className="py-3 text-center text-xs text-ink-2">{list.isFetchingNextPage ? "Loading more…" : ""}</div>
          </>
        )}
      </div>
      <ActionSheet open={menuOpen} title="Items" onClose={() => setMenuOpen(false)} actions={[
        { label: "Item categories", onSelect: () => navigate("/inventory-categories") },
        { label: "Item details (GSM, colour…)", onSelect: () => navigate("/item-attributes") },
      ]} />
    </div>
  );
}
