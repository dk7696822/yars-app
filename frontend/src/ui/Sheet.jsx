import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { AnimatePresence, motion } from "motion/react";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet on phones, dialog on wider screens. Portalled to <body> (the
 * page wrapper is transformed). Traps Tab, closes on Escape, locks page scroll,
 * and returns focus to what opened it.
 */
export default function Sheet({ open, title, onClose, footer, children }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const returnTo = document.activeElement;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.querySelector(FOCUSABLE)?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      returnTo?.focus?.();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
          <motion.button type="button" tabIndex={-1} aria-label="Close" className="absolute inset-0 bg-black/55" onClick={() => onCloseRef.current()}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div ref={panelRef} className="relative flex max-h-[88vh] w-full max-w-md flex-col rounded-t-3xl bg-surface text-ink shadow-2xl sm:rounded-3xl"
            initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 48, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}>
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
            <div className="flex items-center justify-between gap-4 px-5 pt-3">
              <h2 className="font-num text-lg font-semibold">{title}</h2>
              <button type="button" onClick={() => onCloseRef.current()} className="rounded-full px-3 py-1.5 text-sm text-ink-2 hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">Close</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">{children}</div>
            {footer && <div className="border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

Sheet.propTypes = { open: PropTypes.bool.isRequired, title: PropTypes.string.isRequired, onClose: PropTypes.func.isRequired, footer: PropTypes.node, children: PropTypes.node };
