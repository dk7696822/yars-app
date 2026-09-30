import PropTypes from "prop-types";

export const Skeleton = () => (
  <div className="space-y-3 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
    <div className="h-44 rounded-3xl bg-surface" />
    {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-2xl bg-surface" />)}
    <div className="grid grid-cols-2 gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-surface" />)}</div>
  </div>
);

export const LoadError = ({ onRetry }) => (
  <div className="rounded-2xl bg-surface p-5 text-sm text-ink" role="alert">
    <p className="font-semibold">Couldn&apos;t load the dashboard.</p>
    <p className="mt-1 text-ink-2">Check your connection and try again.</p>
    <button type="button" onClick={onRetry} className="mt-3 rounded-xl bg-brass px-4 py-2 font-semibold text-brass-on">Try again</button>
  </div>
);
LoadError.propTypes = { onRetry: PropTypes.func.isRequired };

export const ChecksFailed = () => (
  <div className="rounded-2xl border border-status-critical/60 bg-status-critical/10 p-5 text-sm text-ink" role="alert">
    <p className="font-semibold text-status-critical">These figures don&apos;t add up — not showing them until this is fixed.</p>
    <p className="mt-1 text-ink-2">Nothing in your data has changed. Please report this so it can be checked.</p>
  </div>
);
