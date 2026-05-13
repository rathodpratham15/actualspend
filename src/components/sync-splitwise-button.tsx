"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SyncSplitwiseButton() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/splitwise/sync", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      router.refresh();
    } catch (e) {
      console.error("splitwise sync failed", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleSync} disabled={busy}>
      {busy ? "Syncing…" : "Sync Splitwise"}
    </Button>
  );
}
