import React from "react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", error = false, children, ...props }, ref) => {
    const errorClasses = error ? "border-danger focus:ring-danger/25" : "";
    const classes = `${errorClasses} ${className}`.trim();

    return (
      <select ref={ref} className={classes} {...props}>
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";

