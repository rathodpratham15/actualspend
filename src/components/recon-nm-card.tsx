"use client";

// Renders a pending N:M reconciliation cluster — either:
//   1:N  one bank txn that paid for multiple Splitwise entries, or
//   N:1  multiple bank txns from the same merchant that map to one SW entry.
//
// Confirm / reject cascade to all rows in the group via the existing
// /api/reconcile/[id]/confirm and /reject endpoints (which now handle
// nm_group_id cascading server-side).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usd, dateShort } from "@/lib/format";
import type { LinkedExpense } from "@/lib/db/schema";
import type { MatchReason } from "@/lib/db/schema";

// One bank-txn slot in the card.
export type NmBankTxn = {
  name: string;
  amount: number; // raw Plaid positive = outflow
  date: string;
  account: string;
};

// One SW-expense slot in the card.
export type NmSwExpense = {
  description: string | null;
  userShare: number;
  cost: number;
};

export type ReconNmCardProps = {
  /** Representative reconciliation row ID — used for the API call. */
  representativeId: string;
  shape: "1:N" | "N:1";
  bankTxns: NmBankTxn[];
  swExpenses: NmSwExpense[];
  totalActualAmount: number;
  confidence: number; // 0-100
  reasons: string[];
};

export function ReconNmCard({
  representativeId,
  shape,
  bankTxns,
  swExpenses,
  totalActualAmount,
  confidence,
  reasons,
}: ReconNmCardProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState<"confirm" | "reject" | null>(null);

  const act = async (kind: "confirm" | "reject") => {
    setBusy(kind);
    setDismissed(true);
    try {
      const r = await fetch(`/api/reconcile/${representativeId}/${kind}`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(await r.text());
      router.refresh();
    } catch (e) {
      console.error(`${kind} failed`, e);
      setBusy(null);
      setDismissed(false);
    }
  };

  if (dismissed) return null;

  const shapeLabel = shape === "1:N" ? "1 charge → multiple entries" : "Multiple charges → 1 entry";

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header strip */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-secondary">
            Cluster match
          </span>
          <span className="text-[10px] text-secondary">·</span>
          <span className="text-[10px] font-mono text-secondary">{shapeLabel}</span>
        </div>
        <span className="text-[10px] font-mono text-secondary">{confidence}%</span>
      </div>

      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Bank side */}
        <div>
          <div className="text-[10px] uppercase tracking-widest text-secondary mb-2">
            Bank {bankTxns.length > 1 ? `(${bankTxns.length} charges)` : ""}
          </div>
          <div className="space-y-2">
            {bankTxns.map((t, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-mono text-secondary">
                    {t.date ? dateShort(t.date) : "—"} · {t.account}
                  </div>
                  <div className="text-sm">{t.name}</div>
                </div>
                <div className="font-mono text-sm shrink-0">
                  {usd(-t.amount, { decimals: 2 })}
                </div>
              </div>
            ))}
            {bankTxns.length > 1 && (
              <div className="pt-1 border-t border-border/60 flex justify-between text-xs font-mono text-secondary">
                <span>Total</span>
                <span>
                  {usd(
                    -bankTxns.reduce((s, t) => s + t.amount, 0),
                    { decimals: 2 },
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Splitwise side */}
        <div>
          <div className="text-[10px] uppercase tracking-widest text-secondary mb-2">
            Splitwise {swExpenses.length > 1 ? `(${swExpenses.length} entries)` : ""}
          </div>
          <div className="space-y-2">
            {swExpenses.map((e, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <div className="text-sm">{e.description ?? "(no description)"}</div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm">
                    {usd(e.userShare, { decimals: 2 })}
                  </div>
                  <div className="text-[10px] text-secondary font-mono">
                    of {usd(e.cost, { decimals: 2 })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Your actual share */}
      <div className="px-4 py-2 border-t border-border/60 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-secondary">
            Your actual share
          </div>
          <div className="font-mono text-base mt-0.5">
            {usd(totalActualAmount, { decimals: 2 })}
          </div>
        </div>

        {/* Match reasons */}
        {reasons.length > 0 && (
          <div className="hidden sm:block text-right">
            {reasons.slice(0, 2).map((r, i) => (
              <div key={i} className="text-[11px] text-secondary">
                {r}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-border/60 flex gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void act("confirm")}
          className="h-8 px-3 rounded-md bg-foreground text-background text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {busy === "confirm" ? "…" : "Confirm cluster"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void act("reject")}
          className="h-8 px-3 rounded-md border border-border text-xs hover:bg-secondary/10 transition-colors disabled:opacity-50"
        >
          {busy === "reject" ? "…" : "Reject"}
        </button>
      </div>
    </div>
  );
}
