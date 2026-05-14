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

export function DashboardHero({
  metrics,
  periodLabel,
}: {
  metrics: HeroMetrics;
  periodLabel: string;
}) {
  const live = useCountUp(metrics.actualSpend);
  const passthrough = metrics.bankSpent - metrics.actualSpend;

  return (
    <section
      data-testid="dashboard-hero"
      className="bg-surface border border-border rounded-xl p-8 sm:p-10"
    >
      <div className="text-[11px] uppercase tracking-widest text-secondary">
        Actual personal spend · {periodLabel}
      </div>

      <div className="mt-5 font-mono text-emerald-accent tracking-tight text-6xl sm:text-7xl">
        $
        {live.toLocaleString("en-US", {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        })}
      </div>

      {metrics.bankSpent > 0 && (
        <p className="mt-6 text-secondary max-w-xl leading-relaxed">
          Your bank shows{" "}
          <span className="num-strike font-mono">
            {usd(metrics.bankSpent, { decimals: 2 })}
          </span>{" "}
          of outflow.{" "}
          {passthrough > 0 ? (
            <>
              About{" "}
              <span className="font-mono text-foreground">
                {usd(passthrough, { decimals: 2 })}
              </span>{" "}
              of that is really other people&apos;s money flowing through your
              account.
            </>
          ) : passthrough < 0 ? (
            <>
              You also have{" "}
              <span className="font-mono text-foreground">
                {usd(-passthrough, { decimals: 2 })}
              </span>{" "}
              of shared expenses Splitwise sees that didn&apos;t hit this bank.
            </>
          ) : (
            <>Nothing pass-through detected.</>
          )}
        </p>
      )}

      <div className="mt-10 pt-8 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-8">
        <Metric
          label="Bank outflow"
          value={usd(metrics.bankSpent, { decimals: 0 })}
        />
        <Metric
          label="Shared expenses you fronted"
          value={`−${usd(metrics.sharedExpensesFronted, { decimals: 0 }).replace("−", "")}`}
        />
        <Metric
          label="Reimbursements pending"
          value={`+${usd(metrics.reimbursementsPending, { decimals: 0 }).replace("−", "")}`}
          sub={
            metrics.reimbursementsReceived > 0
              ? `${usd(metrics.reimbursementsGrossOwed, { decimals: 0 })} owed − ${usd(metrics.reimbursementsReceived, { decimals: 0 })} received`
              : `${usd(metrics.reimbursementsGrossOwed, { decimals: 0 })} owed · none received yet`
          }
        />
      </div>
    </section>
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
