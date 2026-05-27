import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reconciliations, transactions } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { RECONCILIATION_TYPES, STATES } from "@/lib/reconciliation/types";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  const userId = session.user.id;

  // Fetch the target row so we know its nm_group_id.
  const [row] = await db
    .select({
      id: reconciliations.id,
      txnAmount: transactions.amount,
      nmGroupId: reconciliations.nmGroupId,
    })
    .from(reconciliations)
    .leftJoin(transactions, eq(transactions.id, reconciliations.transactionId))
    .where(
      and(
        eq(reconciliations.id, id),
        eq(reconciliations.userId, userId),
        eq(reconciliations.state, STATES.PENDING),
      ),
    );

  if (!row) {
    return new Response("Not found or not in pending state", { status: 404 });
  }

  if (row.nmGroupId) {
    // N:M group — fetch all rows in the group so we can restore each txn's
    // full bank amount as actual_amount.
    const groupRows = await db
      .select({
        id: reconciliations.id,
        txnAmount: transactions.amount,
      })
      .from(reconciliations)
      .leftJoin(
        transactions,
        eq(transactions.id, reconciliations.transactionId),
      )
      .where(
        and(
          eq(reconciliations.userId, userId),
          eq(reconciliations.nmGroupId, row.nmGroupId),
        ),
      );

    // Reject each row individually so we can restore the correct bank amount.
    await Promise.all(
      groupRows.map((gr) =>
        db
          .update(reconciliations)
          .set({
            state: STATES.USER_REJECTED,
            reconciliationType: RECONCILIATION_TYPES.PERSONAL_EXPENSE,
            actualAmount: gr.txnAmount ?? "0.00",
          })
          .where(
            and(
              eq(reconciliations.id, gr.id),
              eq(reconciliations.userId, userId),
            ),
          ),
      ),
    );
  } else {
    // Standard 1:1 row — restore full bank amount as actual_amount.
    await db
      .update(reconciliations)
      .set({
        state: STATES.USER_REJECTED,
        reconciliationType: RECONCILIATION_TYPES.PERSONAL_EXPENSE,
        actualAmount: row.txnAmount ?? "0.00",
      })
      .where(
        and(
          eq(reconciliations.id, id),
          eq(reconciliations.userId, userId),
        ),
      );
  }

  return Response.json({ ok: true });
}
