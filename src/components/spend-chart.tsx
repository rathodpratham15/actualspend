"use client";

// Monthly actual-spend chart. Uses Recharts BarChart.
//
// Design rules (from memory):
//   - Default axis = reconciled actual_amount, not raw bank charge.
//   - Raw bank toggle is available but OFF by default.
//   - Time-series matters more than pie charts.

import { useState } from "react";
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

type Props = {
  data: MonthlyPoint[];
};

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
    <div className="bg-background border border-border rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="font-medium mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-foreground inline-block" />
        <span className="text-secondary">Actual</span>
        <span className="font-mono ml-auto pl-4">${actual.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
      </div>
      {bank > actual + 0.5 && (
        <div className="flex items-center gap-1.5 mt-0.5 text-secondary/70">
          <span className="w-2 h-2 rounded-full bg-border inline-block" />
          <span>Bank outflow</span>
          <span className="font-mono ml-auto pl-4">${bank.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </div>
      )}
    </div>
  );
}

export function SpendChart({ data }: Props) {
  const [showBank, setShowBank] = useState(false);

  if (data.length === 0) return null;

  // Highlight the most recent complete month differently.
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
          {showBank ? "actual only" : "show bank"}
        </button>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barGap={2}
            margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
          >
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "var(--secondary)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={fmt}
              tick={{ fontSize: 11, fill: "var(--secondary)" }}
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--surface)" }} />

            {/* Bank outflow — shown as a fainter background bar when toggled */}
            {showBank && (
              <Bar dataKey="bank" fill="var(--border)" radius={[2, 2, 0, 0]} />
            )}

            {/* Actual spend — always shown, always the focus */}
            <Bar dataKey="actual" radius={[2, 2, 0, 0]}>
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={
                    i === lastIdx
                      ? "var(--foreground)"
                      : "color-mix(in srgb, var(--foreground) 45%, transparent)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-[11px] text-secondary text-right font-mono">
        reconciled · last {data.length} months
      </div>
    </section>
  );
}
