import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import {
  plaidItems,
  splitwiseCredentials,
  splitwiseExpenses,
  transactions,
} from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { ConnectBankButton } from "@/components/connect-bank-button";
import { SyncButton } from "@/components/sync-button";
import { ConnectSplitwiseButton } from "@/components/connect-splitwise-button";
import { SyncSplitwiseButton } from "@/components/sync-splitwise-button";
import { ForceResyncSplitwiseButton } from "@/components/force-resync-splitwise-button";
import { BalancesPanel } from "@/components/balances-panel";
import { plaidEnv } from "@/lib/plaid/client";
import { cn } from "@/lib/utils";

const PLAID_ENV_STYLES: Record<string, string> = {
  sandbox: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  development:
    "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  production:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
};

export default async function AccountsPage() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  const items = await db
    .select()
    .from(plaidItems)
    .where(eq(plaidItems.userId, user.id));

  const [{ count: txnCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(eq(transactions.userId, user.id), isNull(transactions.deletedAt)),
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
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>

      <p className="mt-2 text-sm text-muted-foreground">
        Signed in as {user.email}
      </p>

      <section className="mt-12">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Bank
          </h2>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
              PLAID_ENV_STYLES[plaidEnv] ?? PLAID_ENV_STYLES.sandbox,
            )}
            title={`Plaid environment: ${plaidEnv}`}
          >
            {plaidEnv}
          </span>
        </div>
        {items.length === 0 ? (
          <div className="mt-3">
            <p className="text-muted-foreground">
              Connect a bank account to import transactions.
            </p>
            <div className="mt-4">
              <ConnectBankButton />
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-muted-foreground">
              {items.length} bank{items.length > 1 ? "s" : ""} connected ·{" "}
              {txnCount} transaction{txnCount === 1 ? "" : "s"} synced
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {items.map((it) => (
                <li key={it.id} className="text-muted-foreground">
                  <span>• {it.institutionName ?? "Connected bank"}</span>
                  {it.errorCode && (
                    <span className="ml-2 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                      {it.errorCode === "ITEM_LOGIN_REQUIRED"
                        ? "Re-auth required"
                        : it.errorCode}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-3">
              <SyncButton />
              <ConnectBankButton variant="outline" />
            </div>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Splitwise
        </h2>
        {!swCred ? (
          <div className="mt-3">
            <p className="text-muted-foreground">
              Link Splitwise to factor in shared costs and reimbursements.
            </p>
            <div className="mt-4">
              <ConnectSplitwiseButton />
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-muted-foreground">
              Connected · {swCount} expense{swCount === 1 ? "" : "s"} synced
              {swCred.lastSyncedAt
                ? ` · last sync ${swCred.lastSyncedAt.toLocaleString()}`
                : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <SyncSplitwiseButton />
              <ForceResyncSplitwiseButton />
            </div>
          </div>
        )}
      </section>

      {swCred && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Who owes whom
          </h2>
          <BalancesPanel userId={user.id} />
        </section>
      )}

      <section className="mt-12 border-t border-border pt-6">
        <Link
          href="/reconcile"
          className="text-sm underline text-muted-foreground hover:text-foreground"
        >
          View reconciliation debug →
        </Link>
      </section>
    </main>
  );
}
