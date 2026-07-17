import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle } from "react-icons/fa";

/**
 * Lightweight toast notifications. Renders above the bottom tab bar on
 * phones and bottom-right on desktop. Usage:
 *   const toast = useToast();
 *   toast.success("Order deleted");
 */

const ToastContext = createContext(null);

const TOAST_DURATION = 3200;

const ICONS = {
  success: FaCheckCircle,
  error: FaExclamationCircle,
  info: FaInfoCircle,
};

const STYLES = {
  success:
    "bg-white dark:bg-[#111916] border-emerald-200 dark:border-emerald-500/30 text-gray-800 dark:text-emerald-50 [&_svg]:text-emerald-500 dark:[&_svg]:text-emerald-400",
  error:
    "bg-white dark:bg-[#191212] border-red-200 dark:border-red-500/30 text-gray-800 dark:text-red-50 [&_svg]:text-red-500 dark:[&_svg]:text-red-400",
  info:
    "bg-white dark:bg-[#111916] border-gray-200 dark:border-emerald-900/40 text-gray-800 dark:text-gray-100 [&_svg]:text-gray-500 dark:[&_svg]:text-gray-400",
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
                rounded-xl border px-4 py-3 shadow-lg dark:shadow-black/40 cursor-pointer`}
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
