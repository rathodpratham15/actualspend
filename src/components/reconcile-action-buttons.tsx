"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ReconcileActionButtons({ id }: { id: string }) {
  const [busy, setBusy] = useState<"confirm" | "reject" | null>(null);
  const router = useRouter();

  const act = async (kind: "confirm" | "reject") => {
    setBusy(kind);
    try {
      const r = await fetch(`/api/reconcile/${id}/${kind}`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(await r.text());
      router.refresh();
    } catch (e) {
      console.error(`${kind} failed`, e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-2 flex gap-2">
      <Button
        size="sm"
        onClick={() => act("confirm")}
        disabled={busy !== null}
      >
        {busy === "confirm" ? "…" : "Confirm match"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => act("reject")}
        disabled={busy !== null}
      >
        {busy === "reject" ? "…" : "Reject"}
      </Button>
    </div>
  );
}
