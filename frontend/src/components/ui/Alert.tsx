import React from "react";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "success" | "error" | "info" | "warning";
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className = "", variant = "info", children, ...props }, ref) => {
    const baseClasses = "alert";
    
    const variantClasses = {
      success: "alert-success",
      error: "alert-error",
      info: "alert-info",
      warning: "alert-warning",
    };

    const classes = `${baseClasses} ${variantClasses[variant]} ${className}`.trim();

    return (
      <div ref={ref} className={classes} role="alert" {...props}>
        {children}
      </div>
    );
  }
);

Alert.displayName = "Alert";

