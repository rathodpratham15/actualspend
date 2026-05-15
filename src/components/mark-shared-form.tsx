"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Inline "my share was $X" form for bank txns that are shared in real life
// but not tracked on Splitwise (rent is the canonical case). Submitting
// flips the row to MANUAL_MATCH and updates the actualAmount the engine
// rolls up. State is preserved across reconciliation rebuilds.
export function MarkSharedForm({
  reconId,
  defaultAmount,
  bankAmount,
}: {
  reconId: string;
  defaultAmount: number;
  bankAmount: number;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(defaultAmount.toFixed(2)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const submit = async () => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setErr("Enter a valid amount");
      return;
    }
    if (parsed > bankAmount + 0.005) {
      setErr(`Can't be more than the bank charge ($${bankAmount.toFixed(2)})`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/reconcile/${reconId}/set-share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualAmount: parsed }),
      });
      if (!r.ok) throw new Error(await r.text());
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-secondary hover:text-foreground"
      >
        Mark as shared
      </Button>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-baseline gap-2 text-sm">
      <span className="text-secondary shrink-0">My share:</span>
      <div className="flex items-baseline gap-1 shrink-0">
        <span className="text-secondary">$</span>
        <input
          type="number"
          step="0.01"
          min="0"
          max={bankAmount}
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          className="w-24 rounded border border-border bg-background px-2 py-0.5 text-sm font-mono"
        />
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setErr(null);
          }}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
      {err && (
        <span className="basis-full text-xs text-amber-accent">{err}</span>
      )}
    </div>
  );
}
