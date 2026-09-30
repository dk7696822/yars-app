import PropTypes from "prop-types";

/** Pages not redesigned yet: the old stylesheet rules only apply inside `.legacy`, so they can't leak onto new screens. */
export default function Legacy({ children }) {
  return <div className="legacy">{children}</div>;
}

Legacy.propTypes = { children: PropTypes.node };
