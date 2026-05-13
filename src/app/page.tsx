import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { plaidItems, transactions } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { ConnectBankButton } from "@/components/connect-bank-button";
import { SyncButton } from "@/components/sync-button";

export default async function Home() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  const items = await db
    .select()
    .from(plaidItems)
    .where(eq(plaidItems.userId, user.id));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(eq(transactions.userId, user.id), isNull(transactions.deletedAt)),
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
        {items.length === 0 ? (
          <div>
            <p className="text-muted-foreground">
              Start by connecting a bank account.
            </p>
            <div className="mt-4">
              <ConnectBankButton />
            </div>
          </div>
        ) : (
          <div>
            <p className="text-muted-foreground">
              {items.length} bank{items.length > 1 ? "s" : ""} connected ·{" "}
              {count} transaction{count === 1 ? "" : "s"} synced
            </p>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {items.map((it) => (
                <li key={it.id}>• {it.institutionName ?? "Connected bank"}</li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <SyncButton />
              <ConnectBankButton variant="outline" />
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
