// Heuristic: look for a repeating outflow in the $300–$5000 range that appears
// on roughly the same day each month (within ±5 days). If found, return the
// modal amount as the "detected rent" hint shown in the onboarding banner.

import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

export async function detectLikelyRent(userId: string): Promise<number | null> {
  // Pull the last 6 months of outflows in the $300–$5000 range.
  const rows = await db
    .select({
      amount: sql<number>`${transactions.amount}::numeric`,
      dayOfMonth: sql<number>`EXTRACT(DAY FROM ${transactions.date}::date)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        sql`${transactions.amount}::numeric BETWEEN 300 AND 5000`,
        sql`${transactions.date}::date >= CURRENT_DATE - INTERVAL '6 months'`,
      ),
    );

  if (rows.length < 2) return null;

  // Group by rounded amount (within $10 tolerance) and day-of-month (within ±5).
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const roundedAmt = Math.round(r.amount / 10) * 10;
    const roundedDay = Math.round(r.dayOfMonth / 5) * 5;
    const key = `${roundedAmt}:${roundedDay}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  // A candidate is any bucket that appears at least twice (≥2 months).
  let bestAmt: number | null = null;
  let bestCount = 1;
  for (const [key, count] of buckets) {
    if (count > bestCount) {
      bestCount = count;
      bestAmt = parseInt(key.split(":")[0]);
    }
  }

  return bestAmt;
}
