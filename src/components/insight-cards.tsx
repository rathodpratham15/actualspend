import { RefreshCw, TrendingUp, Repeat } from "lucide-react";
import type { Insight, InsightKind } from "@/lib/dashboard/insights";

const KIND_META: Record<
  InsightKind,
  { icon: React.ElementType; color: string; bg: string }
> = {
  subscription: {
    icon: Repeat,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  anomaly: {
    icon: TrendingUp,
    color: "text-amber-accent",
    bg: "bg-amber-500/10",
  },
  pattern: {
    icon: RefreshCw,
    color: "text-emerald-accent",
    bg: "bg-emerald-500/10",
  },
};

function InsightCard({ insight }: { insight: Insight }) {
  const meta = KIND_META[insight.kind];
  const Icon = meta.icon;

  return (
    <div className="surface-card p-4 flex flex-col gap-2 min-w-[220px] max-w-[260px] shrink-0">
      <div className={`inline-flex items-center justify-center h-7 w-7 rounded-md ${meta.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${meta.color}`} strokeWidth={1.75} />
      </div>
      <div className="text-sm font-medium leading-snug">{insight.title}</div>
      <div className="text-xs text-secondary leading-relaxed">{insight.detail}</div>
    </div>
  );
}

export function InsightCards({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="text-xs uppercase tracking-widest text-secondary mb-3">
        Insights
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {insights.map((ins, i) => (
          <div key={i} className="snap-start">
            <InsightCard insight={ins} />
          </div>
        ))}
      </div>
    </section>
  );
}
