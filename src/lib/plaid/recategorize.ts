import { db } from "@/lib/db";
import { transactions, type PlaidCategory } from "@/lib/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { toCanonical } from "./categorize";

// Reapplies the current PRIMARY_MAP/DETAILED_MAP to every transaction the
// user owns that has a stored plaid_category. Cheap operation (one UPDATE
// per row, ~18 rows in the sandbox case). Called from reconcileForUser so
// the dashboard always reflects the latest mapping without a manual step.
export async function recategorizeUserTransactions(
  userId: string,
): Promise<{ scanned: number; changed: number }> {
  const rows = await db
    .select({
      id: transactions.id,
      plaidCategory: transactions.plaidCategory,
      canonicalCategory: transactions.canonicalCategory,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNotNull(transactions.plaidCategory),
      ),
    );

  let changed = 0;
  for (const r of rows) {
    const next = toCanonical(r.plaidCategory as PlaidCategory);
    if (next !== r.canonicalCategory) {
      await db
        .update(transactions)
        .set({ canonicalCategory: next })
        .where(eq(transactions.id, r.id));
      changed++;
    }
  }
  return { scanned: rows.length, changed };
}
