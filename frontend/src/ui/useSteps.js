import { useState } from "react";
import { firstInvalid } from "../utils/steps";

const scrollTop = () => document.querySelector("main")?.scrollTo({ top: 0 });
const focusFirstError = () => requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());

/**
 * Multi-step form state. Errors show for a step only after Next was tried on it.
 * Back never loses anything: the data lives in the page, steps are just views.
 */
export default function useSteps({ count, errorsFor, start = 0 }) {
  const [step, setStep] = useState(start);
  const [reached, setReached] = useState(start);
  const [shown, setShown] = useState({});

  const goTo = (i) => {
    setStep(i);
    setReached((r) => Math.max(r, i));
    scrollTop();
  };
  const next = () => {
    if (Object.keys(errorsFor(step)).length) {
      setShown((s) => ({ ...s, [step]: true }));
      focusFirstError();
      return;
    }
    goTo(Math.min(count - 1, step + 1));
  };
  const validateAll = () => {
    const bad = firstInvalid(count, errorsFor);
    if (bad === -1) return true;
    setShown(Object.fromEntries(Array.from({ length: count }, (_, i) => [i, true])));
    goTo(bad);
    focusFirstError();
    return false;
  };
  return {
    step,
    reached,
    shownFor: (i) => Boolean(shown[i]),
    next,
    back: () => goTo(Math.max(0, step - 1)),
    go: (i) => i <= reached && goTo(i),
    validateAll,
  };
}
