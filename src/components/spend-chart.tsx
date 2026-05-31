"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { MonthlyPoint } from "@/lib/dashboard/spend-timeline";

type Props = { data: MonthlyPoint[] };

// currentColor inherits the parent element's CSS `color` value, which IS
// resolved through the cascade in both light and dark mode. opacity 0.5
// gives the muted-label look without relying on a specific CSS variable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function XTick({ x, y, payload }: any) {
  return (
    <text x={x} y={y} dy={12} textAnchor="middle"
      style={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}>
      {payload.value}
    </text>
  );
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function YTick({ x, y, payload }: any) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end"
      style={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}>
      {fmt(payload.value)}
    </text>
  );
}

function fmt(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const actual: number = payload.find((p: any) => p.dataKey === "actual")?.value ?? 0;
  const bank: number = payload.find((p: any) => p.dataKey === "bank")?.value ?? 0;

  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2.5 text-xs shadow-md min-w-[160px]">
      <div className="font-medium mb-2 text-foreground">{label}</div>
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-1.5 text-secondary">
          <span className="w-2 h-2 rounded-full bg-foreground inline-block shrink-0" />
          Actual
        </div>
        <span className="font-mono text-foreground">
          ${actual.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>
      </div>
      {bank > actual + 0.5 && (
        <div className="flex items-center justify-between gap-6 mt-1.5">
          <div className="flex items-center gap-1.5 text-secondary">
            <span className="w-2 h-2 rounded-full inline-block shrink-0 bg-secondary/50" />
            Bank outflow
          </div>
          <span className="font-mono text-secondary">
            ${bank.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}
    </div>
  );
}

export function SpendChart({ data }: Props) {
  const [showBank, setShowBank] = useState(false);
  // Delay rendering until after mount — ResponsiveContainer measures its DOM
  // container and returns width/height -1 during SSR, which causes Recharts
  // to log errors and render nothing.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (data.length === 0) return null;

  const lastIdx = data.length - 1;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[11px] uppercase tracking-widest text-secondary">
          Spending over time
        </div>
        <button
          type="button"
          onClick={() => setShowBank((v) => !v)}
          className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-colors ${
            showBank
              ? "border-foreground text-foreground"
              : "border-border text-secondary hover:text-foreground"
          }`}
        >
          {showBank ? "hide bank" : "show bank"}
        </button>
      </div>

      <div className="h-52">
        {!mounted ? <div className="h-full" /> : <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barGap={3}
            barCategoryGap="35%"
            margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
          >
            <XAxis
              dataKey="month"
              tick={<XTick />}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={<YTick />}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "var(--surface)", opacity: 0.6 }}
            />

            {/* Bank outflow — subtle background bar, only when toggled */}
            {showBank && (
              <Bar
                dataKey="bank"
                radius={[3, 3, 0, 0]}
                fill="var(--foreground)"
                fillOpacity={0.12}
              />
            )}

            {/* Actual spend — always the focus bar */}
            <Bar dataKey="actual" radius={[3, 3, 0, 0]}>
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill="var(--foreground)"
                  fillOpacity={i === lastIdx ? 1 : 0.5}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>}
      </div>

      <div className="mt-1 text-[11px] text-secondary text-right font-mono">
        reconciled · last {data.length} month{data.length !== 1 ? "s" : ""}
      </div>
    </section>
  );
}
