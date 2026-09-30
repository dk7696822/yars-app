import PropTypes from "prop-types";

/** Progress bar for multi-step forms. Reached steps are tappable (go back and fix). */
export default function Stepper({ steps, current, reached, onGo }) {
  return (
    <nav aria-label="Form steps">
      <ol className="flex gap-1.5">
        {steps.map((name, i) => (
          <li key={name} className="flex-1">
            <button type="button" disabled={i > reached} onClick={() => onGo(i)} aria-current={i === current ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${name}`} className="block w-full py-2.5 disabled:cursor-default">
              <span className={`block h-1.5 rounded-full transition-colors ${i <= current ? "bg-brass" : i <= reached ? "bg-brass/40" : "bg-line"}`} />
            </button>
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-2">Step {current + 1} of {steps.length} · {steps[current]}</p>
    </nav>
  );
}

Stepper.propTypes = { steps: PropTypes.arrayOf(PropTypes.string).isRequired, current: PropTypes.number.isRequired, reached: PropTypes.number.isRequired, onGo: PropTypes.func.isRequired };
