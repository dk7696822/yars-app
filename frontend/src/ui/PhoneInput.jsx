import PropTypes from "prop-types";
import { INPUT } from "./styles";
import { mobileStatus } from "../utils/phone";

export default function PhoneInput({ value, onChange, ...rest }) {
  const status = mobileStatus(value);
  return (
    <div>
      <div className="flex gap-2">
        <span className="grid h-12 place-items-center rounded-2xl bg-raised px-3.5 font-num text-ink-2" aria-hidden="true">+91</span>
        <input type="tel" inputMode="tel" autoComplete="tel-national" value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} font-num tabular-nums`} {...rest} />
      </div>
      {status === "valid" && <p className="mt-1.5 text-xs font-medium text-status-good">✓ Valid mobile — Call and WhatsApp will work</p>}
      {status === "invalid" && <p className="mt-1.5 text-xs text-status-warn">Not a 10-digit mobile — Call and WhatsApp won&apos;t work</p>}
    </div>
  );
}

PhoneInput.propTypes = { value: PropTypes.string.isRequired, onChange: PropTypes.func.isRequired };
