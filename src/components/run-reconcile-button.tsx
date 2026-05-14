"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type RunResult = {
  autoMatched: number;
  proposed: number;
  splitwiseOnly: number;
  unmatched: number;
  reimbursementsAuto: number;
  reimbursementsProposed: number;
  unmatchedInflows: number;
  coverageStart: string | null;
  coverageEnd: string | null;
  swSkippedOutOfWindow: number;
};

export function RunReconcileButton() {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<RunResult | null>(null);
  const router = useRouter();

  const run = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/reconcile", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as RunResult;
      setLast(data);
      router.refresh();
    } catch (e) {
      console.error("reconcile failed", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Button onClick={run} disabled={busy}>
          {busy ? "Running…" : "Run reconciliation"}
        </Button>
        {last && (
          <span className="text-sm text-muted-foreground">
            outflows: auto {last.autoMatched} · proposed {last.proposed} · sw-only{" "}
            {last.splitwiseOnly} · unmatched {last.unmatched} · inflows: reimb{" "}
            {last.reimbursementsAuto} · proposed {last.reimbursementsProposed} ·
            unmatched {last.unmatchedInflows}
          </span>
        )}
      </div>
      {last && (
        <p className="text-xs text-muted-foreground">
          Coverage: {last.coverageStart ?? "—"} → {last.coverageEnd ?? "—"} ·{" "}
          {last.swSkippedOutOfWindow} Splitwise expense
          {last.swSkippedOutOfWindow === 1 ? "" : "s"} skipped outside this
          window
        </p>
      )}
    </div>
  );
}
