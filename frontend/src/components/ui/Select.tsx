import React from "react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", error = false, children, ...props }, ref) => {
    const baseClasses = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-foreground shadow-sm transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-ring/25 focus:outline-none";
    const errorClasses = error ? "border-danger focus:ring-danger/25" : "";
    const classes = `${baseClasses} ${errorClasses} ${className}`.trim();

    return (
      <select ref={ref} className={classes} {...props}>
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";

