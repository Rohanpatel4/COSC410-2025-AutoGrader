import React from "react";
import { cn } from "../../lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className
}: PageHeaderProps) {
  return (
    <div className={cn("mb-8 pb-6 border-b border-border", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-2">
            {title}
          </h1>
          {subtitle && (
            <p className="text-base text-muted-foreground max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

