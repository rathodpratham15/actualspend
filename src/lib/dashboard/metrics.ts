import { db } from "@/lib/db";
import {
  reconciliations,
  splitwiseExpenses,
  transactions,
} from "@/lib/db/schema";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { RECONCILIATION_TYPES } from "@/lib/reconciliation/types";
import type { Period } from "./period";

export type DashboardMetrics = {
  bankSpent: number;
  sharedExpensesFronted: number;
  /** Net owed to user this period: grossOwed − reimbursementsReceived. */
  reimbursementsPending: number;
  /** Total others-owe-you for expenses fronted in this period. */
  reimbursementsGrossOwed: number;
  /** Sum of bank inflows matched as REIMBURSEMENT_RECEIVED in this period. */
  reimbursementsReceived: number;
  actualSpend: number;
};

export async function computeDashboardMetrics(
  userId: string,
  period: Period,
): Promise<DashboardMetrics> {
  // Bank spent: sum of bank outflows in window, excluding internal
  // transfers (e.g. paying off a credit card from bank — that's not new
  // spending, just settling debt). Income credits and reimbursements
  // received aren't outflows anyway.
  const [bankRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${transactions.amount}::numeric), 0)::float`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        gte(transactions.date, period.from),
        lte(transactions.date, period.to),
        sql`${transactions.amount}::numeric > 0`,
        sql`(${transactions.canonicalCategory} IS NULL OR ${transactions.canonicalCategory} NOT IN ('TRANSFER', 'INCOME', 'REIMBURSEMENT'))`,
      ),
    );

  // Shared expenses fronted: total cost of group purchases where the user
  // actually paid (i.e. they hit your card or cash).
  const [frontedRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${splitwiseExpenses.paidByUser}::numeric), 0)::float`,
    })
    .from(splitwiseExpenses)
    .where(
      and(
        eq(splitwiseExpenses.userId, userId),
        isNull(splitwiseExpenses.deletedAt),
        gte(splitwiseExpenses.date, period.from),
        lte(splitwiseExpenses.date, period.to),
        sql`${splitwiseExpenses.paidByUser}::numeric > 0`,
      ),
    );

  // Gross owed: for each Splitwise expense in the period the user fronted,
  // the amount others owe = paid_by_user − user_share (when positive).
  const [grossOwedRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(GREATEST(${splitwiseExpenses.paidByUser}::numeric - ${splitwiseExpenses.userShare}::numeric, 0)), 0)::float`,
    })
    .from(splitwiseExpenses)
    .where(
      and(
        eq(splitwiseExpenses.userId, userId),
        isNull(splitwiseExpenses.deletedAt),
        gte(splitwiseExpenses.date, period.from),
        lte(splitwiseExpenses.date, period.to),
        sql`${splitwiseExpenses.paidByUser}::numeric > 0`,
      ),
    );

  // Reimbursements received in period: bank inflows the engine matched to
  // Splitwise payment records. Use the inflow magnitude (|amount|) since the
  // bank stores it as negative.
  const [receivedRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(ABS(${transactions.amount}::numeric)), 0)::float`,
    })
    .from(reconciliations)
    .leftJoin(
      transactions,
      eq(transactions.id, reconciliations.transactionId),
    )
    .where(
      and(
        eq(reconciliations.userId, userId),
        eq(
          reconciliations.reconciliationType,
          RECONCILIATION_TYPES.REIMBURSEMENT_RECEIVED,
        ),
        gte(transactions.date, period.from),
        lte(transactions.date, period.to),
      ),
    );

  const grossOwed = grossOwedRow.total;
  const received = receivedRow.total;
  // Net pending — floor at 0 since reimbursements received in this period
  // might exceed new fronts in the same period (you got paid back for older
  // expenses). We don't want a "negative pending" sign-flip in the UI.
  const pending = Math.max(grossOwed - received, 0);

  // Actual spend: from the reconciliation engine output, dated by the
  // underlying transaction (or splitwise expense for SPLITWISE_ONLY).
  const [actualRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${reconciliations.actualAmount}::numeric), 0)::float`,
    })
    .from(reconciliations)
    .leftJoin(
      transactions,
      eq(transactions.id, reconciliations.transactionId),
    )
    .leftJoin(
      splitwiseExpenses,
      eq(splitwiseExpenses.id, reconciliations.splitwiseExpenseId),
    )
    .where(
      and(
        eq(reconciliations.userId, userId),
        sql`COALESCE(${transactions.date}, ${splitwiseExpenses.date}) BETWEEN ${period.from} AND ${period.to}`,
        // Mirror the bank-outflow exclusion above so paying off a credit
        // card doesn't show up as actual spend.
        sql`(${transactions.canonicalCategory} IS NULL OR ${transactions.canonicalCategory} NOT IN ('TRANSFER', 'INCOME', 'REIMBURSEMENT'))`,
      ),
    );

  return {
    bankSpent: bankRow.total,
    sharedExpensesFronted: frontedRow.total,
    reimbursementsPending: pending,
    reimbursementsGrossOwed: grossOwed,
    reimbursementsReceived: received,
    actualSpend: actualRow.total,
  };
}

export type CategoryTxn = {
  id: string;
  name: string;
  merchantName: string | null;
  date: string;
  amount: number;
};

export type CategoryBreakdown = {
  category: string | null;
  total: number;
  count: number;
  txns: CategoryTxn[];
};

// Canonical categories that are NOT real spending — internal transfers
// (e.g. paying off a credit card from bank), income credits, and
// reimbursements received. Excluded from the dashboard's bank-outflow and
// category-breakdown numbers so a $500 CC bill payment doesn't look like
// "$500 spent on transfers" when the underlying purchases are already
// counted on the credit card side.
const NON_SPEND_CATEGORIES = ["TRANSFER", "INCOME", "REIMBURSEMENT"];

export async function computeCategoryBreakdown(
  userId: string,
  period: Period,
): Promise<CategoryBreakdown[]> {
  // Pull every spend-side transaction in the period in one query, then
  // group + order in JS. Simpler than two queries and v1-scale-cheap
  // (hundreds of rows, not millions).
  const rows = await db
    .select({
      id: transactions.id,
      category: transactions.canonicalCategory,
      name: transactions.name,
      merchantName: transactions.merchantName,
      date: transactions.date,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        gte(transactions.date, period.from),
        lte(transactions.date, period.to),
        sql`${transactions.amount}::numeric > 0`,
      ),
    )
    .orderBy(sql`${transactions.date} DESC`);

  const buckets = new Map<string | null, CategoryBreakdown>();
  for (const r of rows) {
    if (r.category && NON_SPEND_CATEGORIES.includes(r.category)) continue;
    const key = r.category;
    const bucket = buckets.get(key) ?? {
      category: key,
      total: 0,
      count: 0,
      txns: [],
    };
    const amount = Number(r.amount);
    bucket.total += amount;
    bucket.count++;
    bucket.txns.push({
      id: r.id,
      name: r.name,
      merchantName: r.merchantName,
      date: r.date,
      amount,
    });
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values()).sort((a, b) => b.total - a.total);
}
