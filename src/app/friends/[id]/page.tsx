import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  splitwiseExpenseParticipants,
  splitwiseExpenses,
  splitwiseFriends,
} from "@/lib/db/schema";
import { usd } from "@/lib/format";

import { AppHeader } from "@/components/app-header";

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

  const friendExpenseIds = (
    await db
      .select({ expenseId: splitwiseExpenseParticipants.expenseId })
      .from(splitwiseExpenseParticipants)
      .where(eq(splitwiseExpenseParticipants.splitwiseUserId, splitwiseUserId))
  ).map((r) => r.expenseId);

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
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />

      <main className="max-w-3xl mx-auto px-6 pt-10 pb-24">
        <Link
          href="/accounts"
          className="text-sm text-secondary hover:text-foreground"
        >
          ← Accounts
        </Link>

        <section className="mt-6 flex items-center gap-4">
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
            <h1 className="text-2xl tracking-tight font-medium">{fullName}</h1>
            {friend.email && (
              <p className="mt-1 text-sm text-secondary font-mono">
                {friend.email}
              </p>
            )}
            <p className="mt-2 text-sm">
              {balance > 0 ? (
                <span className="font-medium text-emerald-accent">
                  Owes you {usd(balance, { decimals: 2 })}
                </span>
              ) : balance < 0 ? (
                <span className="font-medium text-amber-accent">
                  You owe {usd(Math.abs(balance), { decimals: 2 })}
                </span>
              ) : (
                <span className="text-secondary">Settled up</span>
              )}
            </p>
          </div>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="Spent together"
            value={usd(totalSpentTogether, { decimals: 0 })}
          />
          <Stat label="Expenses" value={String(realExpenses.length)} />
          <Stat label="Payments" value={String(payments.length)} />
        </section>

        <section className="mt-10">
          <div className="text-[11px] uppercase tracking-widest text-secondary mb-4">
            Recent activity
          </div>
          {expenses.length === 0 ? (
            <p className="text-sm text-secondary">No shared expenses yet.</p>
          ) : (
            <ul className="bg-surface border border-border rounded-xl divide-y divide-border">
              {expenses.slice(0, 50).map((e) => {
                const theirs = theirShareByExpense.get(e.id);
                return (
                  <li key={e.id} className="px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium">
                          {e.description || "(no description)"}
                        </span>
                        <span className="text-xs text-secondary font-mono">
                          {fmtDate(e.date)}
                        </span>
                        {e.isPayment && (
                          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-secondary">
                            payment
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-secondary font-mono">
                        bill {usd(Number(e.cost), { decimals: 2 })} · you paid{" "}
                        {usd(Number(e.paidByUser), { decimals: 2 })} / owe{" "}
                        {usd(Number(e.userShare), { decimals: 2 })}
                        {theirs && (
                          <>
                            {" · "}they paid{" "}
                            {usd(Number(theirs.paidShare), { decimals: 2 })} /
                            owe{" "}
                            {usd(Number(theirs.owedShare), { decimals: 2 })}
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
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl px-5 py-4">
      <div className="text-[11px] uppercase tracking-wider text-secondary">
        {label}
      </div>
      <div className="mt-2 font-mono text-2xl">{value}</div>
    </div>
  );
}
