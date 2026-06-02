import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  splitwiseFriends,
  splitwiseExpenses,
  splitwiseExpenseParticipants,
  userRoommates,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { usd, dateShort } from "@/lib/format";
import { ArrowLeft, Home } from "lucide-react";

export default async function FriendDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { id } = await params;
  const splitwiseUserId = parseInt(id, 10);
  if (isNaN(splitwiseUserId)) return <div>Invalid friend ID</div>;

  const userId = session.user.id;

  const [friend, roommateRows] = await Promise.all([
    db.select().from(splitwiseFriends)
      .where(and(eq(splitwiseFriends.userId, userId), eq(splitwiseFriends.splitwiseUserId, splitwiseUserId)))
      .limit(1).then((r) => r[0] ?? null),
    db.select().from(userRoommates)
      .where(and(eq(userRoommates.userId, userId), eq(userRoommates.splitwiseUserId, splitwiseUserId)))
      .limit(1),
  ]);

  if (!friend) return <div>Friend not found.</div>;

  const friendParticipations = await db
    .select({ expenseId: splitwiseExpenseParticipants.expenseId })
    .from(splitwiseExpenseParticipants)
    .where(eq(splitwiseExpenseParticipants.splitwiseUserId, splitwiseUserId));

  const expenseIds = [...new Set(friendParticipations.map((p) => p.expenseId))];

  const timeline = expenseIds.length > 0
    ? (await db
        .select()
        .from(splitwiseExpenses)
        .where(and(eq(splitwiseExpenses.userId, userId), inArray(splitwiseExpenses.id, expenseIds))))
        .filter((e) => !e.isPayment && !e.deletedAt)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const name = `${friend.firstName ?? ""} ${friend.lastName ?? ""}`.trim();
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join("");
  const balance = Number(friend.balance);
  const owesYou = balance > 0;
  const isRoommate = roommateRows.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-24 space-y-6">
        <Link href="/friends" className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back to friends
        </Link>

        <div className="surface-card p-6 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="h-16 w-16 rounded-full bg-emerald-soft text-emerald-accent flex items-center justify-center text-xl font-medium shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[22px] font-medium tracking-tight">{name}</h1>
              {isRoommate && (
                <span className="pill pill-teal">
                  <Home className="h-3 w-3" strokeWidth={1.5} /> Roommate
                </span>
              )}
            </div>
            {friend.email && (
              <div className="text-sm text-secondary mt-1">
                {friend.email} · {timeline.length} shared expense{timeline.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
          {balance !== 0 && (
            <div className="sm:border-l sm:border-border sm:pl-6 shrink-0">
              <div className="text-[11px] uppercase tracking-widest text-secondary">Balance</div>
              <div className={`font-mono text-[32px] mt-1 leading-none ${owesYou ? "text-emerald-accent" : "text-destructive"}`}>
                {owesYou ? "+" : "−"}{usd(Math.abs(balance), { decimals: 2 })}
              </div>
              <div className="text-xs text-secondary mt-1">{owesYou ? "Owes you" : "You owe"}</div>
            </div>
          )}
        </div>

        <div className="surface-card p-5">
          <div className="text-sm font-medium mb-4">Shared expenses</div>
          {timeline.length === 0 ? (
            <div className="text-sm text-secondary py-6 text-center">No shared expenses found.</div>
          ) : (
            <ol className="relative border-l border-border ml-2">
              {timeline.map((e) => (
                <li key={e.id} className="ml-5 pb-5">
                  <span className="absolute -left-1 mt-1.5 h-2 w-2 rounded-full bg-emerald-accent" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{e.description ?? "(no description)"}</div>
                      <div className="text-xs text-secondary mt-0.5">{dateShort(e.date)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm">{usd(Number(e.cost), { decimals: 2 })}</div>
                      <div className="text-xs text-secondary font-mono">
                        your share {usd(Number(e.userShare), { decimals: 2 })}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </main>
    </div>
  );
}
