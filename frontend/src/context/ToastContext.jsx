import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { CircleCheck, CircleAlert, Info } from "lucide-react";

/**
 * Lightweight toast notifications. Renders above the bottom tab bar on
 * phones and bottom-right on desktop. Usage:
 *   const toast = useToast();
 *   toast.success("Order deleted");
 */

const ToastContext = createContext(null);

const TOAST_DURATION = 3200;

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };

const STYLES = {
  success: "border-status-good/40 [&_svg]:text-status-good",
  error: "border-status-critical/40 [&_svg]:text-status-critical",
  info: "border-line [&_svg]:text-brass",
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    // Mark as leaving so the exit animation plays, then remove.
    setToasts((current) =>
      current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast))
    );
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 200);
  }, []);

  const show = useCallback(
    (type, message) => {
      const id = ++idRef.current;
      setToasts((current) => [...current.slice(-2), { id, type, message }]);
      setTimeout(() => dismiss(id), TOAST_DURATION);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (message) => show("success", message),
      error: (message) => show("error", message),
      info: (message) => show("info", message),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div className="fixed z-[60] inset-x-4 bottom-24 sm:inset-x-auto sm:right-6 sm:bottom-6 flex flex-col items-center sm:items-end gap-2 pointer-events-none">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type];
          return (
            <div
              key={toast.id}
              role="status"
              onClick={() => dismiss(toast.id)}
              className={`${toast.leaving ? "toast-out" : "toast-in"} ${STYLES[toast.type]}
                pointer-events-auto flex items-center gap-3 w-full sm:w-auto sm:max-w-sm
                rounded-2xl border bg-raised px-4 py-3 text-ink shadow-lg shadow-black/30 cursor-pointer`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

ToastProvider.propTypes = {
  children: PropTypes.node,
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
};
