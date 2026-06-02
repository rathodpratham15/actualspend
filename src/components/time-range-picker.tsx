"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const RANGES = [
  { id: "1M", label: "1M", months: 1 },
  { id: "3M", label: "3M", months: 3 },
  { id: "6M", label: "6M", months: 6 },
  { id: "1Y", label: "1Y", months: 12 },
] as const;

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TimeRangePicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const navigate = (months: number) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const p = new URLSearchParams(params.toString());
    p.set("from", toIsoDate(start));
    p.set("to", toIsoDate(now));
    router.push(`${pathname}?${p.toString()}`);
  };

  // Determine which range is active.
  const now = new Date();
  const fromDate = new Date(from);
  const diffMonths = Math.round((now.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
  const active =
    diffMonths <= 1 ? "1M" :
    diffMonths <= 3 ? "3M" :
    diffMonths <= 6 ? "6M" : "1Y";

  return (
    <div className="flex items-center gap-1 bg-muted/50 rounded-md p-1" data-testid="range-toggle">
      {RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => navigate(r.months)}
          data-testid={`range-${r.label}`}
          className={`px-3 h-8 text-xs font-medium rounded-md transition-colors ${
            active === r.id
              ? "bg-surface text-foreground shadow-soft"
              : "text-secondary hover:text-foreground"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
