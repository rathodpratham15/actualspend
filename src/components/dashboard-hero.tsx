"use client";

import { useEffect, useState } from "react";
import { usd } from "@/lib/format";

export type HeroMetrics = {
  actualSpend: number;
  bankSpent: number;
  sharedExpensesFronted: number;
  reimbursementsPending: number;
  reimbursementsReceived: number;
  reimbursementsGrossOwed: number;
};

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

export function DashboardHero({ metrics, periodLabel }: { metrics: HeroMetrics; periodLabel: string }) {
  const liveActual = useCountUp(metrics.actualSpend);
  const liveBank = useCountUp(metrics.bankSpent);
  const liveFronted = useCountUp(metrics.sharedExpensesFronted);
  const livePending = useCountUp(metrics.reimbursementsPending);
  const passthrough = metrics.bankSpent - metrics.actualSpend;

  return (
    <section data-testid="dashboard-hero">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="surface-card p-5 border-l-[3px] border-l-emerald-accent col-span-2 lg:col-span-1" data-testid="metric-actual">
          <div className="text-[11px] uppercase tracking-widest text-secondary">Actual Spend</div>
          <div className="font-mono text-[28px] sm:text-[34px] text-emerald-accent mt-1.5 leading-none">
            ${liveActual.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-secondary mt-2">{periodLabel}</div>
        </div>
        <div className="surface-card p-5" data-testid="metric-bank">
          <div className="text-[11px] uppercase tracking-widest text-secondary">Bank Outflow</div>
          <div className="font-mono text-[28px] sm:text-[34px] text-secondary mt-1.5 leading-none">
            ${liveBank.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-secondary mt-2">Before splits</div>
        </div>
        <div className="surface-card p-5" data-testid="metric-fronted">
          <div className="text-[11px] uppercase tracking-widest text-secondary">You Fronted</div>
          <div className="font-mono text-[28px] sm:text-[34px] text-amber-accent mt-1.5 leading-none">
            ${liveFronted.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-secondary mt-2">On behalf of others</div>
        </div>
        <div className="surface-card p-5" data-testid="metric-pending">
          <div className="text-[11px] uppercase tracking-widest text-secondary">Pending</div>
          <div className="font-mono text-[28px] sm:text-[34px] text-foreground mt-1.5 leading-none">
            ${livePending.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </div>
          <div className="mt-2"><span className="pill pill-teal">You&apos;re owed</span></div>
        </div>
      </div>
      {metrics.bankSpent > 0 && (
        <div className="mt-3 surface-card px-5 py-3.5 text-sm text-secondary leading-relaxed">
          Your bank shows{" "}
          <span className="num-strike font-mono text-foreground">{usd(metrics.bankSpent, { decimals: 2 })}</span>{" "}
          of outflow.{" "}
          {passthrough > 0 ? <>About <span className="font-mono text-foreground">{usd(passthrough, { decimals: 2 })}</span> of that is really other people&apos;s money flowing through your account.</> :
           passthrough < 0 ? <>You also have <span className="font-mono text-foreground">{usd(-passthrough, { decimals: 2 })}</span> of shared expenses Splitwise sees that didn&apos;t hit this bank.</> :
           <>Nothing pass-through detected.</>}
        </div>
      )}
    </section>
  );
}
