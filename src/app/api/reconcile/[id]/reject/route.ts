import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reconciliations, transactions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
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

  // Fetch the row + its bank txn amount so we can flip actual_amount to the
  // full bank cost — rejection means there's no Splitwise offset.
  const [row] = await db
    .select({
      id: reconciliations.id,
      txnAmount: transactions.amount,
    })
    .from(reconciliations)
    .leftJoin(transactions, eq(transactions.id, reconciliations.transactionId))
    .where(
      and(
        eq(reconciliations.id, id),
        eq(reconciliations.userId, session.user.id),
        eq(reconciliations.state, STATES.PENDING),
      ),
    );

  if (!row) {
    return new Response("Not found or not in pending state", { status: 404 });
  }

  await db
    .update(reconciliations)
    .set({
      state: STATES.USER_REJECTED,
      // The rejected partner stays on splitwise_expense_id so the engine
      // can skip re-proposing this pair, but the type becomes PERSONAL
      // since there's no longer a match.
      reconciliationType: RECONCILIATION_TYPES.PERSONAL_EXPENSE,
      actualAmount: row.txnAmount ?? "0.00",
    })
    .where(eq(reconciliations.id, id));

  return Response.json({ ok: true });
}
