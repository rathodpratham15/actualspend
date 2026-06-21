import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { splitwiseFriends, userRoommates, splitwiseExpenseParticipants } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { SortSelect } from "@/components/sort-select";
import { PaginationControls } from "@/components/pagination-controls";
import { usd } from "@/lib/format";
import { Home, ChevronRight } from "lucide-react";

const PAGE_SIZE = 8; // 2 cols × 4 rows

const SORT_OPTIONS = [
  { value: "balance_desc", label: "Balance (high → low)" },
  { value: "balance_asc",  label: "Balance (low → high)" },
  { value: "name",         label: "Name (A → Z)" },
  { value: "expenses",     label: "Expenses (most first)" },
];

function parseSort(raw: string | undefined) {
  const valid = SORT_OPTIONS.map((o) => o.value);
  return valid.includes(raw ?? "") ? (raw as string) : "balance_desc";
}

function parsePage(raw: string | undefined) {
  const n = parseInt(raw ?? "1", 10);
  return isNaN(n) || n < 1 ? 1 : n;
}

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const sp = await searchParams;
  const sort = parseSort(sp.sort as string | undefined);
  const page = parsePage(sp.page as string | undefined);

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

  const allRows = friends
    .map((f) => ({
      id: f.splitwiseUserId,
      name: `${f.firstName ?? ""} ${f.lastName ?? ""}`.trim() || `User ${f.splitwiseUserId}`,
      email: f.email,
      balance: Number(f.balance),
      isRoommate: roommateSet.has(f.splitwiseUserId),
      expenseCount: countMap.get(f.splitwiseUserId) ?? 0,
    }))
    .sort((a, b) => {
      switch (sort) {
        case "balance_asc":  return Math.abs(a.balance) - Math.abs(b.balance);
        case "name":         return a.name.localeCompare(b.name);
        case "expenses":     return b.expenseCount - a.expenseCount;
        default:             return Math.abs(b.balance) - Math.abs(a.balance); // balance_desc
      }
    });

  const total = allRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-24">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-secondary">Friends</div>
            <h1 className="text-[22px] font-medium tracking-tight mt-1">Balances at a glance</h1>
          </div>
          <Suspense>
            <SortSelect options={SORT_OPTIONS} current={sort} />
          </Suspense>
        </div>

        {rows.length === 0 ? (
          <div className="surface-card p-12 text-center text-sm text-secondary">
            No friends yet. Connect Splitwise to see your friends.
          </div>
        ) : (
          <>
            {/* 2-column grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rows.map((f) => {
                const owesYou = f.balance > 0;
                const initials = f.name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join("");
                return (
                  <Link
                    key={f.id}
                    href={`/friends/${f.id}`}
                    className="surface-card p-5 hover:shadow-lift transition-shadow group flex flex-col gap-4"
                  >
                    {/* Top row: avatar + name */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-emerald-soft text-emerald-accent flex items-center justify-center text-sm font-medium shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{f.name}</div>
                          <div className="text-xs text-secondary mt-0.5">
                            {f.expenseCount} shared {f.expenseCount === 1 ? "expense" : "expenses"}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-secondary group-hover:translate-x-0.5 transition-transform shrink-0 mt-1" strokeWidth={1.5} />
                    </div>

                    {/* Balance + roommate */}
                    <div className="flex items-end justify-between">
                      <div>
                        {f.balance !== 0 ? (
                          <>
                            <div className={`font-mono text-xl font-medium ${owesYou ? "text-emerald-accent" : "text-destructive"}`}>
                              {owesYou ? "+" : "−"}{usd(Math.abs(f.balance), { decimals: 2 })}
                            </div>
                            <div className="text-[11px] text-secondary mt-0.5">
                              {owesYou ? "owes you" : "you owe"}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-secondary">Settled up</div>
                        )}
                      </div>
                      {f.isRoommate && (
                        <span className="pill pill-teal shrink-0">
                          <Home className="h-3 w-3" strokeWidth={1.5} /> Roommate
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-xs text-secondary">
                <span className="font-mono">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
                <Suspense>
                  <PaginationControls page={page} totalPages={totalPages} totalRows={total} pageSize={PAGE_SIZE} />
                </Suspense>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
