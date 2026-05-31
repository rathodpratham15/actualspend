"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Props = { yearMonth: string }; // "2026-05"

export function MonthPicker({ yearMonth }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function navigate(delta: number) {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const p = new URLSearchParams(params.toString());
    p.set("m", next);
    router.push(`${pathname}?${p.toString()}`);
  }

  const [y, m] = yearMonth.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Don't allow navigating into the future.
  const now = new Date();
  const isFuture =
    y > now.getFullYear() ||
    (y === now.getFullYear() && m >= now.getMonth() + 1);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="h-7 w-7 flex items-center justify-center rounded text-secondary hover:text-foreground hover:bg-surface transition-colors"
        aria-label="Previous month"
      >
        ‹
      </button>
      <span className="text-sm font-mono w-36 text-center">{label}</span>
      <button
        type="button"
        onClick={() => navigate(1)}
        disabled={isFuture}
        className="h-7 w-7 flex items-center justify-center rounded text-secondary hover:text-foreground hover:bg-surface transition-colors disabled:opacity-30"
        aria-label="Next month"
      >
        ›
      </button>
    </div>
  );
}
