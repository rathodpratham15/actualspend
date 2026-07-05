import { db } from "@/lib/db";
import { reconciliations, transactions } from "@/lib/db/schema";
import { RECONCILIATION_TYPES } from "@/lib/reconciliation/types";
import { and, eq, gte, isNull, sql } from "drizzle-orm";

export type SubscriptionRow = {
  merchant: string;
  channel: string | null;
  /** Median actual (reconciled) monthly charge. */
  monthlyActual: number;
  /** Median raw bank charge (before reconciliation). */
  monthlyBank: number;
  /** True if any charge is reconciled as a shared/fronted expense. */
  isShared: boolean;
  /** Number of months this merchant has appeared in (up to 12). */
  monthsActive: number;
  /** Most recent charge date (ISO string). */
  lastSeen: string;
  /** Actual amounts per month, sorted oldest→newest, for the sparkline. */
  monthlyAmounts: { month: string; actual: number }[];
};

// Detect subscriptions over the last 12 calendar months.
// A subscription is any merchant that:
//   - appears in 3+ distinct months
//   - has raw bank charges within ±20% of each other across those months
export async function computeSubscriptions(userId: string): Promise<SubscriptionRow[]> {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - 12);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  // Per-merchant, per-month aggregates including reconciled actual amounts.
  const rows = await db
    .select({
      merchant: sql<string>`COALESCE(${transactions.effectiveMerchant}, ${transactions.merchantName}, ${transactions.name})`,
      channel: transactions.channel,
      month: sql<string>`to_char(${transactions.date}::date, 'YYYY-MM')`,
      avgBank: sql<number>`AVG(${transactions.amount}::numeric)::float`,
      avgActual: sql<number>`AVG(COALESCE(${reconciliations.actualAmount}::numeric, ${transactions.amount}::numeric))::float`,
      lastSeen: sql<string>`MAX(${transactions.date})`,
      isShared: sql<boolean>`bool_or(${reconciliations.reconciliationType} = ${RECONCILIATION_TYPES.FRONTED_SHARED_EXPENSE})`,
    })
    .from(transactions)
    .leftJoin(reconciliations, eq(reconciliations.transactionId, transactions.id))
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        gte(transactions.date, cutoff),
        sql`${transactions.amount}::numeric > 0`,
        sql`(${transactions.canonicalCategory} IS NULL OR ${transactions.canonicalCategory} NOT IN ('CC_PAYMENT', 'INCOME', 'REIMBURSEMENT', 'TRANSFER'))`,
      ),
    )
    .groupBy(
      sql`COALESCE(${transactions.effectiveMerchant}, ${transactions.merchantName}, ${transactions.name})`,
      transactions.channel,
      sql`to_char(${transactions.date}::date, 'YYYY-MM')`,
    )
    .orderBy(
      sql`COALESCE(${transactions.effectiveMerchant}, ${transactions.merchantName}, ${transactions.name})`,
      sql`to_char(${transactions.date}::date, 'YYYY-MM')`,
    );

  // Group by merchant.
  type MerchantEntry = {
    channel: string | null;
    months: Map<string, { bank: number; actual: number }>;
    lastSeen: string;
    isShared: boolean;
  };

  const byMerchant = new Map<string, MerchantEntry>();
  for (const r of rows) {
    const key = r.merchant;
    const entry = byMerchant.get(key) ?? {
      channel: r.channel,
      months: new Map(),
      lastSeen: r.lastSeen,
      isShared: false,
    };
    entry.months.set(r.month, {
      bank: Number(r.avgBank),
      actual: Number(r.avgActual),
    });
    if (r.lastSeen > entry.lastSeen) entry.lastSeen = r.lastSeen;
    if (r.isShared) entry.isShared = true;
    byMerchant.set(key, entry);
  }

  const results: SubscriptionRow[] = [];

  for (const [merchant, entry] of byMerchant) {
    if (entry.months.size < 3) continue;

    const bankAmounts = [...entry.months.values()].map((m) => m.bank);
    const minBank = Math.min(...bankAmounts);
    const maxBank = Math.max(...bankAmounts);

    // Skip if bank charges vary by more than 20% — not a stable subscription.
    if (minBank <= 0 || (maxBank - minBank) / minBank > 0.2) continue;

    const sortedMonths = [...entry.months.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );

    const actualAmounts = sortedMonths.map(([, v]) => v.actual);
    const bankSorted = [...bankAmounts].sort((a, b) => a - b);
    const actualSorted = [...actualAmounts].sort((a, b) => a - b);
    const mid = Math.floor(bankSorted.length / 2);

    results.push({
      merchant,
      channel: entry.channel,
      monthlyActual: actualSorted[mid],
      monthlyBank: bankSorted[mid],
      isShared: entry.isShared,
      monthsActive: entry.months.size,
      lastSeen: entry.lastSeen,
      // Last 6 months for the sparkline.
      monthlyAmounts: sortedMonths.slice(-6).map(([month, v]) => ({
        month,
        actual: v.actual,
      })),
    });
  }

  // Sort by monthly actual cost descending.
  return results.sort((a, b) => b.monthlyActual - a.monthlyActual);
}
