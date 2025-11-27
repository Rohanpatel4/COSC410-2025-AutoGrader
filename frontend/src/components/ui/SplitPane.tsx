import React, { useState, useEffect, useRef } from "react";

interface SplitPaneProps {
  children: [React.ReactNode, React.ReactNode];
  direction?: "horizontal" | "vertical";
  initialSplit?: number; // percentage (0-100)
  minSize?: number; // pixels
  className?: string;
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  children,
  direction = "horizontal",
  initialSplit = 50,
  minSize = 50,
  className = "",
}) => {
  const [split, setSplit] = useState(initialSplit);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    let newSplit;

    if (direction === "horizontal") {
      const offsetX = e.clientX - rect.left;
      newSplit = (offsetX / rect.width) * 100;
    } else {
      const offsetY = e.clientY - rect.top;
      newSplit = (offsetY / rect.height) * 100;
    }

    // Constraints (convert minSize to percentage approximation or keep it simple)
    // Simple percent constraint:
    newSplit = Math.max(5, Math.min(95, newSplit));
    
    setSplit(newSplit);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  return (
    <div
      ref={containerRef}
      className={`flex ${direction === "horizontal" ? "flex-row" : "flex-col"} w-full h-full overflow-hidden ${className}`}
    >
      {/* First Pane */}
      <div style={{ flexBasis: `${split}%` }} className="relative overflow-hidden flex flex-col">
        {children[0]}
      </div>

      {/* Resizer Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`z-10 flex-shrink-0 bg-border hover:bg-primary/50 transition-colors ${
          direction === "horizontal"
            ? "w-1.5 cursor-col-resize border-l border-r border-border/50 hover:w-2"
            : "h-1.5 cursor-row-resize border-t border-b border-border/50 hover:h-2"
        } bg-muted flex items-center justify-center`}
      >
        <div className={`bg-muted-foreground/20 rounded-full ${
            direction === "horizontal" ? "w-0.5 h-4" : "h-0.5 w-4"
        }`} />
      </div>

      {/* Second Pane */}
      <div style={{ flexBasis: `${100 - split}%` }} className="relative overflow-hidden flex flex-col">
        {children[1]}
      </div>
    </div>
  );
};

