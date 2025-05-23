import { forwardRef } from "react";
import { cn } from "../../lib/utils";

const Button = forwardRef(({ className, variant = "default", size = "default", asChild, ...props }, ref) => {
  const Comp = asChild ? props.children.type : "button";
  const childProps = asChild ? { ...props.children.props } : {};

  const baseClasses =
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus:ring-primary focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

  const variantClasses = {
    default: "bg-primary text-white hover:bg-primary-600 dark:bg-primary-600 dark:hover:bg-primary-700",
    destructive: "bg-destructive text-white hover:bg-destructive-600 dark:bg-destructive-600 dark:hover:bg-destructive-700",
    outline: "border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-200",
    secondary: "bg-secondary text-white hover:bg-secondary-600 dark:bg-secondary-600 dark:hover:bg-secondary-700",
    ghost: "hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200",
    link: "text-primary dark:text-primary-400 hover:underline",
    success: "bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800",
    primary: "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800",
  };

  const sizeClasses = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3 py-1.5 text-xs",
    lg: "h-11 rounded-md px-8 py-2.5",
    icon: "h-10 w-10 p-0",
  };

  const classes = cn(baseClasses, variantClasses[variant], sizeClasses[size], className);

  return asChild ? <Comp className={classes} ref={ref} {...childProps} /> : <button className={classes} ref={ref} {...props} />;
});

Button.displayName = "Button";

export { Button };
