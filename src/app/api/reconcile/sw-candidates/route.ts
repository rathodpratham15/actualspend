import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  reconciliations,
  splitwiseExpenses,
  transactions,
} from "@/lib/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { STATES } from "@/lib/reconciliation/types";

// Returns unmatched Splitwise expenses so the user can manually re-link a
// reconciliation row to a different expense. Sorted by proximity to the
// bank txn's date.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  const url = new URL(req.url);
  const reconId = url.searchParams.get("reconId");
  if (!reconId) {
    return new Response("reconId required", { status: 400 });
  }

  // Fetch the recon row to get the transaction date for sorting.
  const [recon] = await db
    .select({
      transactionId: reconciliations.transactionId,
      currentSwId: reconciliations.splitwiseExpenseId,
    })
    .from(reconciliations)
    .where(
      and(
        eq(reconciliations.id, reconId),
        eq(reconciliations.userId, userId),
      ),
    );
  if (!recon) return new Response("Not found", { status: 404 });

  let txnDate: string | null = null;
  if (recon.transactionId) {
    const [txn] = await db
      .select({ date: transactions.date })
      .from(transactions)
      .where(eq(transactions.id, recon.transactionId));
    txnDate = txn?.date ?? null;
  }

  // Find SW expense IDs already claimed by a user decision (so we don't
  // offer expenses that another row has confirmed).
  const claimed = await db
    .select({ swId: reconciliations.splitwiseExpenseId })
    .from(reconciliations)
    .where(
      and(
        eq(reconciliations.userId, userId),
        inArray(reconciliations.state, [STATES.USER_CONFIRMED, STATES.MANUAL_MATCH]),
      ),
    );
  const claimedIds = new Set(
    claimed.map((r) => r.swId).filter((id): id is string => !!id),
  );
  // Always include the current expense (so the user can keep it).
  if (recon.currentSwId) claimedIds.delete(recon.currentSwId);

  const expenses = await db
    .select({
      id: splitwiseExpenses.id,
      description: splitwiseExpenses.description,
      date: splitwiseExpenses.date,
      cost: splitwiseExpenses.cost,
      userShare: splitwiseExpenses.userShare,
      paidByUser: splitwiseExpenses.paidByUser,
    })
    .from(splitwiseExpenses)
    .where(
      and(
        eq(splitwiseExpenses.userId, userId),
        isNull(splitwiseExpenses.deletedAt),
        sql`${splitwiseExpenses.paidByUser}::numeric > 0`,
      ),
    );

  const available = expenses
    .filter((e) => !claimedIds.has(e.id))
    .map((e) => ({
      ...e,
      daysDiff: txnDate
        ? Math.abs(
            (new Date(e.date).getTime() - new Date(txnDate).getTime()) /
              86_400_000,
          )
        : 9999,
    }))
    .sort((a, b) => a.daysDiff - b.daysDiff)
    .slice(0, 50)
    .map(({ daysDiff: _, ...e }) => e);

  return Response.json(available);
}
