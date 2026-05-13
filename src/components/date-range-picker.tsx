"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function parseIso(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function toIso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function DateRangePicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const selected: DateRange = {
    from: parseIso(from),
    to: parseIso(to),
  };

  const display = `${format(selected.from!, "MMM d")} – ${format(
    selected.to!,
    "MMM d, yyyy",
  )}`;

  const onSelect = (r: DateRange | undefined) => {
    if (!r?.from || !r?.to) return;
    const params = new URLSearchParams();
    params.set("from", toIso(r.from));
    params.set("to", toIso(r.to));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <Popover>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: "outline" }))}
        data-pending={pending ? "" : undefined}
      >
        {display}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="range"
          selected={selected}
          onSelect={onSelect}
          numberOfMonths={2}
          defaultMonth={selected.from}
        />
      </PopoverContent>
    </Popover>
  );
}
