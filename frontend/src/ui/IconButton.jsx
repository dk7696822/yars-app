import PropTypes from "prop-types";

/** Icon-only button: `label` is required and becomes its accessible name. */
export default function IconButton({ label, className = "", children, ...rest }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-raised text-ink transition hover:bg-line active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass ${className}`} {...rest}>
      {children}
    </button>
  );
}

IconButton.propTypes = { label: PropTypes.string.isRequired, className: PropTypes.string, children: PropTypes.node };
