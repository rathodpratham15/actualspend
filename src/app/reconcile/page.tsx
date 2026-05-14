import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  reconciliations,
  splitwiseExpenses,
  transactions,
  type MatchReason,
} from "@/lib/db/schema";
import {
  RECONCILIATION_TYPES,
  STATES,
} from "@/lib/reconciliation/types";
import { desc, eq } from "drizzle-orm";
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
  swDescription: string | null;
  swCost: string | null;
  swDate: string | null;
  swUserShare: string | null;
};

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
      swDescription: splitwiseExpenses.description,
      swCost: splitwiseExpenses.cost,
      swDate: splitwiseExpenses.date,
      swUserShare: splitwiseExpenses.userShare,
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

function Section({
  title,
  rows,
  showAmounts = true,
  showActions = false,
}: {
  title: string;
  rows: Row[];
  showAmounts?: boolean;
  showActions?: boolean;
}) {
  const total = rows.reduce((s, r) => s + Number(r.actualAmount), 0);
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title} <span className="ml-2 font-normal">({rows.length})</span>
        {showAmounts && rows.length > 0 && (
          <span className="ml-2 font-normal">· ${total.toFixed(2)} actual</span>
        )}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">None.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((r) => (
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
                  bank ${r.txnAmount ?? "—"} · sw ${r.swCost ?? "—"} · your share $
                  {r.swUserShare ?? "—"} · actual ${r.actualAmount}
                  {r.confidence && ` · ${(Number(r.confidence) * 100).toFixed(0)}%`}
                </div>
              </div>
              {r.matchReasons && r.matchReasons.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {r.matchReasons.map((reason, i) => (
                    <li key={i}>· {reason.detail}</li>
                  ))}
                </ul>
              )}
              {showActions && <ReconcileActionButtons id={r.recId} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function ReconcilePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const rows = await fetchRows(session.user.id);

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
            <div className="text-xl font-semibold">${bankRaw.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              Actual spend (engine output)
            </div>
            <div className="text-xl font-semibold">${actualSpend.toFixed(2)}</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Difference ${(bankRaw - actualSpend).toFixed(2)}. When positive, that's
          the slice of bank outflow that's actually other people's money
          flowing through your account. When negative, you owe more than you've
          spent through this account (e.g., cash dinners only Splitwise sees).
        </p>
      </section>

      <Section title="Matched (auto)" rows={matched} />
      <Section
        title="Reimbursements received"
        rows={reimbursed}
        showAmounts={false}
      />
      <Section title="Proposed (pending)" rows={proposed} showActions />
      <Section title="Confirmed (by you)" rows={confirmed} />
      <Section title="Splitwise-only (cash etc.)" rows={swOnly} />
      <Section
        title="Personal / unmatched"
        rows={personal}
        showAmounts={false}
      />
      <Section
        title="Rejected (won't be re-proposed)"
        rows={rejected}
        showAmounts={false}
      />
    </main>
  );
}
