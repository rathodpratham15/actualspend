"use client";

import { useState, useTransition } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const QUICK_RANGES = [
  { id: "1M", label: "1M", months: 1 },
  { id: "3M", label: "3M", months: 3 },
  { id: "6M", label: "6M", months: 6 },
  { id: "1Y", label: "1Y", months: 12 },
] as const;

const PRESETS = ["This month", "Last month", "Last 30 days", "Last 90 days", "Year to date"] as const;
type Preset = (typeof PRESETS)[number];

function toIso(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function parseIso(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function getPresetRange(p: Preset): DateRange {
  const now = new Date();
  switch (p) {
    case "This month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    case "Last month":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 0),
      };
    case "Last 30 days": {
      const from = new Date(); from.setDate(from.getDate() - 30);
      return { from, to: now };
    }
    case "Last 90 days": {
      const from = new Date(); from.setDate(from.getDate() - 90);
      return { from, to: now };
    }
    case "Year to date":
      return { from: new Date(now.getFullYear(), 0, 1), to: now };
  }
}

export function TimeRangePicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const initialRange: DateRange = from && to
    ? { from: parseIso(from), to: parseIso(to) }
    : { from: new Date(), to: new Date() };
  const [calRange, setCalRange] = useState<DateRange>(initialRange);

  const navigate = (fromDate: Date, toDate: Date) => {
    const p = new URLSearchParams(params.toString());
    p.set("from", toIso(fromDate));
    p.set("to", toIso(toDate));
    startTransition(() => router.push(`${pathname}?${p.toString()}`));
  };

  const navigateMonths = (months: number) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    navigate(start, now);
  };

  // Determine active quick range.
  const now = new Date();
  const fromDate = new Date(from);
  const diffMonths = Math.round((now.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
  const activeQuick =
    diffMonths <= 1 ? "1M" : diffMonths <= 3 ? "3M" : diffMonths <= 6 ? "6M" : diffMonths <= 12 ? "1Y" : null;

  // Custom label when a non-quick range is active.
  const isCustom = !activeQuick;
  const customLabel = isCustom
    ? `${parseIso(from).toLocaleDateString("en-US", { month: "short", day: "2-digit" })} – ${parseIso(to).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}`
    : null;

  return (
    <div className="flex items-center gap-1">
      {/* Quick range buttons */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-md p-1" data-testid="range-toggle">
        {QUICK_RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => navigateMonths(r.months)}
            data-testid={`range-${r.label}`}
            className={`px-3 h-8 text-xs font-medium rounded-md transition-colors ${
              activeQuick === r.id
                ? "bg-surface text-foreground shadow-soft"
                : "text-secondary hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Custom / calendar button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="date-range-trigger"
            className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-md border text-sm transition-colors ${
              isCustom
                ? "border-foreground bg-surface text-foreground font-mono"
                : "border-border text-secondary hover:text-foreground hover:bg-surface"
            }`}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{customLabel ?? "Custom"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto max-w-[calc(100vw-2rem)] p-0 bg-surface border-border">
          <div className="flex flex-col sm:flex-row">
            {/* Presets */}
            <div className="border-b sm:border-b-0 sm:border-r border-border p-2 sm:w-40 flex sm:block overflow-x-auto gap-1 sm:gap-0">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  data-testid={`preset-${p.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => {
                    const r = getPresetRange(p);
                    setCalRange(r);
                    setOpen(false);
                    navigate(r.from!, r.to!);
                  }}
                  className="shrink-0 sm:w-full text-left text-sm px-2 py-1.5 rounded hover:bg-secondary/50 transition-colors whitespace-nowrap text-secondary hover:text-foreground"
                >
                  {p}
                </button>
              ))}
            </div>
            {/* Calendar */}
            <div className="p-2">
              <Calendar
                mode="range"
                numberOfMonths={1}
                selected={calRange}
                onSelect={(r) => {
                  if (!r) return;
                  setCalRange(r);
                  if (r.from && r.to) {
                    setOpen(false);
                    navigate(r.from, r.to);
                  }
                }}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
