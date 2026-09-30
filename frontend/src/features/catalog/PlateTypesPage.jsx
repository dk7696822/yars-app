import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ChevronRight } from "lucide-react";
import { usePlates } from "./api";
import PageHeader from "../../ui/PageHeader";
import TextInput from "../../ui/TextInput";
import { Money } from "../../ui/Money";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";

export default function PlateTypesPage() {
  const [search, setSearch] = useState("");
  const plates = usePlates();
  const term = search.trim().toLowerCase();
  const rows = useMemo(() => (plates.data || []).filter((p) => p.type_name.toLowerCase().includes(term)), [plates.data, term]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Plate types" actions={<Link to="/plate-types/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>} />
      <div className="mt-3 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plate types" aria-label="Search plate types" enterKeyHint="search" />
        {plates.data && <p className="text-sm text-ink-2">{plates.data.length} plate types · the charge is added once per order</p>}
      </div>
      <div className="mt-3">
        {plates.isPending ? (
          <ListSkeleton />
        ) : plates.isError ? (
          <ErrorState title="Couldn't load plate types." onRetry={() => plates.refetch()} />
        ) : rows.length === 0 ? (
          term
            ? <EmptyState title={`No plate type matches “${search.trim()}”`} />
            : <EmptyState title="No plate types yet" action={<Link to="/plate-types/new" className={buttonClass()}>Add a plate type</Link>} />
        ) : (
          <ul className="overflow-hidden rounded-2xl bg-surface">
            {rows.map((p) => (
              <li key={p.id} className="border-b border-line/60 last:border-0">
                <Link to={`/plate-types/edit/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{p.type_name}</span>
                  <Money value={Number(p.charge)} className="text-sm font-semibold text-ink" />
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
