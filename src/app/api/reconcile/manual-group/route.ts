import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  reconciliations,
  splitwiseExpenses,
  transactions,
} from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import {
  RECONCILIATION_TYPES,
  STATES,
} from "@/lib/reconciliation/types";
import type { MatchReason } from "@/lib/db/schema";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json()) as {
    reconIds: string[];
    splitwiseExpenseId: string;
  };

  if (
    !Array.isArray(body.reconIds) ||
    body.reconIds.length < 2 ||
    !body.splitwiseExpenseId
  ) {
    return new Response("reconIds (≥2) and splitwiseExpenseId required", {
      status: 400,
    });
  }

  // Verify all recon rows belong to this user and are PERSONAL_EXPENSE
  const reconRows = await db
    .select({
      id: reconciliations.id,
      transactionId: reconciliations.transactionId,
    })
    .from(reconciliations)
    .where(
      and(
        eq(reconciliations.userId, userId),
        inArray(reconciliations.id, body.reconIds),
        eq(reconciliations.reconciliationType, RECONCILIATION_TYPES.PERSONAL_EXPENSE),
      ),
    );

  if (reconRows.length !== body.reconIds.length) {
    return new Response("One or more rows not found or not personal expenses", {
      status: 404,
    });
  }

  // Verify the Splitwise expense belongs to this user
  const [swExp] = await db
    .select({ id: splitwiseExpenses.id, userShare: splitwiseExpenses.userShare })
    .from(splitwiseExpenses)
    .where(
      and(
        eq(splitwiseExpenses.id, body.splitwiseExpenseId),
        eq(splitwiseExpenses.userId, userId),
      ),
    )
    .limit(1);

  if (!swExp) {
    return new Response("Splitwise expense not found", { status: 404 });
  }

  // Fetch bank amounts for proportional actualAmount distribution
  const txnIds = reconRows
    .map((r) => r.transactionId)
    .filter((id): id is string => !!id);

  const txnAmounts = await db
    .select({ id: transactions.id, amount: transactions.amount })
    .from(transactions)
    .where(inArray(transactions.id, txnIds));

  const amtById = new Map(txnAmounts.map((t) => [t.id, Number(t.amount)]));
  const totalBankAmt = txnAmounts.reduce((s, t) => s + Number(t.amount), 0);
  const userShare = Number(swExp.userShare);

  // Delete old personal-expense rows
  await db
    .delete(reconciliations)
    .where(
      and(
        eq(reconciliations.userId, userId),
        inArray(reconciliations.id, body.reconIds),
      ),
    );

  // Create N:1 group — one row per bank txn, each pointing to the same SW expense
  const groupId = crypto.randomUUID();
  const manualReason: MatchReason[] = [
    { kind: "text", weight: 1, detail: "Manually grouped by user" },
  ];

  for (const row of reconRows) {
    const bankAmt = row.transactionId ? (amtById.get(row.transactionId) ?? 0) : 0;
    const proportion = totalBankAmt > 0 ? bankAmt / totalBankAmt : 1 / reconRows.length;
    const actualAmount = (userShare * proportion).toFixed(2);

    await db.insert(reconciliations).values({
      userId,
      transactionId: row.transactionId ?? null,
      splitwiseExpenseId: body.splitwiseExpenseId,
      actualAmount,
      reconciliationType: RECONCILIATION_TYPES.FRONTED_SHARED_EXPENSE,
      state: STATES.MANUAL_MATCH,
      confidence: null,
      matchReasons: manualReason,
      nmGroupId: groupId,
      linkedExpenses: null,
    });
  }

  return Response.json({ ok: true, groupId });
}
