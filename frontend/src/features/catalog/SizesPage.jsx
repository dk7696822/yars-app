import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ChevronRight } from "lucide-react";
import { useSizes } from "./api";
import { sizePricingText } from "./sizeForm";
import PageHeader from "../../ui/PageHeader";
import TextInput from "../../ui/TextInput";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";

export default function SizesPage() {
  const [search, setSearch] = useState("");
  const sizes = useSizes();
  const term = search.trim().toLowerCase();
  const rows = useMemo(() => (sizes.data || []).filter((s) => s.size_label.toLowerCase().includes(term)), [sizes.data, term]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Sizes" actions={<Link to="/product-sizes/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>} />
      <div className="mt-3 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sizes" aria-label="Search sizes" enterKeyHint="search" />
        {sizes.data && <p className="text-sm text-ink-2">{sizes.data.length} sizes · tap one to change its prices or weight</p>}
      </div>
      <div className="mt-3">
        {sizes.isPending ? (
          <ListSkeleton />
        ) : sizes.isError ? (
          <ErrorState title="Couldn't load sizes." onRetry={() => sizes.refetch()} />
        ) : rows.length === 0 ? (
          term
            ? <EmptyState title={`No size matches “${search.trim()}”`} />
            : <EmptyState title="No sizes yet" body="Add the bag sizes you make, with their rate per kg or piece price." action={<Link to="/product-sizes/new" className={buttonClass()}>Add a size</Link>} />
        ) : (
          <ul className="overflow-hidden rounded-2xl bg-surface">
            {rows.map((s) => (
              <li key={s.id} className="border-b border-line/60 last:border-0">
                <Link to={`/product-sizes/edit/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{s.size_label}</span>
                    <span className="block truncate text-xs text-ink-2">{sizePricingText(s)}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
