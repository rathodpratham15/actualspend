import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import {
  splitwiseExpenseParticipants,
  splitwiseExpenses,
  splitwiseFriends,
} from "@/lib/db/schema";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

function fmtUSD(n: number): string {
  return Math.abs(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function FriendPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  const { id: idParam } = await params;
  const splitwiseUserId = parseInt(idParam, 10);
  if (!Number.isFinite(splitwiseUserId)) notFound();

  const [friend] = await db
    .select()
    .from(splitwiseFriends)
    .where(
      and(
        eq(splitwiseFriends.userId, user.id),
        eq(splitwiseFriends.splitwiseUserId, splitwiseUserId),
      ),
    );
  if (!friend) notFound();

  // Find all expenses where this friend participated.
  const friendExpenseIds = (
    await db
      .select({ expenseId: splitwiseExpenseParticipants.expenseId })
      .from(splitwiseExpenseParticipants)
      .where(eq(splitwiseExpenseParticipants.splitwiseUserId, splitwiseUserId))
  ).map((r) => r.expenseId);

  // Filter to expenses scoped to the current user (the splitwise_expense rows
  // we synced are all things this user is a party to, so the join is implicit
  // via splitwise_expense.user_id).
  const expenses =
    friendExpenseIds.length > 0
      ? await db
          .select({
            id: splitwiseExpenses.id,
            description: splitwiseExpenses.description,
            cost: splitwiseExpenses.cost,
            date: splitwiseExpenses.date,
            userShare: splitwiseExpenses.userShare,
            paidByUser: splitwiseExpenses.paidByUser,
            isPayment: splitwiseExpenses.isPayment,
          })
          .from(splitwiseExpenses)
          .where(
            and(
              eq(splitwiseExpenses.userId, user.id),
              isNull(splitwiseExpenses.deletedAt),
              inArray(splitwiseExpenses.id, friendExpenseIds),
            ),
          )
          .orderBy(desc(splitwiseExpenses.date))
      : [];

  // Pull the friend's participant row per expense so we can show their share
  // alongside ours on each row.
  const theirShares =
    expenses.length > 0
      ? await db
          .select({
            expenseId: splitwiseExpenseParticipants.expenseId,
            paidShare: splitwiseExpenseParticipants.paidShare,
            owedShare: splitwiseExpenseParticipants.owedShare,
          })
          .from(splitwiseExpenseParticipants)
          .where(
            and(
              eq(
                splitwiseExpenseParticipants.splitwiseUserId,
                splitwiseUserId,
              ),
              inArray(
                splitwiseExpenseParticipants.expenseId,
                expenses.map((e) => e.id),
              ),
            ),
          )
      : [];
  const theirShareByExpense = new Map(
    theirShares.map((s) => [s.expenseId, s]),
  );

  // Aggregates
  const realExpenses = expenses.filter((e) => !e.isPayment);
  const payments = expenses.filter((e) => e.isPayment);
  const totalSpentTogether = realExpenses.reduce(
    (s, e) => s + Number(e.cost),
    0,
  );
  const balance = Number(friend.balance);
  const fullName =
    `${friend.firstName ?? ""} ${friend.lastName ?? ""}`.trim() ||
    `Friend ${splitwiseUserId}`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <Link
            href="/accounts"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Accounts
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
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

      <section className="mt-8 flex items-center gap-4">
        {friend.pictureUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={friend.pictureUrl}
            alt={fullName}
            width={56}
            height={56}
            className="rounded-full border border-border"
          />
        )}
        <div>
          {friend.email && (
            <p className="text-sm text-muted-foreground">{friend.email}</p>
          )}
          <p className="mt-1 text-sm">
            {balance > 0 ? (
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                Owes you {fmtUSD(balance)}
              </span>
            ) : balance < 0 ? (
              <span className="font-medium text-amber-700 dark:text-amber-300">
                You owe {fmtUSD(balance)}
              </span>
            ) : (
              <span className="text-muted-foreground">Settled up</span>
            )}
          </p>
        </div>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Spent together
          </div>
          <div className="mt-1 text-xl font-semibold">
            {fmtUSD(totalSpentTogether)}
          </div>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Expenses
          </div>
          <div className="mt-1 text-xl font-semibold">
            {realExpenses.length}
          </div>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Payments
          </div>
          <div className="mt-1 text-xl font-semibold">{payments.length}</div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Recent activity
        </h2>
        {expenses.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No shared expenses yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {expenses.slice(0, 50).map((e) => {
              const theirs = theirShareByExpense.get(e.id);
              return (
                <li
                  key={e.id}
                  className="rounded-md border border-border bg-card p-3 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <span className="font-medium">
                        {e.description || "(no description)"}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {fmtDate(e.date)}
                      </span>
                      {e.isPayment && (
                        <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                          payment
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      bill {fmtUSD(Number(e.cost))} · you paid{" "}
                      {fmtUSD(Number(e.paidByUser))} / owe{" "}
                      {fmtUSD(Number(e.userShare))}
                      {theirs && (
                        <>
                          {" · "}they paid {fmtUSD(Number(theirs.paidShare))} /
                          owe {fmtUSD(Number(theirs.owedShare))}
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
