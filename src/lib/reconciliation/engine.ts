import { db } from "@/lib/db";
import {
  reconciliations,
  splitwiseCredentials,
  splitwiseExpenseParticipants,
  splitwiseExpenses,
  splitwiseFriends,
  transactions,
  type MatchReason,
} from "@/lib/db/schema";
import { and, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  DATE_WINDOW_DAYS,
  RECONCILIATION_TYPES,
  STATES,
  THRESHOLDS,
  type ReconciliationState,
  type ReconciliationType,
} from "./types";
import { scoreCandidate } from "./score";
import { recategorizeUserTransactions } from "@/lib/plaid/recategorize";

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
  reimbursementsAuto: number;
  reimbursementsProposed: number;
  unmatchedInflows: number;
  coverageStart: string | null;
  coverageEnd: string | null;
  swSkippedOutOfWindow: number;
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

// States the user has personally decided on. Preserved across engine rebuilds;
// the engine never overwrites these.
const USER_OWNED_STATES = [
  STATES.USER_CONFIRMED,
  STATES.USER_REJECTED,
  STATES.MANUAL_MATCH,
  STATES.IGNORED,
];

export async function reconcileForUser(
  userId: string,
): Promise<ReconcileResult> {
  // Reapply the latest PFC → canonical mapping to all transactions before
  // reconciling. Keeps the dashboard breakdown current as the mapping table
  // evolves, without requiring re-syncs from Plaid.
  await recategorizeUserTransactions(userId);

  // Preserve user-decided rows; wipe everything the engine wrote itself.
  const preserved = await db
    .select({
      id: reconciliations.id,
      transactionId: reconciliations.transactionId,
      splitwiseExpenseId: reconciliations.splitwiseExpenseId,
      state: reconciliations.state,
    })
    .from(reconciliations)
    .where(
      and(
        eq(reconciliations.userId, userId),
        inArray(reconciliations.state, USER_OWNED_STATES),
      ),
    );

  // Txns the engine should NOT touch this run: anything carried by a
  // preserved row (USER_CONFIRMED/REJECTED/MANUAL_MATCH/IGNORED).
  const lockedTxnIds = new Set(
    preserved.map((p) => p.transactionId).filter((id): id is string => !!id),
  );
  // Splitwise expenses already claimed by a user decision (confirmed or
  // manually matched) — those are off the candidate market. Rejected pairs
  // don't claim the expense, only the txn.
  const claimedSwIdsByUser = new Set(
    preserved
      .filter(
        (p) =>
          p.state === STATES.USER_CONFIRMED ||
          p.state === STATES.MANUAL_MATCH,
      )
      .map((p) => p.splitwiseExpenseId)
      .filter((id): id is string => !!id),
  );
  // (Future: rejectedPairs set keyed by `${txnId}::${sweId}` so re-running
  // after data changes can re-propose for the same txn against a different
  // Splitwise expense. v1 keeps the simpler "rejection locks the txn"
  // behavior via lockedTxnIds above.)

  // Wipe engine-owned rows. User-owned rows (matched by inArray on
  // USER_OWNED_STATES) are preserved.
  await db
    .delete(reconciliations)
    .where(
      and(
        eq(reconciliations.userId, userId),
        or(
          eq(reconciliations.state, STATES.AUTO_MATCHED),
          eq(reconciliations.state, STATES.PENDING),
        )!,
      ),
    );

  // 1. Pull live bank outflows. We pull ALL of them first so the coverage
  // window calc reflects the full bank reality, then filter out user-locked
  // txns before scoring.
  const allBankTxns = (await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      date: transactions.date,
      name: transactions.name,
      isoCurrencyCode: transactions.isoCurrencyCode,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        sql`${transactions.amount}::numeric > 0`, // outflows only for v1
      ),
    )) as BankTxn[];

  const bankTxns = allBankTxns.filter((t) => !lockedTxnIds.has(t.id));

  // 2. Determine the bank's coverage window. Splitwise expenses outside this
  // window can't meaningfully be reconciled — there's no bank reality on
  // either side of the window to compare to — so we drop them silently from
  // "actual spend." This is critical when Splitwise pre-dates the bank link
  // (common during sandbox testing or onboarding).
  let coverageStart: string | null = null;
  let coverageEnd: string | null = null;
  if (allBankTxns.length > 0) {
    const sortedDates = allBankTxns
      .map((t) => t.date)
      .sort((a, b) => a.localeCompare(b));
    coverageStart = sortedDates[0];
    coverageEnd = sortedDates[sortedDates.length - 1];
  }

  // 3. Pull Splitwise expenses where the user paid, scoped to the bank window
  // and excluding any already claimed by a user-confirmed / manual match.
  const swExpensesRaw =
    coverageStart && coverageEnd
      ? ((await db
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
              gte(splitwiseExpenses.date, coverageStart),
              lte(splitwiseExpenses.date, coverageEnd),
            ),
          )) as SwExpense[])
      : [];
  const swExpenses = swExpensesRaw.filter(
    (e) => !claimedSwIdsByUser.has(e.id),
  );

  // Track how many Splitwise rows we skipped so the debug view can explain it.
  let swSkippedOutOfWindow = 0;
  if (coverageStart && coverageEnd) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(splitwiseExpenses)
      .where(
        and(
          eq(splitwiseExpenses.userId, userId),
          isNull(splitwiseExpenses.deletedAt),
          sql`${splitwiseExpenses.paidByUser}::numeric > 0`,
          sql`(${splitwiseExpenses.date} < ${coverageStart} OR ${splitwiseExpenses.date} > ${coverageEnd})`,
        ),
      );
    swSkippedOutOfWindow = count;
  }

  // 3b. Pull bank inflows (Plaid convention: negative amount) in the same
  // coverage window. Filter out locked txns. Inflows are matched against
  // Splitwise PAYMENT records (is_payment = true) where the user is on the
  // receiving end (paid_by_user = 0, user_share > 0).
  const allInflows = (await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      date: transactions.date,
      name: transactions.name,
      isoCurrencyCode: transactions.isoCurrencyCode,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        sql`${transactions.amount}::numeric < 0`,
      ),
    )) as BankTxn[];
  const inflows = allInflows.filter((t) => !lockedTxnIds.has(t.id));

  const paymentRecords =
    coverageStart && coverageEnd
      ? ((await db
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
              eq(splitwiseExpenses.isPayment, true),
              sql`${splitwiseExpenses.paidByUser}::numeric = 0`,
              sql`${splitwiseExpenses.userShare}::numeric > 0`,
              gte(splitwiseExpenses.date, coverageStart),
              lte(splitwiseExpenses.date, coverageEnd),
            ),
          )) as SwExpense[])
      : [];
  const paymentCandidates = paymentRecords.filter(
    (e) => !claimedSwIdsByUser.has(e.id),
  );

  // Build a payment-id → payer display name map. We use the friend table to
  // resolve splitwise_user_id → first_name; that name then gets fed as the
  // "description" when scoring an inflow against the payment, so the
  // existing text-overlap component in scoreCandidate fires when the bank
  // description includes "VENMO FROM BOB" against a friend named Bob.
  const payerNameByExpenseId = new Map<string, string>();
  if (paymentCandidates.length > 0) {
    const [selfCred] = await db
      .select({ splitwiseUserId: splitwiseCredentials.splitwiseUserId })
      .from(splitwiseCredentials)
      .where(eq(splitwiseCredentials.userId, userId));
    const selfId = selfCred?.splitwiseUserId ?? null;

    const parts = await db
      .select({
        expenseId: splitwiseExpenseParticipants.expenseId,
        splitwiseUserId: splitwiseExpenseParticipants.splitwiseUserId,
        paidShare: splitwiseExpenseParticipants.paidShare,
      })
      .from(splitwiseExpenseParticipants)
      .where(
        inArray(
          splitwiseExpenseParticipants.expenseId,
          paymentCandidates.map((p) => p.id),
        ),
      );

    const friends = await db
      .select({
        splitwiseUserId: splitwiseFriends.splitwiseUserId,
        firstName: splitwiseFriends.firstName,
        lastName: splitwiseFriends.lastName,
      })
      .from(splitwiseFriends)
      .where(eq(splitwiseFriends.userId, userId));
    const nameById = new Map(
      friends.map((f) => [
        f.splitwiseUserId,
        `${f.firstName ?? ""} ${f.lastName ?? ""}`.trim(),
      ]),
    );

    for (const p of parts) {
      if (Number(p.paidShare) <= 0) continue;
      if (selfId !== null && p.splitwiseUserId === selfId) continue;
      const name = nameById.get(p.splitwiseUserId);
      if (name) payerNameByExpenseId.set(p.expenseId, name);
    }
  }

  const result: ReconcileResult = {
    autoMatched: 0,
    proposed: 0,
    splitwiseOnly: 0,
    unmatched: 0,
    reimbursementsAuto: 0,
    reimbursementsProposed: 0,
    unmatchedInflows: 0,
    coverageStart,
    coverageEnd,
    swSkippedOutOfWindow,
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

  // 3c. Inflow pass — match bank inflows against Splitwise payment records
  // (someone paid the user back). Score using the same function; treat the
  // inflow's magnitude as the bank amount. Reimbursements set
  // actual_amount = 0 (the inflow cancels prior spend, no new spend).
  const claimedPaymentSwIds = new Set<string>();
  for (const inflow of inflows) {
    const inflowMagnitude = Math.abs(Number(inflow.amount));
    let best:
      | { exp: SwExpense; score: number; reasons: MatchReason[] }
      | null = null;

    for (const exp of paymentCandidates) {
      if (claimedPaymentSwIds.has(exp.id)) continue;
      const days = Math.round(
        Math.abs(
          new Date(inflow.date).getTime() - new Date(exp.date).getTime(),
        ) / 86_400_000,
      );
      if (days > DATE_WINDOW_DAYS) continue;

      // Smart match: feed the payer's name as the "description" so the
      // text-overlap component fires when the bank inflow name (e.g.
      // "VENMO FROM BOB SMITH") includes the friend's first/last name.
      // Falls back to the Splitwise description (usually just "Payment")
      // when the payer can't be resolved.
      const payerName = payerNameByExpenseId.get(exp.id);
      const swText = payerName || exp.description;

      const s = scoreCandidate(
        { amount: inflowMagnitude, date: inflow.date, name: inflow.name },
        {
          // Match against the user's owed share — that's the amount the
          // payment record represents for our user.
          cost: Number(exp.userShare),
          date: exp.date,
          description: swText,
        },
      );
      if (s.score > (best?.score ?? 0)) {
        best = { exp, score: s.score, reasons: s.reasons };
      }
    }

    if (best && best.score >= THRESHOLDS.PROPOSE) {
      const isAuto = best.score >= THRESHOLDS.AUTO_MATCH;
      claimedPaymentSwIds.add(best.exp.id);
      await writeGroup(userId, {
        transactions: [inflow],
        splitwiseExpenses: [best.exp],
        reconciliationType: RECONCILIATION_TYPES.REIMBURSEMENT_RECEIVED,
        state: isAuto ? STATES.AUTO_MATCHED : STATES.PENDING,
        confidence: best.score,
        reasons: best.reasons,
        // Reimbursements don't add to actual spend — they unwind a prior
        // outflow. Track 0 here so summing actualAmount stays correct.
        actualAmount: 0,
      });
      if (isAuto) result.reimbursementsAuto++;
      else result.reimbursementsProposed++;
    } else {
      // Inflow with no Splitwise counterpart. Could be a paycheck, transfer
      // from yourself, or an un-recorded reimbursement. We don't write a
      // reconciliation row for unmatched inflows in v1 — they're just
      // ignored by the actual-spend math (because they're inflows).
      result.unmatchedInflows++;
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
