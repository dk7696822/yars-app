/** Shared class strings for the kit (kept out of component files). */
const BUTTON = {
  base: "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass",
  primary: "bg-brass text-brass-on hover:brightness-110",
  secondary: "bg-raised text-ink hover:bg-line",
  ghost: "text-ink-2 hover:bg-raised hover:text-ink",
  danger: "bg-status-critical/15 text-status-critical hover:bg-status-critical/25",
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-[0.95rem]",
};

export const buttonClass = ({ variant = "primary", size = "md", block = false } = {}) =>
  `${BUTTON.base} ${BUTTON[variant]} ${BUTTON[size]}${block ? " w-full" : ""}`;

export const INPUT =
  "h-12 w-full rounded-2xl border border-line bg-surface px-3.5 text-[0.95rem] text-ink placeholder:text-ink-2/60 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/25 disabled:opacity-60";
export const INPUT_INVALID = "border-status-critical focus:border-status-critical focus:ring-status-critical/25";
