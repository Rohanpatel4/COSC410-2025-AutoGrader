import React from "react";
import { cn } from "../../lib/utils";

interface ContentRowProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function ContentRow({ title, children, className }: ContentRowProps) {
  return (
    <div className={cn("content-row", className)}>
      {title && <h2 className="content-row-title">{title}</h2>}
      <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
        {children}
      </div>
    </div>
  );
}

interface ContentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function ContentCard({ children, className, ...props }: ContentCardProps) {
  return (
    <div
      className={cn(
        "flex-none w-72 bg-card border border-border rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
