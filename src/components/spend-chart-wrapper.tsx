"use client";

// dynamic(ssr:false) must live in a Client Component. This thin wrapper
// owns the dynamic import so page.tsx (a Server Component) can use it.

import dynamic from "next/dynamic";
import type { MonthlyPoint } from "@/lib/dashboard/spend-timeline";

const SpendChart = dynamic(
  () => import("./spend-chart").then((m) => ({ default: m.SpendChart })),
  { ssr: false },
);

export function SpendChartWrapper({ data }: { data: MonthlyPoint[] }) {
  return <SpendChart data={data} />;
}
