"use client";

import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
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

export function DateRangePicker() {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<Preset>("This month");
  const [range, setRange] = useState<DateRange>({
    from: new Date(2025, 9, 1),
    to: new Date(2025, 9, 31),
  });

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
                onClick={() => {
                  setPreset(p);
                  if (p !== "Custom") setOpen(false);
                }}
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
                if (r) {
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
