import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, ChevronRight } from "lucide-react";
import { useSupplierList, rowsOf } from "./api";
import PageHeader from "../../ui/PageHeader";
import TextInput from "../../ui/TextInput";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { initials } from "../../utils/alphaIndex";

export default function SuppliersPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") || "";
  const term = useDebounced(search.trim());
  const query = useMemo(() => (term ? { search: term } : {}), [term]);
  const list = useSupplierList(query);
  const sentinel = useInfiniteSentinel(list);
  const rows = rowsOf(list);
  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Suppliers" actions={<Link to="/suppliers/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>} />
      <div className="mt-3"><TextInput type="search" value={search} onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })} placeholder="Search name or phone" aria-label="Search suppliers" enterKeyHint="search" /></div>
      <div className={`mt-4 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? <ListSkeleton /> : list.isError && rows.length === 0 ? <ErrorState title="Couldn't load suppliers." onRetry={() => list.refetch()} /> : rows.length === 0 ? (
          <EmptyState title={term ? "No supplier matches" : "No suppliers yet"} body={term ? "Try another name." : "Add who you buy material from."} action={<Link to="/suppliers/new" className={buttonClass()}>Add a supplier</Link>} />
        ) : (
          <>
            <ul className="overflow-hidden rounded-2xl bg-surface">
              {rows.map((s) => (
                <li key={s.id} className="border-b border-line/60 last:border-0">
                  <Link to={`/suppliers/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-raised text-xs font-bold text-brass" aria-hidden="true">{initials(s.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{s.name}</span>
                      <span className="block truncate text-xs text-ink-2">{s.phone || "No phone"}{s.gst_number ? ` · GST ${s.gst_number}` : ""}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <div ref={sentinel} className="py-3 text-center text-xs text-ink-2">{list.isFetchingNextPage ? "Loading more…" : ""}</div>
          </>
        )}
      </div>
    </div>
  );
}
