import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { splitwiseFriends } from "@/lib/db/schema";
import { usd } from "@/lib/format";

type Friend = {
  splitwiseUserId: number;
  firstName: string | null;
  lastName: string | null;
  balance: string;
};

function displayName(f: Friend): string {
  return (
    `${f.firstName ?? ""} ${f.lastName ?? ""}`.trim() ||
    `user ${f.splitwiseUserId}`
  );
}

export async function BalancesPanel({ userId }: { userId: string }) {
  const rows = (await db
    .select({
      splitwiseUserId: splitwiseFriends.splitwiseUserId,
      firstName: splitwiseFriends.firstName,
      lastName: splitwiseFriends.lastName,
      balance: splitwiseFriends.balance,
    })
    .from(splitwiseFriends)
    .where(
      and(
        eq(splitwiseFriends.userId, userId),
        sql`${splitwiseFriends.balance}::numeric <> 0`,
      ),
    )
    .orderBy(sql`ABS(${splitwiseFriends.balance}::numeric) DESC`)) as Friend[];

  if (rows.length === 0) {
    return (
      <div className="mt-6 bg-surface border border-border rounded-xl px-5 py-4 text-sm text-secondary">
        No outstanding balances — everyone&apos;s settled up.
      </div>
    );
  }

  const owedToYou = rows.filter((r) => Number(r.balance) > 0);
  const youOwe = rows.filter((r) => Number(r.balance) < 0);
  const totalOwedToYou = owedToYou.reduce((s, r) => s + Number(r.balance), 0);
  const totalYouOwe = youOwe.reduce(
    (s, r) => s + Math.abs(Number(r.balance)),
    0,
  );

  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="bg-surface border border-border rounded-xl px-5 py-4">
          <div className="text-[11px] uppercase tracking-wider text-secondary">
            Owed to you
          </div>
          <div className="mt-2 font-mono text-2xl text-emerald-accent">
            {usd(totalOwedToYou, { decimals: 0 })}
          </div>
          <div className="mt-1 text-xs text-secondary">
            across {owedToYou.length}{" "}
            {owedToYou.length === 1 ? "person" : "people"}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl px-5 py-4">
          <div className="text-[11px] uppercase tracking-wider text-secondary">
            You owe
          </div>
          <div className="mt-2 font-mono text-2xl text-amber-accent">
            {usd(totalYouOwe, { decimals: 0 })}
          </div>
          <div className="mt-1 text-xs text-secondary">
            across {youOwe.length}{" "}
            {youOwe.length === 1 ? "person" : "people"}
          </div>
        </div>
      </div>

      <ul className="bg-surface border border-border rounded-xl divide-y divide-border">
        {rows.map((r) => {
          const amt = Number(r.balance);
          const isOwedToYou = amt > 0;
          return (
            <li
              key={r.splitwiseUserId}
              className="px-5 py-3 flex items-baseline justify-between text-sm"
            >
              <Link
                href={`/friends/${r.splitwiseUserId}`}
                className="hover:text-foreground"
              >
                {displayName(r)}
              </Link>
              <span
                className={`font-mono ${isOwedToYou ? "text-emerald-accent" : "text-amber-accent"}`}
              >
                {isOwedToYou ? "owes you " : "you owe "}
                {usd(Math.abs(amt), { decimals: 0 })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
