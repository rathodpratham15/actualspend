import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { splitwiseFriends, userRoommates, splitwiseExpenseParticipants } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { usd } from "@/lib/format";
import { Home, ChevronRight } from "lucide-react";

export default async function FriendsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const [friends, roommates, counts] = await Promise.all([
    db.select().from(splitwiseFriends).where(eq(splitwiseFriends.userId, userId)),
    db.select({ splitwiseUserId: userRoommates.splitwiseUserId })
      .from(userRoommates).where(eq(userRoommates.userId, userId)),
    db.select({
      splitwiseUserId: splitwiseExpenseParticipants.splitwiseUserId,
      count: sql<number>`count(*)::int`,
    }).from(splitwiseExpenseParticipants).groupBy(splitwiseExpenseParticipants.splitwiseUserId),
  ]);

  const roommateSet = new Set(roommates.map((r) => r.splitwiseUserId));
  const countMap = new Map(counts.map((c) => [c.splitwiseUserId, c.count]));

  const rows = friends
    .map((f) => ({
      id: f.splitwiseUserId,
      name: `${f.firstName ?? ""} ${f.lastName ?? ""}`.trim() || `User ${f.splitwiseUserId}`,
      email: f.email,
      balance: Number(f.balance),
      isRoommate: roommateSet.has(f.splitwiseUserId),
      expenseCount: countMap.get(f.splitwiseUserId) ?? 0,
    }))
    .sort((a, b) => {
      if (a.isRoommate !== b.isRoommate) return a.isRoommate ? -1 : 1;
      return Math.abs(b.balance) - Math.abs(a.balance);
    });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-24">
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-widest text-secondary">Friends</div>
          <h1 className="text-xl font-medium tracking-tight mt-1">Balances at a glance</h1>
        </div>

        <div className="surface-card overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-secondary">
              No friends yet. Connect Splitwise to see your friends.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((f) => {
                const owesYou = f.balance > 0;
                const initials = f.name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join("");
                return (
                  <Link
                    key={f.id}
                    href={`/friends/${f.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
                  >
                    {/* Avatar */}
                    <div className="h-10 w-10 rounded-full bg-emerald-soft text-emerald-accent flex items-center justify-center text-sm font-medium shrink-0">
                      {initials}
                    </div>

                    {/* Name + roommate pill */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-medium truncate">{f.name}</span>
                        {f.isRoommate && (
                          <span className="pill pill-teal">
                            <Home className="h-3 w-3" strokeWidth={1.5} /> Roommate
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-secondary mt-0.5">
                        {f.expenseCount} shared {f.expenseCount === 1 ? "expense" : "expenses"}
                      </div>
                    </div>

                    {/* Balance */}
                    <div className="text-right shrink-0">
                      {f.balance !== 0 ? (
                        <>
                          <div className={`font-mono text-sm ${owesYou ? "text-emerald-accent" : "text-destructive"}`}>
                            {owesYou ? "+" : "−"}{usd(Math.abs(f.balance), { decimals: 2 })}
                          </div>
                          <div className="text-[11px] text-secondary">
                            {owesYou ? "owes you" : "you owe"}
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] text-secondary">settled up</div>
                      )}
                    </div>

                    <ChevronRight className="h-4 w-4 text-secondary group-hover:translate-x-0.5 transition-transform shrink-0" strokeWidth={1.5} />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
