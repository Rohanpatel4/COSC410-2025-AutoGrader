import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = "", variant = "default", children, ...props }, ref) => {
    const baseClasses = "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium";
    
    const variantClasses = {
      default: "bg-primary/10 text-primary",
      success: "bg-accent/10 text-accent",
      warning: "bg-warning/10 text-warning",
      danger: "bg-danger/10 text-danger",
      info: "bg-primary/10 text-primary",
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

