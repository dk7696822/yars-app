import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useInvoiceList } from "./api";
import InvoiceRow from "./InvoiceRow";
import Chips from "../../ui/Chips";
import TextInput from "../../ui/TextInput";
import PageHeader from "../../ui/PageHeader";
import Button from "../../ui/Button";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { inr } from "../../utils/dashboardFormat";

export default function InvoicesPage() {
  const [params, setParams] = useSearchParams();
  const chip = params.get("chip") || "all";
  const search = params.get("q") || "";
  const term = useDebounced(search.trim());
  const list = useInvoiceList({ chip, search: term || undefined });
  const sentinel = useInfiniteSentinel(list);
  const pages = list.data?.pages;
  const rows = useMemo(() => (pages || []).flatMap((p) => p.rows), [pages]);
  const first = pages?.[0];

  const setParam = (key, value) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });

  const chips = [
    { value: "all", label: "All", count: first?.counts.all },
    { value: "unpaid", label: "Unpaid", count: first?.counts.unpaid },
    { value: "overdue", label: "Overdue", count: first?.counts.overdue },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Invoices" actions={<Link to="/invoices/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>} />
      <div className="mt-3 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setParam("q", e.target.value)} placeholder="Search customer or invoice number" aria-label="Search invoices" enterKeyHint="search" />
        <Chips label="Filter invoices" options={chips} value={chip} onChange={(v) => setParam("chip", v)} />
        {first && first.summary.due > 0 && (
          <p className="text-sm text-ink-2" aria-live="polite">Unpaid <span className="font-num font-semibold text-status-critical tabular-nums">{inr(first.summary.due)}</span> across {first.counts.unpaid} invoice{first.counts.unpaid === 1 ? "" : "s"}</p>
        )}
      </div>
      <div className={`mt-3 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        {list.isPending ? (
          <ListSkeleton />
        ) : list.isError && rows.length === 0 ? (
          <ErrorState title="Couldn't load invoices." onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          chip !== "all" || term ? (
            <EmptyState title="No invoices match" action={<Button variant="secondary" onClick={() => setParams({}, { replace: true })}>Clear search and filters</Button>} />
          ) : (
            <EmptyState title="No invoices yet" body="Make one from a customer's orders." action={<Link to="/invoices/new" className={buttonClass()}>New invoice</Link>} />
          )
        ) : (
          <ul className="overflow-hidden rounded-2xl bg-surface">{rows.map((r) => <InvoiceRow key={r.id} row={r} />)}</ul>
        )}
        <div ref={sentinel} aria-hidden="true" />
        {list.isFetchingNextPage && <ListSkeleton rows={2} />}
      </div>
    </div>
  );
}
