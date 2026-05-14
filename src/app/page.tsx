"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { DateRangePicker } from "@/components/date-range-picker";
import {
  categories,
  reconCounts,
  monthLabel,
  userEmail,
  totals,
} from "@/lib/seed";
import { usd } from "@/lib/format";

function useCountUp(target: number, duration = 1100) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export default function DashboardPage() {
  const max = categories[0].amount;
  const live = useCountUp(totals.actual);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />

      <div className="border-b border-border bg-amber-soft/40">
        <div className="max-w-5xl mx-auto px-6 py-2.5 flex items-center justify-between text-sm">
          <span className="text-foreground">
            Your <span className="font-medium">Capital One</span> connection
            needs to be refreshed.
          </span>
          <Link
            href="/accounts"
            data-testid="reauth-link"
            className="text-amber-accent hover:underline underline-offset-4"
          >
            Reconnect →
          </Link>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        <div className="flex items-center justify-between mb-8">
          <div
            className="text-sm text-secondary font-mono"
            data-testid="user-email"
          >
            {userEmail}
          </div>
          <DateRangePicker />
        </div>

        <section
          data-testid="dashboard-hero"
          className="bg-surface border border-border rounded-xl p-8 sm:p-10"
        >
          <div className="text-[11px] uppercase tracking-widest text-secondary">
            Actual personal spend · {monthLabel}
          </div>

          <div className="mt-5 font-mono text-emerald-accent tracking-tight text-6xl sm:text-7xl">
            $
            {live.toLocaleString("en-US", {
              maximumFractionDigits: 2,
              minimumFractionDigits: 2,
            })}
          </div>

          <p className="mt-6 text-secondary max-w-xl leading-relaxed">
            Your bank shows{" "}
            <span className="num-strike font-mono">$4,217.50</span> of outflow.
            About{" "}
            <span className="font-mono text-foreground">$1,327.07</span> of that
            is really other people&apos;s money flowing through your account.
          </p>

          <div className="mt-10 pt-8 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-8">
            <Metric
              label="Bank outflow"
              value={usd(totals.bankOutflow, { decimals: 0 })}
            />
            <Metric
              label="Shared expenses you fronted"
              value={`−${usd(totals.sharedFronted, { decimals: 0 }).replace("−", "")}`}
            />
            <Metric
              label="Reimbursements pending"
              value={`+${usd(totals.reimbursementsPending, { decimals: 0 }).replace("−", "")}`}
              sub="Owed to you · heuristic"
            />
          </div>
        </section>

        <Link
          href="/reconcile"
          data-testid="recon-strip"
          className="mt-4 block bg-surface border border-border rounded-xl px-5 py-3 text-sm hover:bg-secondary/40 transition-colors"
        >
          <span className="font-mono">{reconCounts.matched}</span> matched ·{" "}
          <span className="font-mono text-amber-accent">
            {reconCounts.awaiting}
          </span>{" "}
          awaiting your review ·{" "}
          <span className="font-mono">{reconCounts.splitwiseOnly}</span>{" "}
          Splitwise-only ·{" "}
          <span className="font-mono">{reconCounts.personal}</span> personal
        </Link>

        <section className="mt-10">
          <div className="text-[11px] uppercase tracking-widest text-secondary mb-6">
            Where it went
          </div>
          <div className="space-y-4">
            {categories.map((c) => (
              <div
                key={c.name}
                data-testid={`cat-${c.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="flex items-baseline justify-between text-[15px]">
                  <span>{c.name}</span>
                  <span className="font-mono">${c.amount}</span>
                </div>
                <div className="mt-2 h-px bg-border w-full relative">
                  <div
                    className="absolute left-0 top-0 h-px bg-foreground transition-all"
                    style={{ width: `${(c.amount / max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-secondary">
        {label}
      </div>
      <div className="mt-2 font-mono text-2xl">{value}</div>
      {sub && <div className="mt-1 text-xs text-secondary">{sub}</div>}
    </div>
  );
}
