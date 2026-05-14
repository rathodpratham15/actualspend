"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { ReconCard } from "@/components/recon-card";
import { SubtractionBlock } from "@/components/subtraction-block";
import {
  awaitingReview,
  matchedAuto,
  splitwiseOnly,
  personalUnmatched,
  totals,
} from "@/lib/seed";
import { usd, dateShort } from "@/lib/format";

function Section({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-8 border-t border-border pt-6">
      <button
        type="button"
        data-testid={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-baseline gap-3">
          <span className="text-[15px] font-medium">{title}</span>
          <span className="font-mono text-secondary text-sm">({count})</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-secondary transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="mt-6 space-y-3">{children}</div>}
    </div>
  );
}

export default function ReconcilePage() {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  const confirm = (id: string) => {
    setDismissed((d) => ({ ...d, [id]: true }));
    toast.success("Match confirmed.");
  };
  const reject = (id: string) => {
    setDismissed((d) => ({ ...d, [id]: true }));
    toast("Match rejected.", { description: "Moved back to personal." });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />

      <main className="max-w-3xl mx-auto px-6 pt-10 pb-24">
        <div className="flex items-center justify-between">
          <h1 className="text-xl tracking-tight font-medium">Review</h1>
          <button
            data-testid="run-recon-btn"
            onClick={() => toast.success("Reconciliation complete.")}
            className="h-9 px-3 rounded-md border border-border text-sm hover:bg-secondary transition-colors"
          >
            Run reconciliation
          </button>
        </div>

        <div className="mt-8 bg-surface border border-border rounded-xl p-6">
          <SubtractionBlock
            bank={totals.bankOutflow}
            shared={totals.sharedAdjustments}
            actual={totals.actual}
            bankLabel="Bank outflow"
            sharedLabel="Shared adjustments"
            actualLabel="Actual spend"
            decimals={0}
          />
          <div className="mt-6 text-sm text-secondary leading-relaxed">
            Most of the difference comes from shared expenses you initially paid
            for.
          </div>
        </div>

        <Section
          title="Awaiting your review"
          count={awaitingReview.length}
          defaultOpen
        >
          {awaitingReview.map((p) => (
            <ReconCard
              key={p.id}
              pair={p}
              state="awaiting"
              onConfirm={confirm}
              onReject={reject}
              dismissed={dismissed[p.id]}
            />
          ))}
        </Section>

        <Section title="Matched automatically" count={matchedAuto.length}>
          {matchedAuto.map((p) => (
            <div
              key={p.id}
              data-testid={`matched-${p.id}`}
              className="bg-surface border border-border border-l-2 border-l-[var(--emerald)] rounded-xl p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono text-secondary">
                    {dateShort(p.bank.date)}
                  </div>
                  <div className="text-[15px]">{p.bank.merchant}</div>
                  <div className="text-xs text-secondary mt-1">
                    {p.splitwise.title}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">
                    {usd(p.bank.amount, { decimals: 2 })}
                  </div>
                  <div className="font-mono text-xs text-secondary mt-1">
                    {p.confidence}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </Section>

        <Section title="Splitwise-only" count={splitwiseOnly.length}>
          {splitwiseOnly.map((s) => (
            <div
              key={s.id}
              data-testid={`splitwise-only-${s.id}`}
              className="bg-surface border border-border border-l-2 border-l-[var(--border)] rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[15px]">{s.title}</div>
                  <div className="text-xs text-secondary mt-1">{s.group}</div>
                </div>
                <div className="font-mono text-sm">
                  {usd(s.yourShare, { decimals: 2 })}
                </div>
              </div>
              <div className="mt-3">
                <button className="text-sm text-secondary hover:text-foreground">
                  Mark as paid by Chase Sapphire →
                </button>
              </div>
            </div>
          ))}
        </Section>

        <Section title="Personal / unmatched" count={personalUnmatched.length}>
          {personalUnmatched.map((p) => (
            <div
              key={p.id}
              data-testid={`personal-${p.id}`}
              className="bg-surface border border-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono text-secondary">
                    {dateShort(p.date)}
                  </div>
                  <div className="text-[15px]">{p.merchant}</div>
                  <div className="text-xs text-secondary mt-1">
                    Suggested: {p.suggested}
                  </div>
                </div>
                <div className="font-mono text-sm">
                  {usd(p.amount, { decimals: 2 })}
                </div>
              </div>
              <div className="mt-3">
                <button className="text-sm text-secondary hover:text-foreground">
                  Add to a Splitwise expense →
                </button>
              </div>
            </div>
          ))}
        </Section>
      </main>
    </div>
  );
}
