"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReconCard } from "@/components/recon-card";
import type { ReconciliationPair } from "@/lib/seed";

// Thin client wrapper that owns the confirm/reject API calls. The underlying
// ReconCard renders the pair; this component just translates clicks into POSTs
// against /api/reconcile/[id]/confirm and /reject.
export function ReconAwaitingCard({ pair }: { pair: ReconciliationPair }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  const act = async (kind: "confirm" | "reject") => {
    setDismissed(true);
    try {
      const r = await fetch(`/api/reconcile/${pair.id}/${kind}`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(await r.text());
      router.refresh();
    } catch (e) {
      console.error(`${kind} failed`, e);
      setDismissed(false);
    }
  };

  return (
    <ReconCard
      pair={pair}
      state="awaiting"
      dismissed={dismissed}
      onConfirm={() => void act("confirm")}
      onReject={() => void act("reject")}
    />
  );
}
