import PropTypes from "prop-types";
import { INPUT, INPUT_INVALID } from "./styles";

export default function TextInput({ className = "", ...rest }) {
  return <input className={`${INPUT} ${rest["aria-invalid"] ? INPUT_INVALID : ""} ${className}`} {...rest} />;
}

TextInput.propTypes = { className: PropTypes.string };
