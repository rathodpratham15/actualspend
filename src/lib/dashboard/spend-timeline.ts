// Monthly actual-spend time series for the dashboard chart.
//
// Returns up to 12 months of data, most-recent last. Each point has:
//   month    — "YYYY-MM" label
//   actual   — reconciled actual spend (your real share)
//   bank     — raw bank outflow for comparison
//
// Defaults to reconciled actual_amount. Raw bank is included so the UI can
// offer a "show what your bank sees" toggle without a second query.

import { db } from "@/lib/db";
import { reconciliations, transactions } from "@/lib/db/schema";
import { and, eq, isNull, inArray, ne, sql } from "drizzle-orm";
import { RECONCILIATION_TYPES, STATES } from "@/lib/reconciliation/types";

export type MonthlyPoint = {
  month: string; // "Jan", "Feb", …
  yearMonth: string; // "2026-01" — for sorting / tooltip
  actual: number;
  bank: number;
};

export async function computeSpendTimeline(
  userId: string,
  months = 12,
): Promise<MonthlyPoint[]> {
  const rows = await db
    .select({
      yearMonth: sql<string>`TO_CHAR(DATE_TRUNC('month', ${transactions.date}::date), 'YYYY-MM')`,
      actual: sql<number>`SUM(${reconciliations.actualAmount}::numeric)`,
      bank: sql<number>`SUM(${transactions.amount}::numeric)`,
    })
    .from(reconciliations)
    .innerJoin(
      transactions,
      eq(transactions.id, reconciliations.transactionId),
    )
    .where(
      and(
        eq(reconciliations.userId, userId),
        isNull(transactions.deletedAt),
        // Exclude reimbursement inflows (they reduce spend, counted elsewhere).
        ne(
          reconciliations.reconciliationType,
          RECONCILIATION_TYPES.REIMBURSEMENT_RECEIVED,
        ),
        inArray(reconciliations.state, [
          STATES.AUTO_MATCHED,
          STATES.USER_CONFIRMED,
          STATES.PENDING,
          STATES.MANUAL_MATCH,
        ]),
        sql`${reconciliations.transactionId} IS NOT NULL`,
        // Only look back `months` months.
        sql`${transactions.date}::date >= (CURRENT_DATE - INTERVAL '${sql.raw(String(months - 1))} months')::date`,
        sql`${transactions.date}::date <= CURRENT_DATE`,
      ),
    )
    .groupBy(
      sql`DATE_TRUNC('month', ${transactions.date}::date)`,
    )
    .orderBy(sql`DATE_TRUNC('month', ${transactions.date}::date) ASC`);

  return rows.map((r) => {
    const [year, month] = r.yearMonth.split("-").map(Number);
    const label = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
      month: "short",
    });
    return {
      month: label,
      yearMonth: r.yearMonth,
      actual: Number(r.actual ?? 0),
      bank: Number(r.bank ?? 0),
    };
  });
}
