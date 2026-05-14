import { db } from "@/lib/db";
import { splitwiseFriends } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

type Friend = {
  splitwiseUserId: number;
  firstName: string | null;
  lastName: string | null;
  balance: string;
};

function fmtUSD(n: number): string {
  return Math.abs(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

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
      <p className="mt-3 text-sm text-muted-foreground">
        No outstanding balances — everyone&apos;s settled up.
      </p>
    );
  }

  const owedToYou = rows.filter((r) => Number(r.balance) > 0);
  const youOwe = rows.filter((r) => Number(r.balance) < 0);
  const totalOwedToYou = owedToYou.reduce((s, r) => s + Number(r.balance), 0);
  const totalYouOwe = youOwe.reduce((s, r) => s + Math.abs(Number(r.balance)), 0);

  return (
    <div className="mt-3">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Owed to you
          </div>
          <div className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-300">
            {fmtUSD(totalOwedToYou)}
          </div>
          <div className="text-xs text-muted-foreground">
            across {owedToYou.length} {owedToYou.length === 1 ? "person" : "people"}
          </div>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            You owe
          </div>
          <div className="mt-1 text-xl font-semibold text-amber-700 dark:text-amber-300">
            {fmtUSD(totalYouOwe)}
          </div>
          <div className="text-xs text-muted-foreground">
            across {youOwe.length} {youOwe.length === 1 ? "person" : "people"}
          </div>
        </div>
      </div>

      <ul className="space-y-1.5 text-sm">
        {rows.map((r) => {
          const amt = Number(r.balance);
          const isOwedToYou = amt > 0;
          return (
            <li
              key={r.splitwiseUserId}
              className="flex items-baseline justify-between"
            >
              <span>{displayName(r)}</span>
              <span
                className={
                  isOwedToYou
                    ? "font-medium text-emerald-700 dark:text-emerald-300"
                    : "font-medium text-amber-700 dark:text-amber-300"
                }
              >
                {isOwedToYou ? "owes you " : "you owe "}
                {fmtUSD(amt)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
