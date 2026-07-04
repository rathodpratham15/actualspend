import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reconciliations, splitwiseExpenses } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { STATES, RECONCILIATION_TYPES } from "@/lib/reconciliation/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  const userId = session.user.id;

  const body = await req.json().catch(() => ({}));
  const splitwiseExpenseId: string | undefined = body?.splitwiseExpenseId;
  if (!splitwiseExpenseId) {
    return new Response("splitwiseExpenseId required", { status: 400 });
  }

  // Verify the recon row belongs to this user and is not already resolved.
  const [row] = await db
    .select({
      id: reconciliations.id,
      state: reconciliations.state,
    })
    .from(reconciliations)
    .where(
      and(
        eq(reconciliations.id, id),
        eq(reconciliations.userId, userId),
      ),
    );
  if (!row) return new Response("Not found", { status: 404 });

  // Fetch the chosen SW expense to pull userShare for actualAmount.
  const [exp] = await db
    .select({
      userShare: splitwiseExpenses.userShare,
      userId: splitwiseExpenses.userId,
    })
    .from(splitwiseExpenses)
    .where(eq(splitwiseExpenses.id, splitwiseExpenseId));
  if (!exp || exp.userId !== userId) {
    return new Response("Expense not found", { status: 404 });
  }

  await db
    .update(reconciliations)
    .set({
      splitwiseExpenseId,
      actualAmount: exp.userShare,
      reconciliationType: RECONCILIATION_TYPES.FRONTED_SHARED_EXPENSE,
      state: STATES.MANUAL_MATCH,
      confidence: null,
      matchReasons: [
        { kind: "text", weight: 1, detail: "Manually matched by user" },
      ],
      nmGroupId: null,
      linkedExpenses: null,
    })
    .where(
      and(
        eq(reconciliations.id, id),
        eq(reconciliations.userId, userId),
      ),
    );

  return Response.json({ ok: true });
}
