import { cn } from "../../lib/utils";

function Badge({ className, variant = "default", ...props }) {
  const baseClasses = "inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors";

  const variantClasses = {
    default: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-400",
    secondary: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    destructive: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    outline: "border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-transparent",
    success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  };

  return <span className={cn(baseClasses, variantClasses[variant], className)} {...props} />;
}

export { Badge };
