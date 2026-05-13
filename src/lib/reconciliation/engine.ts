import { db } from "@/lib/db";
import {
  reconciliations,
  splitwiseExpenses,
  transactions,
  type MatchReason,
} from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  DATE_WINDOW_DAYS,
  RECONCILIATION_TYPES,
  STATES,
  THRESHOLDS,
  type ReconciliationState,
  type ReconciliationType,
} from "./types";
import { scoreCandidate } from "./score";

// Designed to be invoked any time fresh data arrives. Idempotent: rows that
// already have a reconciliation are left alone (we never overwrite a USER_*
// state silently; that's a re-decision flow the UI will own later).

type BankTxn = {
  id: string;
  amount: string;
  date: string;
  name: string;
  isoCurrencyCode: string | null;
};

type SwExpense = {
  id: string;
  cost: string;
  date: string;
  description: string | null;
  currencyCode: string | null;
  paidByUser: string;
  userShare: string;
};

export type ReconcileResult = {
  autoMatched: number;
  proposed: number;
  splitwiseOnly: number;
  unmatched: number;
};

// Wrapper struct so the engine's input/output shape is "groups" even when v1
// only ever packs one txn + one expense. Future N:M expansion just widens
// these arrays.
type Group = {
  transactions: BankTxn[];
  splitwiseExpenses: SwExpense[];
  reconciliationType: ReconciliationType;
  state: ReconciliationState;
  confidence: number | null;
  reasons: MatchReason[];
  actualAmount: number;
};

export async function reconcileForUser(
  userId: string,
): Promise<ReconcileResult> {
  // 1. Pull live bank outflows that aren't yet reconciled.
  const bankTxns = (await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      date: transactions.date,
      name: transactions.name,
      isoCurrencyCode: transactions.isoCurrencyCode,
    })
    .from(transactions)
    .leftJoin(
      reconciliations,
      eq(reconciliations.transactionId, transactions.id),
    )
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        isNull(reconciliations.id),
        sql`${transactions.amount}::numeric > 0`, // outflows only for v1
      ),
    )) as BankTxn[];

  // 2. Pull live Splitwise expenses where the user actually paid the bill
  //    (paid_by_user > 0). Those are the FRONTED_SHARED_EXPENSE candidates.
  const swExpenses = (await db
    .select({
      id: splitwiseExpenses.id,
      cost: splitwiseExpenses.cost,
      date: splitwiseExpenses.date,
      description: splitwiseExpenses.description,
      currencyCode: splitwiseExpenses.currencyCode,
      paidByUser: splitwiseExpenses.paidByUser,
      userShare: splitwiseExpenses.userShare,
    })
    .from(splitwiseExpenses)
    .where(
      and(
        eq(splitwiseExpenses.userId, userId),
        isNull(splitwiseExpenses.deletedAt),
        sql`${splitwiseExpenses.paidByUser}::numeric > 0`,
      ),
    )) as SwExpense[];

  const result: ReconcileResult = {
    autoMatched: 0,
    proposed: 0,
    splitwiseOnly: 0,
    unmatched: 0,
  };

  // 3. For each bank outflow, find the best Splitwise candidate.
  const claimedSwIds = new Set<string>();

  for (const txn of bankTxns) {
    const txnAmt = Number(txn.amount);
    let best: { exp: SwExpense; score: number; reasons: MatchReason[] } | null =
      null;

    for (const exp of swExpenses) {
      if (claimedSwIds.has(exp.id)) continue;
      // Quick prefilter: outside date window? skip without scoring.
      const days = Math.round(
        Math.abs(
          new Date(txn.date).getTime() - new Date(exp.date).getTime(),
        ) / 86_400_000,
      );
      if (days > DATE_WINDOW_DAYS) continue;

      const s = scoreCandidate(
        { amount: txnAmt, date: txn.date, name: txn.name },
        {
          cost: Number(exp.cost),
          date: exp.date,
          description: exp.description,
        },
      );
      if (s.score > (best?.score ?? 0)) {
        best = { exp, score: s.score, reasons: s.reasons };
      }
    }

    if (best && best.score >= THRESHOLDS.PROPOSE) {
      const isAuto = best.score >= THRESHOLDS.AUTO_MATCH;
      claimedSwIds.add(best.exp.id);
      const group: Group = {
        transactions: [txn],
        splitwiseExpenses: [best.exp],
        reconciliationType: RECONCILIATION_TYPES.FRONTED_SHARED_EXPENSE,
        state: isAuto ? STATES.AUTO_MATCHED : STATES.PENDING,
        confidence: best.score,
        reasons: best.reasons,
        // Your real share of this group purchase, not the full bank charge.
        actualAmount: Number(best.exp.userShare),
      };
      await writeGroup(userId, group);
      if (isAuto) result.autoMatched++;
      else result.proposed++;
    } else {
      // No Splitwise hit — bank-only personal expense (for v1). User can
      // later mark it shared manually; we don't pre-commit anything risky.
      await writeGroup(userId, {
        transactions: [txn],
        splitwiseExpenses: [],
        reconciliationType: RECONCILIATION_TYPES.PERSONAL_EXPENSE,
        state: STATES.AUTO_MATCHED,
        confidence: null,
        reasons: best
          ? [
              ...best.reasons,
              {
                kind: "amount",
                weight: 0,
                detail: `Best candidate scored ${best.score.toFixed(2)} — below propose threshold`,
              },
            ]
          : [
              {
                kind: "amount",
                weight: 0,
                detail: "No Splitwise candidate in date window",
              },
            ],
        actualAmount: txnAmt,
      });
      result.unmatched++;
    }
  }

  // 4. Any Splitwise expense the user paid but no bank match claimed = either
  //    cash (true SPLITWISE_ONLY) or a bank txn we missed. For now treat all
  //    of these as SPLITWISE_ONLY — they count toward actual spend.
  for (const exp of swExpenses) {
    if (claimedSwIds.has(exp.id)) continue;
    const existing = await db
      .select({ id: reconciliations.id })
      .from(reconciliations)
      .where(
        and(
          eq(reconciliations.userId, userId),
          eq(reconciliations.splitwiseExpenseId, exp.id),
          isNull(reconciliations.transactionId),
        ),
      )
      .limit(1);
    if (existing.length > 0) continue;

    await writeGroup(userId, {
      transactions: [],
      splitwiseExpenses: [exp],
      reconciliationType: RECONCILIATION_TYPES.SPLITWISE_ONLY,
      state: STATES.AUTO_MATCHED,
      confidence: null,
      reasons: [
        {
          kind: "amount",
          weight: 0,
          detail: "No bank transaction found within date window",
        },
      ],
      actualAmount: Number(exp.userShare),
    });
    result.splitwiseOnly++;
  }

  return result;
}

async function writeGroup(userId: string, g: Group) {
  // v1 always writes one row per group. Once N:M lands this becomes a
  // multi-row insert with a shared group_id.
  await db
    .insert(reconciliations)
    .values({
      userId,
      transactionId: g.transactions[0]?.id ?? null,
      splitwiseExpenseId: g.splitwiseExpenses[0]?.id ?? null,
      actualAmount: g.actualAmount.toFixed(2),
      reconciliationType: g.reconciliationType,
      state: g.state,
      confidence: g.confidence !== null ? g.confidence.toFixed(2) : null,
      matchReasons: g.reasons,
    })
    .onConflictDoNothing();
}
