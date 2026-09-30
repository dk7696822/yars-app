import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { animate, useReducedMotion } from "motion/react";

export default function AnimatedNumber({ value, format, duration = 0.9, className = "" }) {
  const ref = useRef(null);
  const from = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const target = Number(value);
    if (reduce || from.current === target) {
      el.textContent = format(target);
      from.current = target;
      return undefined;
    }
    const controls = animate(from.current, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { el.textContent = format(Math.round(v * 100) / 100); },
      onComplete: () => { el.textContent = format(target); },
    });
    from.current = target;
    return () => { controls.stop(); el.textContent = format(target); };
  }, [value, format, duration, reduce]);

  return <span ref={ref} className={`font-num tabular-nums ${className}`} aria-label={format(value)}>{format(value)}</span>;
}

AnimatedNumber.propTypes = { value: PropTypes.number.isRequired, format: PropTypes.func.isRequired, duration: PropTypes.number, className: PropTypes.string };
