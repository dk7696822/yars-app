import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useDirectory } from "./api";
import CustomerRow from "./CustomerRow";
import Chips from "../../ui/Chips";
import TextInput from "../../ui/TextInput";
import PageHeader from "../../ui/PageHeader";
import { EmptyState, ErrorState, ListSkeleton } from "../../ui/States";
import { buttonClass } from "../../ui/styles";
import useDebounced from "../../ui/useDebounced";
import useInfiniteSentinel from "../../ui/useInfiniteSentinel";
import { groupByLetter } from "../../utils/alphaIndex";
import { inr } from "../../utils/dashboardFormat";

export default function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const owe = params.get("owe") === "1";
  const search = params.get("q") || "";
  const term = useDebounced(search.trim());
  const list = useDirectory({ owe: owe ? "1" : undefined, search: term || undefined });
  const sentinel = useInfiniteSentinel(list);
  const pages = list.data?.pages;
  const rows = useMemo(() => (pages || []).flatMap((p) => p.rows), [pages]);
  const first = pages?.[0];
  const groups = useMemo(() => (owe ? [] : groupByLetter(rows)), [rows, owe]);
  const [jump, setJump] = useState(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;

  // Letter index: load pages until that letter is on screen, then scroll to it.
  useEffect(() => {
    if (!jump) return;
    if (rows.length > jump.index || !hasNextPage) {
      document.getElementById(`letter-${jump.letter}`)?.scrollIntoView({ block: "start" });
      setJump(null);
    } else if (!isFetchingNextPage) {
      fetchNextPage();
    }
  }, [jump, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const setParam = (key, value) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });

  const s = first?.summary;
  const chips = [
    { value: "all", label: "All", count: s?.count },
    { value: "owe", label: "Owe money", count: s?.owingCount },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
      <PageHeader title="Customers" actions={<Link to="/customers/new" className={buttonClass({ size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />New</Link>} />
      <div className="mt-3 space-y-3">
        <TextInput type="search" value={search} onChange={(e) => setParam("q", e.target.value)} placeholder="Search name or phone" aria-label="Search customers" enterKeyHint="search" />
        <Chips label="Which customers" options={chips} value={owe ? "owe" : "all"} onChange={(v) => setParam("owe", v === "owe" ? "1" : "")} />
        {owe && s && <p className="text-sm text-ink-2" aria-live="polite">{s.owingCount} customer{s.owingCount === 1 ? "" : "s"} owe <span className="font-num font-semibold text-status-critical tabular-nums">{inr(s.due)}</span> · oldest first</p>}
      </div>

      <div className={`mt-3 flex gap-2 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
        <div className="min-w-0 flex-1">
          {list.isPending ? (
            <ListSkeleton />
          ) : list.isError && rows.length === 0 ? (
            <ErrorState title="Couldn't load customers." onRetry={() => list.refetch()} />
          ) : rows.length === 0 ? (
            term ? (
              <EmptyState title={`No customer matches “${term}”`} action={<Link to={`/customers/new?name=${encodeURIComponent(term)}`} className={buttonClass({ variant: "secondary" })}>Add “{term}” as a customer</Link>} />
            ) : owe ? (
              <EmptyState title="Nobody owes you money" body="Every order is paid up." />
            ) : (
              <EmptyState title="No customers yet" action={<Link to="/customers/new" className={buttonClass()}>Add a customer</Link>} />
            )
          ) : owe ? (
            <ul className="overflow-hidden rounded-2xl bg-surface">{rows.map((c) => <CustomerRow key={c.id} customer={c} oweView />)}</ul>
          ) : (
            groups.map((g) => (
              <section key={g.letter} aria-labelledby={`letter-${g.letter}`} className="mb-3">
                <h2 id={`letter-${g.letter}`} className="sticky top-0 z-[1] bg-canvas/95 px-1 py-1.5 text-xs font-bold text-brass backdrop-blur">{g.letter}</h2>
                <ul className="overflow-hidden rounded-2xl bg-surface">{g.rows.map((c) => <CustomerRow key={c.id} customer={c} />)}</ul>
              </section>
            ))
          )}
          <div ref={sentinel} aria-hidden="true" />
          {list.isFetchingNextPage && <ListSkeleton rows={2} />}
        </div>

        {!owe && first?.letters?.length > 1 && (
          <nav aria-label="Jump to letter" className="sticky top-4 flex flex-col self-start rounded-full bg-surface/80 py-1">
            {first.letters.map((l) => (
              <button key={l.letter} type="button" onClick={() => setJump(l)} className="px-2 py-0.5 text-[11px] font-bold text-ink-2 hover:text-brass focus-visible:text-brass">{l.letter}</button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
