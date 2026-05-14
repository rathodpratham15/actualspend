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
  // Bank spent: sum of bank outflows in window.
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

export type CategoryBreakdown = {
  category: string | null;
  total: number;
  count: number;
};

export async function computeCategoryBreakdown(
  userId: string,
  period: Period,
): Promise<CategoryBreakdown[]> {
  const rows = await db
    .select({
      category: transactions.canonicalCategory,
      total: sql<number>`SUM(${transactions.amount}::numeric)::float`,
      count: sql<number>`COUNT(*)::int`,
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
    .groupBy(transactions.canonicalCategory)
    .orderBy(sql`SUM(${transactions.amount}::numeric) DESC`);

  return rows.map((r) => ({
    category: r.category,
    total: r.total,
    count: r.count,
  }));
}
