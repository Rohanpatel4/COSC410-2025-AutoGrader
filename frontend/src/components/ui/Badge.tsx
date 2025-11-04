import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = "", variant = "default", children, ...props }, ref) => {
    const baseClasses = "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium";
    
    const variantClasses = {
      default: "bg-primary/10 text-primary dark:bg-primary/15 dark:text-white",
      success: "bg-accent/10 text-accent dark:bg-accent/15 dark:text-white",
      warning: "bg-warning/10 text-warning dark:bg-warning/15 dark:text-white",
      danger: "bg-danger/10 text-danger dark:bg-danger/15 dark:text-white",
      info: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
    };

    const classes = `${baseClasses} ${variantClasses[variant]} ${className}`.trim();

    return (
      <span ref={ref} className={classes} {...props}>
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

