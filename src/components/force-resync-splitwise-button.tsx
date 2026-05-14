"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Triggers a Splitwise sync that ignores the last_synced_at watermark and
// re-pulls every expense. Used when a schema change needs a full backfill
// (e.g. participant rows).
export function ForceResyncSplitwiseButton() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const handle = async () => {
    if (!confirm("Re-pull ALL Splitwise expenses? This can take a minute.")) {
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/splitwise/sync?force=1", {
        method: "POST",
      });
      if (!r.ok) throw new Error(await r.text());
      router.refresh();
    } catch (e) {
      console.error("force resync failed", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handle} disabled={busy}>
      {busy ? "Re-syncing all…" : "Re-sync all"}
    </Button>
  );
}
