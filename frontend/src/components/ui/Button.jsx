import { forwardRef } from "react";
import { cn } from "../../lib/utils";

const Button = forwardRef(({ className, variant = "default", size = "default", asChild, ...props }, ref) => {
  const Comp = asChild ? props.children.type : "button";
  const childProps = asChild ? { ...props.children.props } : {};

  const baseClasses =
    "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]";

  const variantClasses = {
    default: "bg-primary text-white hover:bg-primary-700 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25",
    destructive: "bg-destructive text-white hover:bg-destructive-600 shadow-md shadow-destructive/20 hover:shadow-lg hover:shadow-destructive/25",
    outline: "border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-200",
    secondary: "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700",
    ghost: "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100",
    link: "text-primary dark:text-primary-400 hover:underline underline-offset-4",
    success: "bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-600/20 hover:shadow-lg hover:shadow-green-600/25",
    primary: "bg-primary text-white hover:bg-primary-700 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25",
  };

  const sizeClasses = {
    default: "h-11 px-5 py-2.5",
    sm: "h-9 rounded-lg px-3.5 py-2 text-xs",
    lg: "h-12 rounded-xl px-8 py-3 text-base",
    icon: "h-10 w-10 p-0",
  };

  const classes = cn(baseClasses, variantClasses[variant], sizeClasses[size], className);

  return asChild ? <Comp className={classes} ref={ref} {...childProps} /> : <button className={classes} ref={ref} {...props} />;
});

Button.displayName = "Button";

export { Button };
