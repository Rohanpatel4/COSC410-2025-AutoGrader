import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error = false, ...props }, ref) => {
    const baseClasses = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-foreground shadow-sm placeholder:text-muted-foreground transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-ring/25 focus:outline-none";
    const errorClasses = error ? "border-danger focus:ring-danger/25" : "";
    const classes = `${baseClasses} ${errorClasses} ${className}`.trim();

    return <input ref={ref} className={classes} {...props} />;
  }
);

Input.displayName = "Input";

