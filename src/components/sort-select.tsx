"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Option = { value: string; label: string };

export function SortSelect({
  param = "sort",
  options,
  current,
}: {
  param?: string;
  options: Option[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const onChange = (value: string) => {
    const p = new URLSearchParams(params.toString());
    p.set(param, value);
    p.delete("page"); // reset pagination on sort change
    router.push(`${pathname}?${p.toString()}`);
  };

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 px-3 pr-8 rounded-md border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30 cursor-pointer appearance-none"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
