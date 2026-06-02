"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from "recharts";
import type { MonthlyPoint } from "@/lib/dashboard/spend-timeline";

type Props = { data: MonthlyPoint[] };

function fmt(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function XTick({ x, y, payload }: any) {
  return (
    <text x={x} y={y} dy={12} textAnchor="middle" style={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}>
      {payload.value}
    </text>
  );
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function YTick({ x, y, payload }: any) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" style={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}>
      {fmt(payload.value)}
    </text>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const bank: number = payload.find((p: any) => p.dataKey === "bank")?.value ?? 0;
  const actual: number = payload.find((p: any) => p.dataKey === "actual")?.value ?? 0;

  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2.5 text-xs shadow-md min-w-[160px]">
      <div className="font-medium mb-2 text-foreground">{label}</div>
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-1.5 text-secondary">
          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: "var(--muted-foreground)", opacity: 0.6 }} />
          Bank
        </div>
        <span className="font-mono text-secondary">${bank.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
      </div>
      <div className="flex items-center justify-between gap-6 mt-1.5">
        <div className="flex items-center gap-1.5 text-secondary">
          <span className="w-2 h-2 rounded-full inline-block shrink-0 bg-emerald-accent" />
          Actual
        </div>
        <span className="font-mono text-emerald-accent">${actual.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
      </div>
    </div>
  );
}

export function SpendChart({ data }: Props) {
  if (data.length === 0) return null;
  const lastIdx = data.length - 1;

  return (
    <section className="mt-4 surface-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-medium">Bank vs Actual</div>
          <div className="text-xs text-secondary">Monthly comparison</div>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-secondary">
          <div className="flex items-center gap-1.5">
            <span className="dot" style={{ background: "var(--muted-foreground)", opacity: 0.6 }} /> Bank
          </div>
          <div className="flex items-center gap-1.5">
            <span className="dot bg-emerald-accent" /> Actual
          </div>
        </div>
      </div>

      <div className="h-[260px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={3} barCategoryGap="30%"
            margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={<XTick />} axisLine={false} tickLine={false} />
            <YAxis tick={<YTick />} axisLine={false} tickLine={false} width={44} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--surface)", opacity: 0.6 }} />
            {/* Bank — grey background bar */}
            <Bar dataKey="bank" radius={[4, 4, 0, 0]} maxBarSize={24}
              fill="var(--muted-foreground)" fillOpacity={0.35} />
            {/* Actual — teal foreground bar */}
            <Bar dataKey="actual" radius={[4, 4, 0, 0]} maxBarSize={24}>
              {data.map((_, i) => (
                <Cell key={i} fill="var(--emerald)" fillOpacity={i === lastIdx ? 1 : 0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 text-[11px] text-secondary text-right font-mono">
        reconciled · last {data.length} month{data.length !== 1 ? "s" : ""}
      </div>
    </section>
  );
}
