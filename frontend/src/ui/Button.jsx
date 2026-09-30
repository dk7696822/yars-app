import PropTypes from "prop-types";
import { buttonClass } from "./styles";

export default function Button({ variant = "primary", size = "md", block = false, loading = false, type = "button", className = "", disabled, children, ...rest }) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={`${buttonClass({ variant, size, block })} ${className}`} {...rest}>
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
      {children}
    </button>
  );
}

Button.propTypes = {
  variant: PropTypes.oneOf(["primary", "secondary", "ghost", "danger"]),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  block: PropTypes.bool,
  loading: PropTypes.bool,
  type: PropTypes.oneOf(["button", "submit"]),
  className: PropTypes.string,
  disabled: PropTypes.bool,
  children: PropTypes.node,
};
