import { and, eq, isNull, sql } from "drizzle-orm";
import { formatDistanceToNow } from "date-fns";
import { Building2, PiggyBank, CreditCard, RefreshCw, Plus } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { plaidItems, splitwiseCredentials, splitwiseExpenses } from "@/lib/db/schema";
import { plaidEnv } from "@/lib/plaid/client";
import { computeBankStats } from "@/lib/dashboard/counts";

import { AppHeader } from "@/components/app-header";
import { BalancesPanel } from "@/components/balances-panel";
import { ConnectBankButton } from "@/components/connect-bank-button";
import { SyncButton } from "@/components/sync-button";
import { ConnectSplitwiseButton } from "@/components/connect-splitwise-button";
import { SyncSplitwiseButton } from "@/components/sync-splitwise-button";
import { ForceResyncSplitwiseButton } from "@/components/force-resync-splitwise-button";

const ENV_STYLES: Record<string, string> = {
  sandbox: "bg-amber-soft text-amber-accent",
  development: "bg-blue-100 text-blue-700",
  production: "bg-emerald-soft text-emerald-accent",
};

function relative(d: Date | null): string {
  if (!d) return "never";
  return formatDistanceToNow(d, { addSuffix: true });
}

function StatusDot({ hasError }: { hasError: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-secondary`}>
      <span className={`dot ${hasError ? "bg-destructive" : "bg-success"}`} />
      {hasError ? "Needs re-auth" : "Synced"}
    </span>
  );
}

export default async function AccountsPage() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  const items = await db.select().from(plaidItems).where(eq(plaidItems.userId, user.id));
  const bankStats = await computeBankStats(user.id);
  const totalTxn = Array.from(bankStats.values()).reduce((s, b) => s + b.txnCount, 0);

  const [swCred] = await db.select().from(splitwiseCredentials).where(eq(splitwiseCredentials.userId, user.id));
  const [{ count: swCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(splitwiseExpenses)
    .where(and(eq(splitwiseExpenses.userId, user.id), isNull(splitwiseExpenses.deletedAt)));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-24">
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-widest text-secondary">Accounts</div>
          <h1 className="text-[22px] font-medium tracking-tight mt-1">Connections</h1>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Bank panel */}
          <div className="surface-card p-5" data-testid="bank-panel">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-medium">Bank accounts</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="text-xs text-secondary">Connected via Plaid</div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${ENV_STYLES[plaidEnv] ?? ENV_STYLES.sandbox}`}>
                    {plaidEnv}
                  </span>
                </div>
              </div>
              <ConnectBankButton variant="outline" />
            </div>

            {items.length === 0 ? (
              <div className="py-8 text-center text-sm text-secondary">
                <p>Connect a bank account to import transactions.</p>
                <div className="mt-4 inline-flex"><ConnectBankButton /></div>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {items.map((it) => {
                    const stats = bankStats.get(it.id);
                    const hasError = !!it.errorCode;
                    return (
                      <div key={it.id} data-testid={`bank-row-${(it.institutionName ?? it.id).toLowerCase()}`}
                        className="py-4 flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-muted text-foreground shrink-0">
                          <Building2 className="h-4 w-4" strokeWidth={1.5} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{it.institutionName ?? "Connected bank"}</div>
                          <div className="text-xs text-secondary font-mono mt-0.5">
                            {stats?.txnCount ?? 0} txns · {relative(stats?.lastSyncAt ?? null)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <StatusDot hasError={hasError} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-border flex gap-2">
                  <SyncButton />
                </div>
              </>
            )}
          </div>

          {/* Splitwise panel */}
          <div className="surface-card p-5" data-testid="splitwise-panel">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-medium">Splitwise</div>
                <div className="text-xs text-secondary mt-0.5">OAuth — read only</div>
              </div>
            </div>

            {!swCred ? (
              <div className="py-8 text-center text-sm text-secondary">
                <p>Link Splitwise to factor in shared costs and reimbursements.</p>
                <div className="mt-4 inline-flex"><ConnectSplitwiseButton /></div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 rounded-md bg-emerald-soft">
                  <div className="h-10 w-10 rounded-full bg-emerald-accent/20 text-emerald-accent flex items-center justify-center text-sm font-medium shrink-0">
                    SW
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">Connected</div>
                    <div className="text-xs text-secondary mt-0.5 font-mono">
                      {swCount} expense{swCount === 1 ? "" : "s"} · {relative(swCred.lastSyncedAt ?? null)}
                    </div>
                  </div>
                  <SyncSplitwiseButton />
                </div>

                <div className="mt-4 flex gap-2">
                  <ForceResyncSplitwiseButton />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Who owes whom */}
        {swCred && (
          <div className="mt-6">
            <div className="text-sm font-medium mb-3">Who owes whom</div>
            <BalancesPanel userId={user.id} />
          </div>
        )}
      </main>
    </div>
  );
}
