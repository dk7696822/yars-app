import PropTypes from "prop-types";
import Button from "./Button";

export function EmptyState({ title, body, action }) {
  return (
    <div className="rounded-3xl bg-surface px-5 py-8 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 text-sm text-ink-2">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

EmptyState.propTypes = { title: PropTypes.string.isRequired, body: PropTypes.node, action: PropTypes.node };

export function ErrorState({ title = "Couldn't load this.", onRetry }) {
  return (
    <div className="rounded-3xl bg-surface p-5 text-sm" role="alert">
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1 text-ink-2">Check your connection and try again.</p>
      <Button className="mt-3" onClick={onRetry}>Try again</Button>
    </div>
  );
}

ErrorState.propTypes = { title: PropTypes.string, onRetry: PropTypes.func.isRequired };

export function ListSkeleton({ rows = 6 }) {
  return (
    <div className="animate-pulse space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="h-14 rounded-2xl bg-surface" />)}
    </div>
  );
}

ListSkeleton.propTypes = { rows: PropTypes.number };

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 py-4 sm:px-6">
      <div className="h-32 animate-pulse rounded-3xl bg-surface" />
      <ListSkeleton rows={5} />
    </div>
  );
}
