"use client";

import { useState, useTransition } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { usePathname, useRouter } from "next/navigation";
import type { DateRange } from "react-day-picker";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const PRESETS = [
  "This month",
  "Last month",
  "Last 30 days",
  "Last 90 days",
  "Year to date",
  "Custom",
] as const;

type Preset = (typeof PRESETS)[number];

function parseIso(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function toIso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function isPresetMatch(range: DateRange | undefined, preset: Preset): boolean {
  if (!range?.from || !range?.to) return false;
  const ranges: Record<Exclude<Preset, "Custom">, () => DateRange> = {
    "This month": () => {
      const now = new Date();
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: now,
      };
    },
    "Last month": () => {
      const now = new Date();
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 0),
      };
    },
    "Last 30 days": () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 30);
      return { from, to };
    },
    "Last 90 days": () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 90);
      return { from, to };
    },
    "Year to date": () => {
      const now = new Date();
      return { from: new Date(now.getFullYear(), 0, 1), to: now };
    },
  };
  if (preset === "Custom") return false;
  const ref = ranges[preset]();
  return (
    toIso(range.from) === toIso(ref.from!) &&
    toIso(range.to) === toIso(ref.to!)
  );
}

function inferPreset(range: DateRange | undefined): Preset {
  for (const p of PRESETS) {
    if (p === "Custom") continue;
    if (isPresetMatch(range, p)) return p;
  }
  return "Custom";
}

export function DateRangePicker({
  from,
  to,
}: {
  from?: string;
  to?: string;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const initialRange: DateRange =
    from && to
      ? { from: parseIso(from), to: parseIso(to) }
      : { from: new Date(2025, 9, 1), to: new Date(2025, 9, 31) };

  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange>(initialRange);
  const [preset, setPreset] = useState<Preset>(() =>
    from && to ? inferPreset(initialRange) : "This month",
  );

  const navigate = (r: DateRange) => {
    if (!r.from || !r.to) return;
    const params = new URLSearchParams();
    params.set("from", toIso(r.from));
    params.set("to", toIso(r.to));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p === "Custom") return;
    const map: Record<Exclude<Preset, "Custom">, () => DateRange> = {
      "This month": () => {
        const now = new Date();
        return {
          from: new Date(now.getFullYear(), now.getMonth(), 1),
          to: now,
        };
      },
      "Last month": () => {
        const now = new Date();
        return {
          from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          to: new Date(now.getFullYear(), now.getMonth(), 0),
        };
      },
      "Last 30 days": () => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 30);
        return { from, to };
      },
      "Last 90 days": () => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 90);
        return { from, to };
      },
      "Year to date": () => {
        const now = new Date();
        return { from: new Date(now.getFullYear(), 0, 1), to: now };
      },
    };
    const r = map[p]();
    setRange(r);
    setOpen(false);
    navigate(r);
  };

  const label =
    preset === "Custom"
      ? `${range.from?.toLocaleDateString("en-US", { month: "short", day: "2-digit" })} – ${range.to?.toLocaleDateString("en-US", { month: "short", day: "2-digit" })}`
      : preset;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="date-range-trigger"
          data-pending={pending ? "" : undefined}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border text-sm hover:bg-secondary transition-colors"
        >
          <CalendarIcon className="h-3.5 w-3.5 text-secondary" />
          <span className="font-mono">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto p-0 bg-surface border-border"
      >
        <div className="flex">
          <div className="border-r border-border p-2 w-40">
            {PRESETS.map((p) => (
              <button
                key={p}
                data-testid={`preset-${p.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => applyPreset(p)}
                className={`w-full text-left text-sm px-2 py-1.5 rounded hover:bg-secondary transition-colors ${
                  p === preset ? "text-foreground" : "text-secondary"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="p-2">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={range}
              onSelect={(r) => {
                if (r?.from && r?.to) {
                  setRange(r);
                  setPreset("Custom");
                  navigate(r);
                } else if (r) {
                  setRange(r);
                  setPreset("Custom");
                }
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
