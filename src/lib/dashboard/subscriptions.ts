import { db } from "@/lib/db";
import { reconciliations, transactions } from "@/lib/db/schema";
import { RECONCILIATION_TYPES } from "@/lib/reconciliation/types";
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";

// ── Subscription detection ────────────────────────────────────────────────────

export type SubscriptionRow = {
  merchant: string;
  channel: string | null;
  /** Median actual (reconciled) monthly charge. */
  monthlyActual: number;
  /** Median raw bank charge (before reconciliation). */
  monthlyBank: number;
  /** True if any charge is reconciled as a shared/fronted expense. */
  isShared: boolean;
  /** Number of months this merchant has appeared in (up to lookback window). */
  monthsActive: number;
  /** Most recent charge date (ISO string). */
  lastSeen: string;
  /** Actual amounts per month, sorted oldest→newest, for the sparkline. */
  monthlyAmounts: { month: string; actual: number }[];
};

// Detect subscriptions over a date range.
// A subscription is any merchant that:
//   - appears in 3+ distinct months within the range
//   - has raw bank charges within ±20% of each other across those months
export async function computeSubscriptions(
  userId: string,
  from: string,
  to: string,
): Promise<SubscriptionRow[]> {
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
        gte(transactions.date, from),
        lte(transactions.date, to),
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
      monthlyAmounts: sortedMonths.slice(-6).map(([month, v]) => ({
        month,
        actual: v.actual,
      })),
    });
  }

  return results.sort((a, b) => b.monthlyActual - a.monthlyActual);
}

// ── Card exposure ("all places") ──────────────────────────────────────────────

export type CardExposureRow = {
  merchant: string;
  channel: string | null;
  firstSeen: string;
  lastSeen: string;
  txnCount: number;
  totalActual: number;
  isRecurring: boolean;
};

// All distinct merchants that charged the user within [from, to].
// Pass the set of recurring merchant names (from computeSubscriptions) so each
// row can be flagged without a second join.
export async function computeCardExposure(
  userId: string,
  from: string,
  to: string,
  recurringMerchants: Set<string>,
): Promise<CardExposureRow[]> {
  const rows = await db
    .select({
      merchant: sql<string>`COALESCE(${transactions.effectiveMerchant}, ${transactions.merchantName}, ${transactions.name})`,
      channel: transactions.channel,
      firstSeen: sql<string>`MIN(${transactions.date})`,
      lastSeen: sql<string>`MAX(${transactions.date})`,
      txnCount: sql<number>`COUNT(*)::int`,
      totalActual: sql<number>`SUM(COALESCE(${reconciliations.actualAmount}::numeric, ${transactions.amount}::numeric))::float`,
    })
    .from(transactions)
    .leftJoin(reconciliations, eq(reconciliations.transactionId, transactions.id))
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        gte(transactions.date, from),
        lte(transactions.date, to),
        sql`${transactions.amount}::numeric > 0`,
        sql`(${transactions.canonicalCategory} IS NULL OR ${transactions.canonicalCategory} NOT IN ('CC_PAYMENT', 'INCOME', 'REIMBURSEMENT', 'TRANSFER'))`,
      ),
    )
    .groupBy(
      sql`COALESCE(${transactions.effectiveMerchant}, ${transactions.merchantName}, ${transactions.name})`,
      transactions.channel,
    )
    .orderBy(sql`MAX(${transactions.date}) DESC`);

  return rows.map((r) => ({
    merchant: r.merchant,
    channel: r.channel,
    firstSeen: r.firstSeen,
    lastSeen: r.lastSeen,
    txnCount: Number(r.txnCount),
    totalActual: Number(r.totalActual ?? 0),
    isRecurring: recurringMerchants.has(r.merchant),
  }));
}

// ── Per-merchant transaction details ─────────────────────────────────────────

export type MerchantTxn = {
  id: string;
  date: string;
  name: string;
  amount: number;
  actualAmount: number | null;
};

// Fetch individual transactions for a specific set of merchant names within
// [from, to]. Returns a map keyed by the same COALESCE merchant name.
export async function fetchMerchantTransactions(
  userId: string,
  merchants: string[],
  from: string,
  to: string,
): Promise<Record<string, MerchantTxn[]>> {
  if (merchants.length === 0) return {};

  const merchantFilter = sql.join(
    merchants.map((m) => sql`${m}`),
    sql`, `,
  );

  const rows = await db
    .select({
      merchant: sql<string>`COALESCE(${transactions.effectiveMerchant}, ${transactions.merchantName}, ${transactions.name})`,
      id: transactions.id,
      date: sql<string>`${transactions.date}::text`,
      name: transactions.name,
      amount: sql<number>`${transactions.amount}::float`,
      actualAmount: sql<number | null>`${reconciliations.actualAmount}::float`,
    })
    .from(transactions)
    .leftJoin(reconciliations, eq(reconciliations.transactionId, transactions.id))
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        gte(transactions.date, from),
        lte(transactions.date, to),
        sql`${transactions.amount}::numeric > 0`,
        sql`(${transactions.canonicalCategory} IS NULL OR ${transactions.canonicalCategory} NOT IN ('CC_PAYMENT', 'INCOME', 'REIMBURSEMENT', 'TRANSFER'))`,
        sql`COALESCE(${transactions.effectiveMerchant}, ${transactions.merchantName}, ${transactions.name}) IN (${merchantFilter})`,
      ),
    )
    .orderBy(desc(transactions.date));

  const result: Record<string, MerchantTxn[]> = {};
  for (const r of rows) {
    if (!result[r.merchant]) result[r.merchant] = [];
    result[r.merchant].push({
      id: r.id,
      date: r.date,
      name: r.name,
      amount: Number(r.amount),
      actualAmount: r.actualAmount != null ? Number(r.actualAmount) : null,
    });
  }
  return result;
}
