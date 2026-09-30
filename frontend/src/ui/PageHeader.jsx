import PropTypes from "prop-types";

/** Desktop page title + actions. On phones the app header shows the title, so only the actions show here. */
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="hidden font-num text-2xl font-semibold text-ink sm:block">{title}</h1>
        {subtitle && <p className="text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

PageHeader.propTypes = { title: PropTypes.string.isRequired, subtitle: PropTypes.node, actions: PropTypes.node };
