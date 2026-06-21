"use client";

import { useState, useTransition } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

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

  const label = `${parseIso(from).toLocaleDateString("en-US", { month: "short", day: "2-digit" })} – ${parseIso(to).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}`;

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="date-range-trigger"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-surface text-sm font-mono hover:bg-secondary transition-colors"
          >
            <CalendarIcon className="h-3.5 w-3.5 text-secondary shrink-0" />
            <span className="hidden sm:inline">{label}</span>
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
