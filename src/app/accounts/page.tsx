import { and, eq, isNull, sql } from "drizzle-orm";
import { formatDistanceToNow } from "date-fns";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  plaidItems,
  splitwiseCredentials,
  splitwiseExpenses,
} from "@/lib/db/schema";
import { plaidEnv } from "@/lib/plaid/client";
import { computeBankStats } from "@/lib/dashboard/counts";

import { AppHeader } from "@/components/app-header";
import { BalancesPanel } from "@/components/balances-panel";
import { ConnectBankButton } from "@/components/connect-bank-button";
import { SyncButton } from "@/components/sync-button";
import { ConnectSplitwiseButton } from "@/components/connect-splitwise-button";
import { SyncSplitwiseButton } from "@/components/sync-splitwise-button";
import { ForceResyncSplitwiseButton } from "@/components/force-resync-splitwise-button";

const ENV_LABEL: Record<string, string> = {
  sandbox: "Sandbox",
  development: "Development",
  production: "Production",
};

const ENV_STYLES: Record<string, string> = {
  sandbox: "bg-amber-soft text-amber-accent",
  development: "bg-blue-100 text-blue-700",
  production: "bg-emerald-soft text-emerald-accent",
};

function relative(d: Date | null): string {
  if (!d) return "never";
  return formatDistanceToNow(d, { addSuffix: true });
}

export default async function AccountsPage() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  const items = await db
    .select()
    .from(plaidItems)
    .where(eq(plaidItems.userId, user.id));

  const bankStats = await computeBankStats(user.id);

  const totalTxn = Array.from(bankStats.values()).reduce(
    (s, b) => s + b.txnCount,
    0,
  );

  const [swCred] = await db
    .select()
    .from(splitwiseCredentials)
    .where(eq(splitwiseCredentials.userId, user.id));

  const [{ count: swCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(splitwiseExpenses)
    .where(
      and(
        eq(splitwiseExpenses.userId, user.id),
        isNull(splitwiseExpenses.deletedAt),
      ),
    );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-24">
        <section className="mb-16">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl tracking-tight font-medium">
                Bank accounts
              </h1>
              <span
                data-testid="plaid-env-badge"
                className={`text-[11px] font-mono px-2 py-0.5 rounded ${ENV_STYLES[plaidEnv] ?? ENV_STYLES.sandbox}`}
                title={`Plaid environment: ${plaidEnv}`}
              >
                Plaid · {ENV_LABEL[plaidEnv] ?? plaidEnv}
              </span>
            </div>
            <div className="text-xs text-secondary font-mono">
              {items.length} bank{items.length === 1 ? "" : "s"} · {totalTxn}{" "}
              transaction{totalTxn === 1 ? "" : "s"}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="mt-6 bg-surface border border-border rounded-xl px-5 py-6 text-center">
              <p className="text-secondary">
                Connect a bank account to import transactions.
              </p>
              <div className="mt-4 inline-flex">
                <ConnectBankButton />
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 bg-surface border border-border rounded-xl divide-y divide-border">
                {items.map((it) => {
                  const stats = bankStats.get(it.id);
                  const needsReauth =
                    it.errorCode === "ITEM_LOGIN_REQUIRED" ||
                    !!it.errorCode;
                  return (
                    <div
                      key={it.id}
                      data-testid={`bank-row-${(it.institutionName ?? it.id).toLowerCase()}`}
                      className="px-4 sm:px-5 py-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
                    >
                      <div className="min-w-0">
                        <div className="text-[15px] font-medium truncate">
                          {it.institutionName ?? "Connected bank"}
                        </div>
                        <div className="mt-1 text-xs text-secondary font-mono">
                          {stats?.txnCount ?? 0} transaction
                          {(stats?.txnCount ?? 0) === 1 ? "" : "s"} · last sync{" "}
                          {relative(stats?.lastSyncAt ?? null)}
                        </div>
                      </div>
                      {needsReauth ? (
                        <span
                          data-testid={`reauth-${(it.institutionName ?? it.id).toLowerCase()}`}
                          className="text-sm text-amber-accent shrink-0"
                        >
                          {it.errorCode === "ITEM_LOGIN_REQUIRED"
                            ? "Re-auth required"
                            : it.errorCode}
                        </span>
                      ) : (
                        <span className="text-xs text-secondary shrink-0">
                          Healthy
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <SyncButton />
                <ConnectBankButton variant="outline" />
              </div>
            </>
          )}
        </section>

        <section>
          <h2 className="text-xl tracking-tight font-medium">Splitwise</h2>
          {!swCred ? (
            <div className="mt-6 bg-surface border border-border rounded-xl px-5 py-6 text-center">
              <p className="text-secondary">
                Link Splitwise to factor in shared costs and reimbursements.
              </p>
              <div className="mt-4 inline-flex">
                <ConnectSplitwiseButton />
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 bg-surface border border-border rounded-xl px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-medium">Connected</div>
                  <div className="mt-1 text-xs text-secondary font-mono">
                    {swCount} expense{swCount === 1 ? "" : "s"} · last sync{" "}
                    {relative(swCred.lastSyncedAt ?? null)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SyncSplitwiseButton />
                  <ForceResyncSplitwiseButton />
                </div>
              </div>
            </>
          )}
        </section>

        {swCred && (
          <section className="mt-16">
            <h2 className="text-xl tracking-tight font-medium">
              Who owes whom
            </h2>
            <BalancesPanel userId={user.id} />
          </section>
        )}
      </main>
    </div>
  );
}
