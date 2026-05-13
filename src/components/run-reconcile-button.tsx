"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type RunResult = {
  autoMatched: number;
  proposed: number;
  splitwiseOnly: number;
  unmatched: number;
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
    <div className="flex items-center gap-3">
      <Button onClick={run} disabled={busy}>
        {busy ? "Running…" : "Run reconciliation"}
      </Button>
      {last && (
        <span className="text-sm text-muted-foreground">
          auto {last.autoMatched} · proposed {last.proposed} · splitwise-only{" "}
          {last.splitwiseOnly} · unmatched {last.unmatched}
        </span>
      )}
    </div>
  );
}
