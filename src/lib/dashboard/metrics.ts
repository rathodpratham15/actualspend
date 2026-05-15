import { db } from "@/lib/db";
import {
  reconciliations,
  splitwiseExpenses,
  transactions,
} from "@/lib/db/schema";
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
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
        sql`(${transactions.canonicalCategory} IS NULL OR ${transactions.canonicalCategory} NOT IN ('CC_PAYMENT', 'INCOME', 'REIMBURSEMENT'))`,
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
        sql`(${transactions.canonicalCategory} IS NULL OR ${transactions.canonicalCategory} NOT IN ('CC_PAYMENT', 'INCOME', 'REIMBURSEMENT'))`,
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
  /** Description from a matched Splitwise expense, when reconciled. Useful
   * when the bank name is opaque (e.g. "IC* INSTACART") but the Splitwise
   * side names the actual store ("Apne Bazaar"). */
  swDescription: string | null;
  date: string;
  amount: number;
};

export type CategoryBreakdown = {
  category: string | null;
  total: number;
  count: number;
  txns: CategoryTxn[];
};

// Canonical categories that are NOT real spending: credit card bill
// payments (the underlying purchases show on the linked CC account),
// income credits, and reimbursements received. Excluded from the
// dashboard's bank-outflow and category-breakdown numbers.
//
// NB: TRANSFER is INCLUDED — checks/wires to landlords, Zelle to friends,
// etc. are categorized by Plaid as TRANSFER but they're real money out
// of the user's account. v1.1: surface a manual recategorize UI so users
// can demote actual transfers (savings, investment) themselves.
const NON_SPEND_CATEGORIES = ["CC_PAYMENT", "INCOME", "REIMBURSEMENT"];

export async function computeCategoryBreakdown(
  userId: string,
  period: Period,
): Promise<CategoryBreakdown[]> {
  // Pull every spend-side transaction in the period in one query, joined
  // to its reconciliation (if any) so we can surface the Splitwise
  // description as the merchant alias when the bank text is opaque.
  const rows = await db
    .select({
      id: transactions.id,
      category: transactions.canonicalCategory,
      name: transactions.name,
      merchantName: transactions.merchantName,
      date: transactions.date,
      amount: transactions.amount,
      swDescription: splitwiseExpenses.description,
    })
    .from(transactions)
    .leftJoin(
      reconciliations,
      eq(reconciliations.transactionId, transactions.id),
    )
    .leftJoin(
      splitwiseExpenses,
      eq(splitwiseExpenses.id, reconciliations.splitwiseExpenseId),
    )
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        gte(transactions.date, period.from),
        lte(transactions.date, period.to),
        sql`${transactions.amount}::numeric > 0`,
      ),
    )
    .orderBy(desc(transactions.date));

  const buckets = new Map<string | null, CategoryBreakdown>();
  const seenTxnIds = new Set<string>();
  for (const r of rows) {
    // Drizzle's leftJoin can produce duplicate rows if a txn has multiple
    // reconciliation rows. Dedup by txn id (first one wins; ordered by
    // date so the newest matched description sticks).
    if (seenTxnIds.has(r.id)) continue;
    seenTxnIds.add(r.id);
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
      swDescription: r.swDescription ?? null,
      date: r.date,
      amount,
    });
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values()).sort((a, b) => b.total - a.total);
}
