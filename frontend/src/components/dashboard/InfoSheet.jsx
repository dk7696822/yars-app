import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { AnimatePresence, motion } from "motion/react";

export default function InfoSheet({ open, title, onClose, children }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
          <motion.button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-surface text-ink p-5 pb-8 shadow-2xl"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-num text-lg font-semibold">{title}</h2>
              <button ref={closeRef} type="button" onClick={onClose} className="rounded-full px-3 py-1 text-sm text-ink-2 hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">Close</button>
            </div>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

InfoSheet.propTypes = { open: PropTypes.bool.isRequired, title: PropTypes.string.isRequired, onClose: PropTypes.func.isRequired, children: PropTypes.node };
