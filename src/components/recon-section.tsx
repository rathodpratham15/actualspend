"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function ReconSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-8 border-t border-border pt-6">
      <button
        type="button"
        data-testid={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-baseline gap-3">
          <span className="text-[15px] font-medium">{title}</span>
          <span className="font-mono text-secondary text-sm">({count})</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-secondary transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="mt-6 space-y-3">{children}</div>}
    </div>
  );
}
