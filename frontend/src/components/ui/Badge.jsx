import { cn } from "../../lib/utils";

function Badge({ className, variant = "default", ...props }) {
  const baseClasses = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold";

  const variantClasses = {
    default: "border-transparent bg-primary text-white",
    secondary: "border-transparent bg-secondary text-white",
    destructive: "border-transparent bg-destructive text-white",
    outline: "border-gray-200 text-gray-900",
    success: "border-transparent bg-green-100 text-green-800",
    warning: "border-transparent bg-yellow-100 text-yellow-800",
  };

  return <div className={cn(baseClasses, variantClasses[variant], className)} {...props} />;
}

export { Badge };
