import { auth } from "@/lib/auth";
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
import {
  RECONCILIATION_TYPES,
  STATES,
} from "@/lib/reconciliation/types";
import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { RunReconcileButton } from "@/components/run-reconcile-button";
import { ReconcileActionButtons } from "@/components/reconcile-action-buttons";

// Intentionally ugly. This page exists to inspect the engine's output on
// real data — it's not the eventual user-facing dashboard.

type Row = {
  recId: string;
  recType: string;
  state: string;
  actualAmount: string;
  confidence: string | null;
  matchReasons: MatchReason[] | null;
  createdAt: Date;
  txnName: string | null;
  txnAmount: string | null;
  txnDate: string | null;
  swExpenseId: string | null;
  swDescription: string | null;
  swCost: string | null;
  swDate: string | null;
  swUserShare: string | null;
  swPaidByUser: string | null;
  swIsPayment: boolean | null;
};

type ParticipantInfo = {
  payerName: string | null;
  payerIsSelf: boolean;
  otherNames: string[];
  otherCount: number;
  // First non-self participant who is owed money (used when user fronted).
  primaryOtherName: string | null;
};

function fmtUSD(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function joinNames(names: string[], max = 3): string {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  const list = shown.join(", ");
  return extra > 0 ? `${list} +${extra} more` : list;
}

async function fetchRows(userId: string): Promise<Row[]> {
  const rows = await db
    .select({
      recId: reconciliations.id,
      recType: reconciliations.reconciliationType,
      state: reconciliations.state,
      actualAmount: reconciliations.actualAmount,
      confidence: reconciliations.confidence,
      matchReasons: reconciliations.matchReasons,
      createdAt: reconciliations.createdAt,
      txnName: transactions.name,
      txnAmount: transactions.amount,
      txnDate: transactions.date,
      swExpenseId: splitwiseExpenses.id,
      swDescription: splitwiseExpenses.description,
      swCost: splitwiseExpenses.cost,
      swDate: splitwiseExpenses.date,
      swUserShare: splitwiseExpenses.userShare,
      swPaidByUser: splitwiseExpenses.paidByUser,
      swIsPayment: splitwiseExpenses.isPayment,
    })
    .from(reconciliations)
    .leftJoin(transactions, eq(transactions.id, reconciliations.transactionId))
    .leftJoin(
      splitwiseExpenses,
      eq(splitwiseExpenses.id, reconciliations.splitwiseExpenseId),
    )
    .where(eq(reconciliations.userId, userId))
    .orderBy(desc(reconciliations.createdAt));
  return rows as Row[];
}

async function fetchParticipantInfo(
  userId: string,
  rows: Row[],
): Promise<Map<string, ParticipantInfo>> {
  const expenseIds = Array.from(
    new Set(rows.map((r) => r.swExpenseId).filter((id): id is string => !!id)),
  );
  if (expenseIds.length === 0) return new Map();

  const [cred] = await db
    .select({ splitwiseUserId: splitwiseCredentials.splitwiseUserId })
    .from(splitwiseCredentials)
    .where(eq(splitwiseCredentials.userId, userId));
  const selfId = cred?.splitwiseUserId ?? null;

  const participants = await db
    .select({
      expenseId: splitwiseExpenseParticipants.expenseId,
      splitwiseUserId: splitwiseExpenseParticipants.splitwiseUserId,
      paidShare: splitwiseExpenseParticipants.paidShare,
      owedShare: splitwiseExpenseParticipants.owedShare,
    })
    .from(splitwiseExpenseParticipants)
    .where(inArray(splitwiseExpenseParticipants.expenseId, expenseIds));

  const friends = await db
    .select({
      splitwiseUserId: splitwiseFriends.splitwiseUserId,
      firstName: splitwiseFriends.firstName,
      lastName: splitwiseFriends.lastName,
    })
    .from(splitwiseFriends)
    .where(eq(splitwiseFriends.userId, userId));
  const nameMap = new Map(
    friends.map((f) => [
      f.splitwiseUserId,
      `${f.firstName ?? ""} ${f.lastName ?? ""}`.trim() ||
        `user ${f.splitwiseUserId}`,
    ]),
  );

  const byExpense = new Map<
    string,
    Array<{
      splitwiseUserId: number;
      paidShare: string;
      owedShare: string;
    }>
  >();
  for (const p of participants) {
    const arr = byExpense.get(p.expenseId) ?? [];
    arr.push({
      splitwiseUserId: p.splitwiseUserId,
      paidShare: p.paidShare,
      owedShare: p.owedShare,
    });
    byExpense.set(p.expenseId, arr);
  }

  const resolveName = (id: number): string => {
    if (selfId !== null && id === selfId) return "you";
    return nameMap.get(id) ?? `user ${id}`;
  };

  const out = new Map<string, ParticipantInfo>();
  for (const [expenseId, ps] of byExpense) {
    const payer = ps.find((p) => Number(p.paidShare) > 0) ?? null;
    const payerIsSelf =
      payer !== null && selfId !== null && payer.splitwiseUserId === selfId;
    const payerName = payer ? resolveName(payer.splitwiseUserId) : null;

    const nonSelfNonPayer = ps
      .filter((p) => !payer || p.splitwiseUserId !== payer.splitwiseUserId)
      .filter((p) => !(selfId !== null && p.splitwiseUserId === selfId));

    const others = nonSelfNonPayer.map((p) => resolveName(p.splitwiseUserId));

    // For the "owed back" UI: when the user is the payer, the primary
    // counterparty is whoever owes the most.
    let primaryOtherName: string | null = null;
    if (payerIsSelf) {
      const sorted = [...nonSelfNonPayer].sort(
        (a, b) => Number(b.owedShare) - Number(a.owedShare),
      );
      if (sorted.length > 0) {
        primaryOtherName = resolveName(sorted[0].splitwiseUserId);
      }
    }

    out.set(expenseId, {
      payerName,
      payerIsSelf,
      otherNames: others,
      otherCount: others.length,
      primaryOtherName,
    });
  }
  return out;
}

function renderParticipants(
  info: ParticipantInfo | undefined,
  isPayment: boolean,
): string | null {
  if (!info || !info.payerName) return null;
  if (isPayment) {
    if (info.payerIsSelf) {
      return info.otherNames.length > 0
        ? `You paid ${joinNames(info.otherNames)}`
        : "You made a payment";
    }
    return `${info.payerName} paid you`;
  }
  if (info.payerIsSelf) {
    return info.otherCount > 0
      ? `You paid · split with ${joinNames(info.otherNames)}`
      : "You paid · no other participants";
  }
  return info.otherCount > 0
    ? `${info.payerName} paid · split with you and ${joinNames(info.otherNames)}`
    : `${info.payerName} paid · split with you`;
}

// Right-side amount line. Replaces the old terse "bank $X · sw $X · your
// share $X · actual $X" with something the user can read.
function renderAmounts(r: Row, info: ParticipantInfo | undefined): string {
  const bill = r.swCost ? Number(r.swCost) : r.txnAmount ? Math.abs(Number(r.txnAmount)) : null;
  const yourPortion = r.swUserShare ? Number(r.swUserShare) : null;
  const paidByYou = r.swPaidByUser ? Number(r.swPaidByUser) : null;

  // Reimbursement received: inflow undoes prior spend.
  if (r.recType === RECONCILIATION_TYPES.REIMBURSEMENT_RECEIVED) {
    const amt = r.txnAmount ? Math.abs(Number(r.txnAmount)) : null;
    if (amt !== null) return `Received ${fmtUSD(amt)}`;
  }

  // Personal expense: full bank charge, no split.
  if (r.recType === RECONCILIATION_TYPES.PERSONAL_EXPENSE) {
    const amt = r.txnAmount ? Math.abs(Number(r.txnAmount)) : null;
    if (amt !== null) return `Bill ${fmtUSD(amt)} · Your portion ${fmtUSD(amt)}`;
    return "";
  }

  // Splitwise-only or fronted shared: surface bill + portions + counterparty.
  const parts: string[] = [];
  if (bill !== null) parts.push(`Bill ${fmtUSD(bill)}`);
  if (yourPortion !== null) parts.push(`Your portion ${fmtUSD(yourPortion)}`);

  // If user paid: show what others collectively owe them.
  if (paidByYou !== null && yourPortion !== null && paidByYou > yourPortion) {
    const othersOwe = paidByYou - yourPortion;
    if (info?.primaryOtherName && info.otherCount === 1) {
      parts.push(`${info.primaryOtherName} owes you ${fmtUSD(othersOwe)}`);
    } else if (info?.otherCount && info.otherCount > 1) {
      parts.push(`Others owe you ${fmtUSD(othersOwe)}`);
    } else {
      parts.push(`Others owe you ${fmtUSD(othersOwe)}`);
    }
  }

  // If someone else paid: show what user owes that person.
  if (
    paidByYou !== null &&
    paidByYou === 0 &&
    yourPortion !== null &&
    yourPortion > 0 &&
    info?.payerName &&
    !info.payerIsSelf
  ) {
    parts.push(`You owe ${info.payerName} ${fmtUSD(yourPortion)}`);
  }

  if (r.confidence) {
    parts.push(`${(Number(r.confidence) * 100).toFixed(0)}% confidence`);
  }

  return parts.join(" · ");
}

// Replace the engine's generic neutral phrasing with something contextual
// when we can. Falls back to the original reason text.
function rewriteReason(
  reason: MatchReason,
  r: Row,
  info: ParticipantInfo | undefined,
): string {
  if (reason.detail === "Splitwise-only entry · no matching bank charge") {
    if (
      r.swPaidByUser &&
      Number(r.swPaidByUser) > 0 &&
      info?.primaryOtherName &&
      info?.otherCount === 1
    ) {
      return `Awaiting reimbursement from ${info.primaryOtherName}`;
    }
    if (
      r.swPaidByUser &&
      Number(r.swPaidByUser) > 0 &&
      info?.otherCount &&
      info.otherCount > 1
    ) {
      return "Awaiting reimbursement from the group";
    }
    if (r.swIsPayment) {
      return info?.payerIsSelf
        ? "Settlement payment from your side"
        : "Settlement payment received";
    }
    return "Not matched to a bank transaction";
  }
  return reason.detail;
}

function Section({
  title,
  rows,
  participants,
  showAmounts = true,
  showActions = false,
}: {
  title: string;
  rows: Row[];
  participants: Map<string, ParticipantInfo>;
  showAmounts?: boolean;
  showActions?: boolean;
}) {
  const total = rows.reduce((s, r) => s + Number(r.actualAmount), 0);
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title} <span className="ml-2 font-normal">({rows.length})</span>
        {showAmounts && rows.length > 0 && (
          <span className="ml-2 font-normal">
            · {fmtUSD(total)} counted as your spend
          </span>
        )}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">None.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((r) => {
            const info = r.swExpenseId
              ? participants.get(r.swExpenseId)
              : undefined;
            return (
              <li
                key={r.recId}
                className="rounded-md border border-border bg-card p-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    {r.txnName && (
                      <span className="font-medium">{r.txnName}</span>
                    )}
                    {r.txnName && r.swDescription && (
                      <span className="mx-2 text-muted-foreground">↔</span>
                    )}
                    {r.swDescription && (
                      <span className="font-medium">{r.swDescription}</span>
                    )}
                    {!r.txnName && !r.swDescription && (
                      <span className="italic text-muted-foreground">
                        (no description)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {renderAmounts(r, info)}
                  </div>
                </div>
                {r.swExpenseId &&
                  (() => {
                    const line = renderParticipants(
                      info,
                      r.swIsPayment ?? false,
                    );
                    return line ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {line}
                      </p>
                    ) : null;
                  })()}
                {r.matchReasons && r.matchReasons.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {r.matchReasons.map((reason, i) => (
                      <li key={i}>· {rewriteReason(reason, r, info)}</li>
                    ))}
                  </ul>
                )}
                {showActions && <ReconcileActionButtons id={r.recId} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default async function ReconcilePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const rows = await fetchRows(session.user.id);
  const participants = await fetchParticipantInfo(session.user.id, rows);

  const matched = rows.filter(
    (r) =>
      r.recType === RECONCILIATION_TYPES.FRONTED_SHARED_EXPENSE &&
      r.state === STATES.AUTO_MATCHED,
  );
  const reimbursed = rows.filter(
    (r) =>
      r.recType === RECONCILIATION_TYPES.REIMBURSEMENT_RECEIVED &&
      r.state === STATES.AUTO_MATCHED,
  );
  const proposed = rows.filter((r) => r.state === STATES.PENDING);
  const confirmed = rows.filter((r) => r.state === STATES.USER_CONFIRMED);
  const rejected = rows.filter((r) => r.state === STATES.USER_REJECTED);
  const swOnly = rows.filter(
    (r) => r.recType === RECONCILIATION_TYPES.SPLITWISE_ONLY,
  );
  const personal = rows.filter(
    (r) =>
      r.recType === RECONCILIATION_TYPES.PERSONAL_EXPENSE &&
      r.state !== STATES.USER_REJECTED,
  );

  const actualSpend =
    matched.reduce((s, r) => s + Number(r.actualAmount), 0) +
    swOnly.reduce((s, r) => s + Number(r.actualAmount), 0) +
    personal.reduce((s, r) => s + Number(r.actualAmount), 0);

  const bankRaw = [...matched, ...personal].reduce(
    (s, r) => s + Number(r.txnAmount ?? 0),
    0,
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">
          Reconciliation debug
        </h1>
        <Link
          href="/"
          className="text-sm text-muted-foreground underline hover:text-foreground"
        >
          ← Home
        </Link>
      </div>

      <div className="mt-6">
        <RunReconcileButton />
      </div>

      <section className="mt-8 rounded-md border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Summary (within bank coverage)
        </div>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Bank raw outflow</div>
            <div className="text-xl font-semibold">{fmtUSD(bankRaw)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              Actual spend (engine output)
            </div>
            <div className="text-xl font-semibold">{fmtUSD(actualSpend)}</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Difference {fmtUSD(bankRaw - actualSpend)}. When positive, that&apos;s
          the slice of bank outflow that&apos;s actually other people&apos;s
          money flowing through your account. When negative, you owe more than
          you&apos;ve spent through this account (e.g., cash dinners only
          Splitwise sees).
        </p>
      </section>

      <Section
        title="Matched (auto)"
        rows={matched}
        participants={participants}
      />
      <Section
        title="Reimbursements received"
        rows={reimbursed}
        participants={participants}
        showAmounts={false}
      />
      <Section
        title="Proposed (pending)"
        rows={proposed}
        participants={participants}
        showActions
      />
      <Section
        title="Confirmed (by you)"
        rows={confirmed}
        participants={participants}
      />
      <Section
        title="Splitwise-only (cash etc.)"
        rows={swOnly}
        participants={participants}
      />
      <Section
        title="Personal / unmatched"
        rows={personal}
        participants={participants}
        showAmounts={false}
      />
      <Section
        title="Rejected (won't be re-proposed)"
        rows={rejected}
        participants={participants}
        showAmounts={false}
      />
    </main>
  );
}
