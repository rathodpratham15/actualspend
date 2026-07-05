import { db } from "@/lib/db";
import { transactions, reconciliations } from "@/lib/db/schema";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";

export type InsightKind = "subscription" | "anomaly" | "pattern";

export type Insight = {
  kind: InsightKind;
  title: string;
  detail: string;
  amount?: number;
};

// ── helpers ─────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthStart(y: number, m: number): string {
  return isoDate(new Date(y, m, 1));
}
function monthEnd(y: number, m: number): string {
  return isoDate(new Date(y, m + 1, 0));
}

function usd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

// ── subscription detection ───────────────────────────────────────────────────
// A "subscription" is any merchant that appears in 3+ of the last 4 calendar
// months with amounts within ±15% of each other. The median charge is used as
// the display amount.

async function detectSubscriptions(
  userId: string,
  now: Date,
): Promise<Insight[]> {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - 4);

  const rows = await db
    .select({
      name: transactions.name,
      merchant: transactions.merchantName,
      month: sql<string>`to_char(${transactions.date}::date, 'YYYY-MM')`,
      avg: sql<number>`AVG(${transactions.amount}::numeric)::float`,
      cnt: sql<number>`COUNT(*)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        gte(transactions.date, isoDate(cutoff)),
        lte(transactions.date, isoDate(now)),
        sql`${transactions.amount}::numeric > 0`,
        sql`(${transactions.canonicalCategory} IS NULL OR ${transactions.canonicalCategory} NOT IN ('CC_PAYMENT', 'INCOME', 'REIMBURSEMENT', 'TRANSFER'))`,
      ),
    )
    .groupBy(transactions.name, transactions.merchantName, sql`to_char(${transactions.date}::date, 'YYYY-MM')`);

  // Group by merchant name → months seen + amounts
  const byMerchant = new Map<
    string,
    { months: Set<string>; amounts: number[] }
  >();

  for (const r of rows) {
    const key = (r.merchant ?? r.name).toLowerCase().trim();
    const entry = byMerchant.get(key) ?? {
      months: new Set(),
      amounts: [],
    };
    entry.months.add(r.month);
    entry.amounts.push(Number(r.avg));
    byMerchant.set(key, entry);
  }

  const insights: Insight[] = [];

  for (const [, entry] of byMerchant) {
    if (entry.months.size < 3) continue;

    const amounts = entry.amounts;
    const minA = Math.min(...amounts);
    const maxA = Math.max(...amounts);
    const median = amounts.sort((a, b) => a - b)[Math.floor(amounts.length / 2)];

    // Amount variance check: max within 20% of min
    if (minA <= 0 || (maxA - minA) / minA > 0.2) continue;

    // Find the display name — use merchant name from the most recent row
    const recent = rows
      .filter(
        (r) =>
          (r.merchant ?? r.name).toLowerCase().trim() ===
          [...byMerchant.entries()].find(([, v]) => v === entry)?.[0],
      )
      .sort((a, b) => b.month.localeCompare(a.month))[0];

    const displayName = recent?.merchant ?? recent?.name ?? "Unknown";

    insights.push({
      kind: "subscription",
      title: `Recurring: ${displayName}`,
      detail: `Appears ${entry.months.size} of the last 4 months at ~${usd(median)}/mo`,
      amount: median,
    });
  }

  // Surface the 3 highest-value subscriptions
  return insights
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
    .slice(0, 3);
}

// ── anomaly detection ────────────────────────────────────────────────────────
// Compare current month's category spend against the prior 3-month average.
// Flag any category where current spend > 1.5× the average.

async function detectAnomalies(userId: string, now: Date): Promise<Insight[]> {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed

  // Current month so far
  const curFrom = monthStart(y, m);
  const curTo = isoDate(now);

  // Prior 3 complete months
  const histFrom = monthStart(y, m - 3);
  const histTo = monthEnd(y, m - 1);

  const [curRows, histRows] = await Promise.all([
    db
      .select({
        category: transactions.canonicalCategory,
        total: sql<number>`SUM(${transactions.amount}::numeric)::float`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
          gte(transactions.date, curFrom),
          lte(transactions.date, curTo),
          sql`${transactions.amount}::numeric > 0`,
          sql`(${transactions.canonicalCategory} IS NULL OR ${transactions.canonicalCategory} NOT IN ('CC_PAYMENT', 'INCOME', 'REIMBURSEMENT', 'TRANSFER'))`,
        ),
      )
      .groupBy(transactions.canonicalCategory),

    db
      .select({
        category: transactions.canonicalCategory,
        total: sql<number>`SUM(${transactions.amount}::numeric)::float`,
        months: sql<number>`COUNT(DISTINCT to_char(${transactions.date}::date, 'YYYY-MM'))::int`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
          gte(transactions.date, histFrom),
          lte(transactions.date, histTo),
          sql`${transactions.amount}::numeric > 0`,
          sql`(${transactions.canonicalCategory} IS NULL OR ${transactions.canonicalCategory} NOT IN ('CC_PAYMENT', 'INCOME', 'REIMBURSEMENT', 'TRANSFER'))`,
        ),
      )
      .groupBy(transactions.canonicalCategory),
  ]);

  const LABELS: Record<string, string> = {
    GROCERIES: "Groceries", EATING_OUT: "Eating out", SHOPPING: "Shopping",
    TRANSPORT: "Transport", ENTERTAINMENT: "Entertainment", HEALTH: "Health",
    SUBSCRIPTION: "Subscriptions", TRAVEL: "Travel", EDUCATION: "Education",
    SOCIAL: "Social", OTHER: "Other",
  };

  const histMap = new Map<string | null, number>();
  for (const r of histRows) {
    const monthsActive = Math.max(r.months, 1);
    histMap.set(r.category, Number(r.total) / monthsActive);
  }

  const insights: Insight[] = [];
  for (const r of curRows) {
    const avg = histMap.get(r.category);
    if (!avg || avg < 20) continue; // skip tiny categories
    const ratio = Number(r.total) / avg;
    if (ratio < 1.5) continue;

    const label = LABELS[r.category ?? ""] ?? r.category ?? "spending";
    insights.push({
      kind: "anomaly",
      title: `${label} up ${Math.round((ratio - 1) * 100)}%`,
      detail: `${usd(r.total)} this month vs. ${usd(avg)} monthly avg`,
      amount: r.total,
    });
  }

  return insights.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)).slice(0, 2);
}

// ── behavioral patterns ──────────────────────────────────────────────────────
// Top merchant this period + highest-spend day of week in last 30 days.

async function detectPatterns(
  userId: string,
  now: Date,
): Promise<Insight[]> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);

  const [merchantRows, dowRows] = await Promise.all([
    db
      .select({
        merchant: transactions.merchantName,
        name: transactions.name,
        actual: sql<number>`SUM(COALESCE(${reconciliations.actualAmount}::numeric, ${transactions.amount}::numeric))::float`,
      })
      .from(transactions)
      .leftJoin(reconciliations, eq(reconciliations.transactionId, transactions.id))
      .where(
        and(
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
          gte(transactions.date, isoDate(cutoff)),
          lte(transactions.date, isoDate(now)),
          sql`${transactions.amount}::numeric > 0`,
          sql`(${transactions.canonicalCategory} IS NULL OR ${transactions.canonicalCategory} NOT IN ('CC_PAYMENT', 'INCOME', 'REIMBURSEMENT', 'TRANSFER'))`,
        ),
      )
      .groupBy(transactions.merchantName, transactions.name)
      .orderBy(sql`3 DESC`)
      .limit(1),

    db
      .select({
        dow: sql<number>`EXTRACT(DOW FROM ${transactions.date}::date)::int`,
        total: sql<number>`SUM(${transactions.amount}::numeric)::float`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
          gte(transactions.date, isoDate(cutoff)),
          lte(transactions.date, isoDate(now)),
          sql`${transactions.amount}::numeric > 0`,
          sql`(${transactions.canonicalCategory} IS NULL OR ${transactions.canonicalCategory} NOT IN ('CC_PAYMENT', 'INCOME', 'REIMBURSEMENT', 'TRANSFER'))`,
        ),
      )
      .groupBy(sql`EXTRACT(DOW FROM ${transactions.date}::date)`),
  ]);

  const insights: Insight[] = [];
  const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  if (merchantRows[0]) {
    const m = merchantRows[0];
    const name = m.merchant ?? m.name;
    insights.push({
      kind: "pattern",
      title: `Top merchant: ${name}`,
      detail: `${usd(m.actual)} actual spend in the last 30 days`,
      amount: m.actual,
    });
  }

  if (dowRows.length > 0) {
    const total = dowRows.reduce((s, r) => s + Number(r.total), 0);
    const avg = total / 7;
    const top = dowRows.reduce((best, r) =>
      Number(r.total) > Number(best.total) ? r : best,
    );
    const pct = Math.round(((Number(top.total) / avg) - 1) * 100);
    if (pct > 20) {
      insights.push({
        kind: "pattern",
        title: `${DOW[top.dow]}s are your biggest spend day`,
        detail: `${pct}% above your daily average`,
      });
    }
  }

  return insights;
}

// ── public API ───────────────────────────────────────────────────────────────

export async function computeInsights(userId: string): Promise<Insight[]> {
  const now = new Date();
  const [subs, anomalies, patterns] = await Promise.all([
    detectSubscriptions(userId, now),
    detectAnomalies(userId, now),
    detectPatterns(userId, now),
  ]);
  return [...subs, ...anomalies, ...patterns];
}
