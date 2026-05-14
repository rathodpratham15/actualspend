"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { banks, plaidEnv, splitwiseStatus } from "@/lib/seed";

const envColors: Record<string, string> = {
  Sandbox: "bg-amber-soft text-amber-accent",
  Development: "bg-blue-100 text-blue-700",
  Production: "bg-emerald-soft text-emerald-accent",
};

export default function AccountsPage() {
  const [syncing, setSyncing] = useState(false);

  const sync = (label: string) => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      toast.success(`${label} synced.`);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />

      <main className="max-w-3xl mx-auto px-6 pt-10 pb-24">
        <section className="mb-16">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl tracking-tight font-medium">
                Bank accounts
              </h1>
              <span
                data-testid="plaid-env-badge"
                className={`text-[11px] font-mono px-2 py-0.5 rounded ${envColors[plaidEnv]}`}
              >
                Plaid · {plaidEnv}
              </span>
            </div>
            <div className="text-xs text-secondary font-mono">
              {banks.reduce((a, b) => a + b.accountCount, 0)} accounts · 247
              transactions
            </div>
          </div>

          <div className="mt-6 bg-surface border border-border rounded-xl divide-y divide-border">
            {banks.map((b) => (
              <div
                key={b.name}
                data-testid={`bank-row-${b.name.toLowerCase()}`}
                className="px-5 py-4 flex items-center justify-between"
              >
                <div>
                  <div className="text-[15px] font-medium">{b.name}</div>
                  <div className="mt-1 text-xs text-secondary font-mono">
                    {b.accountCount} account{b.accountCount > 1 ? "s" : ""} ·
                    last sync {b.lastSync}
                  </div>
                </div>
                {b.needsReauth ? (
                  <button
                    data-testid={`reauth-${b.name.toLowerCase()}`}
                    className="text-sm text-amber-accent hover:underline underline-offset-4"
                  >
                    Re-auth required
                  </button>
                ) : (
                  <span className="text-xs text-secondary">Healthy</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              data-testid="sync-banks-btn"
              disabled={syncing}
              onClick={() => sync("Banks")}
              className="h-9 px-3 rounded-md border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-60"
            >
              {syncing ? "Syncing…" : "Sync"}
            </button>
            <button
              data-testid="add-bank-btn"
              onClick={() => toast.message("Plaid Link would open here.")}
              className="h-9 px-4 rounded-md bg-foreground text-background text-sm hover:opacity-90 transition-opacity"
            >
              Add another bank
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-xl tracking-tight font-medium">Splitwise</h2>
          <div className="mt-6 bg-surface border border-border rounded-xl px-5 py-4 flex items-center justify-between">
            <div>
              <div className="text-[15px] font-medium">
                {splitwiseStatus.connected ? "Connected" : "Not connected"}
              </div>
              <div className="mt-1 text-xs text-secondary font-mono">
                {splitwiseStatus.syncedExpenses} expenses · last sync{" "}
                {splitwiseStatus.lastSync}
              </div>
            </div>
            <button
              data-testid="sync-splitwise-btn"
              onClick={() => sync("Splitwise")}
              className="h-9 px-3 rounded-md border border-border text-sm hover:bg-secondary transition-colors"
            >
              Sync
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
