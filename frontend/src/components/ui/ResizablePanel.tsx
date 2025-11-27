import React, { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from "../../lib/utils";
import { ChevronLeft, ChevronRight, GripVertical, GripHorizontal } from "lucide-react";

interface ResizablePanelProps {
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  initialLeftPercentage?: number; // percentage 0-100
  minLeftPercentage?: number;
  maxLeftPercentage?: number;
  onCollapse?: (collapsed: boolean) => void;
}

export function HorizontalResizablePanel({
  leftContent,
  rightContent,
  initialLeftPercentage = 40,
  minLeftPercentage = 20,
  maxLeftPercentage = 80,
  onCollapse
}: ResizablePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(initialLeftPercentage);
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [lastWidth, setLastWidth] = useState(initialLeftPercentage);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        
        if (newWidth >= minLeftPercentage && newWidth <= maxLeftPercentage) {
            setLeftWidth(newWidth);
            if (isCollapsed) setIsCollapsed(false);
        }
      }
    },
    [isResizing, minLeftPercentage, maxLeftPercentage, isCollapsed]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  const toggleCollapse = () => {
    if (isCollapsed) {
      setLeftWidth(lastWidth);
      setIsCollapsed(false);
      onCollapse?.(false);
    } else {
      setLastWidth(leftWidth);
      setLeftWidth(0);
      setIsCollapsed(true);
      onCollapse?.(true);
    }
  };

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden relative">
      {/* Left Panel */}
      <div 
        className={cn(
            "h-full flex flex-col overflow-hidden relative",
            isResizing && "select-none pointer-events-none"
        )}
        style={{ 
            width: isCollapsed ? '0px' : `${leftWidth}%`,
            minWidth: isCollapsed ? '0px' : '0px', // Allow collapsing
            opacity: isCollapsed ? 0 : 1,
            transition: isResizing ? 'none' : 'width 0.3s ease-in-out, opacity 0.2s ease-in-out'
        }}
      >
         <div className="h-full w-full overflow-hidden relative border-r border-border/50">
             {/* Collapse Button (Inside Left Panel, top right) */}
             {!isCollapsed && (
                <button 
                    onClick={toggleCollapse}
                    className="absolute top-3 right-3 z-50 p-1.5 bg-background/80 hover:bg-accent rounded-md border border-border shadow-sm text-muted-foreground hover:text-foreground transition-colors"
                    title="Collapse instructions"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
             )}
            {leftContent}
         </div>
      </div>

      {/* Resizer Handle */}
      {!isCollapsed && (
          <div
            className="w-1.5 -ml-[3px] cursor-col-resize bg-transparent hover:bg-primary/20 active:bg-primary/40 transition-colors flex flex-col justify-center items-center z-40 group"
            onMouseDown={startResizing}
          >
             <div className="h-8 w-1 bg-border group-hover:bg-primary/50 rounded-full transition-colors" />
          </div>
      )}
      
      {/* Collapsed Trigger (When hidden) */}
      {isCollapsed && (
         <div className="absolute left-0 top-4 z-50">
             <button 
                onClick={toggleCollapse}
                className="p-2 bg-background border border-border rounded-r-md shadow-md text-muted-foreground hover:text-primary transition-colors"
                title="Expand instructions"
             >
                <ChevronRight className="w-4 h-4" />
             </button>
         </div>
      )}

      {/* Right Panel */}
      <div 
        className="flex-1 h-full overflow-hidden flex flex-col min-w-0"
      >
        {rightContent}
      </div>
    </div>
  );
}

interface VerticalResizablePanelProps {
  topContent: React.ReactNode;
  bottomContent: React.ReactNode;
  initialTopPercentage?: number; // percentage 0-100
  minTopPercentage?: number;
  maxTopPercentage?: number;
}

export function VerticalResizablePanel({
  topContent,
  bottomContent,
  initialTopPercentage = 60,
  minTopPercentage = 20,
  maxTopPercentage = 80,
}: VerticalResizablePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [topHeight, setTopHeight] = useState(initialTopPercentage);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100;
        
        if (newHeight >= minTopPercentage && newHeight <= maxTopPercentage) {
            setTopHeight(newHeight);
        }
      }
    },
    [isResizing, minTopPercentage, maxTopPercentage]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full overflow-hidden relative">
      {/* Top Panel */}
      <div 
        className={cn(
            "w-full overflow-hidden relative",
            isResizing && "select-none pointer-events-none"
        )}
        style={{ 
            height: `${topHeight}%`,
            transition: isResizing ? 'none' : 'height 0.1s ease-out'
        }}
      >
         <div className="h-full w-full overflow-hidden relative border-b border-border/50">
            {topContent}
         </div>
      </div>

      {/* Resizer Handle */}
      <div
        className="h-1.5 -mt-[3px] cursor-row-resize bg-transparent hover:bg-primary/20 active:bg-primary/40 transition-colors flex justify-center items-center z-40 group w-full"
        onMouseDown={startResizing}
      >
         <div className="w-8 h-1 bg-border group-hover:bg-primary/50 rounded-full transition-colors" />
      </div>

      {/* Bottom Panel */}
      <div 
        className="flex-1 w-full overflow-hidden flex flex-col min-h-0"
      >
        {bottomContent}
      </div>
    </div>
  );
}

