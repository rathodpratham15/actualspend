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

export default async function Home() {
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
        <h1 className="text-2xl font-semibold tracking-tight">ActualSpend</h1>
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

      <section className="mt-16">
        <p className="text-sm uppercase tracking-wider text-muted-foreground">
          Signed in as
        </p>
        <p className="mt-1 text-lg font-medium">{user.email}</p>
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Bank
        </h2>
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
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {items.map((it) => (
                <li key={it.id}>• {it.institutionName ?? "Connected bank"}</li>
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
            <div className="mt-4">
              <SyncSplitwiseButton />
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
