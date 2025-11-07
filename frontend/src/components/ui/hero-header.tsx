import React from "react";
import { cn } from "../../lib/utils";

interface HeroHeaderProps {
  title: string;
  subtitle?: string;
  stats?: Array<{ label: string; value: string | number }>;
  className?: string;
  children?: React.ReactNode;
}

export function HeroHeader({
  title,
  subtitle,
  stats,
  className,
  children
}: HeroHeaderProps) {
  return (
    <div className={cn("hero-header-improved", className)}>
      <div className="relative z-10 flex flex-col justify-end h-full">
        {/* Main content area */}
        <div className="mb-8">
          <h1 className="hero-title-improved">{title}</h1>
          {subtitle && <p className="hero-subtitle-improved">{subtitle}</p>}
        </div>

        {/* Stats section - positioned separately */}
        {stats && stats.length > 0 && (
          <div className="hero-stats">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {stats.map((stat, index) => (
                <div key={index} className="hero-stat-card">
                  <div className="text-3xl font-bold text-primary-foreground mb-1">{stat.value}</div>
                  <div className="text-sm font-medium text-primary-foreground/90">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {children && (
          <div className="mt-6">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
