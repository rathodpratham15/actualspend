import { desc, eq, inArray } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  plaidItems,
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
import { usd, dateShort } from "@/lib/format";
import type { ReconciliationPair } from "@/lib/seed";

import { AppHeader } from "@/components/app-header";
import { ReconSection } from "@/components/recon-section";
import { ReconAwaitingCard } from "@/components/recon-awaiting-card";
import { SubtractionBlock } from "@/components/subtraction-block";
import { RunReconcileButton } from "@/components/run-reconcile-button";

type Row = {
  recId: string;
  recType: string;
  state: string;
  actualAmount: string;
  confidence: string | null;
  matchReasons: MatchReason[] | null;
  txnName: string | null;
  txnAmount: string | null;
  txnDate: string | null;
  institutionName: string | null;
  swExpenseId: string | null;
  swDescription: string | null;
  swCost: string | null;
  swDate: string | null;
  swUserShare: string | null;
};

type ParticipantInfo = {
  names: string[];
  totalCount: number;
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
      txnName: transactions.name,
      txnAmount: transactions.amount,
      txnDate: transactions.date,
      institutionName: plaidItems.institutionName,
      swExpenseId: splitwiseExpenses.id,
      swDescription: splitwiseExpenses.description,
      swCost: splitwiseExpenses.cost,
      swDate: splitwiseExpenses.date,
      swUserShare: splitwiseExpenses.userShare,
    })
    .from(reconciliations)
    .leftJoin(transactions, eq(transactions.id, reconciliations.transactionId))
    .leftJoin(plaidItems, eq(plaidItems.id, transactions.plaidItemId))
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

  const out = new Map<string, ParticipantInfo>();
  for (const p of participants) {
    if (selfId !== null && p.splitwiseUserId === selfId) continue;
    const entry = out.get(p.expenseId) ?? { names: [], totalCount: 0 };
    entry.names.push(
      nameMap.get(p.splitwiseUserId) ?? `user ${p.splitwiseUserId}`,
    );
    entry.totalCount++;
    out.set(p.expenseId, entry);
  }
  return out;
}

function groupLabel(info: ParticipantInfo | undefined): string {
  if (!info || info.totalCount === 0) return "Splitwise expense";
  const shown = info.names.slice(0, 2);
  const extra = info.totalCount - shown.length;
  return `Split with ${shown.join(", ")}${extra > 0 ? ` +${extra}` : ""}`;
}

// Map a server-side reconciliation row into the shape ReconCard expects.
// Plaid stores positive amounts as outflows; ReconCard displays via usd()
// which prepends "−" for negatives — so we negate before passing.
function toPair(r: Row, participants: Map<string, ParticipantInfo>): ReconciliationPair {
  const info = r.swExpenseId ? participants.get(r.swExpenseId) : undefined;
  return {
    id: r.recId,
    bank: {
      date: r.txnDate ?? "",
      merchant: r.txnName ?? "(no description)",
      account: r.institutionName ?? "Bank",
      amount: r.txnAmount ? -Number(r.txnAmount) : 0,
    },
    splitwise: {
      title: r.swDescription ?? "(no description)",
      group: groupLabel(info),
      total: r.swCost ? Number(r.swCost) : 0,
      yourShare: r.swUserShare ? Number(r.swUserShare) : 0,
      people: (info?.totalCount ?? 0) + 1,
    },
    confidence: r.confidence ? Math.round(Number(r.confidence) * 100) : 0,
    reasons: (r.matchReasons ?? []).map((reason) => reason.detail),
  };
}

export default async function ReconcilePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const rows = await fetchRows(session.user.id);
  const participants = await fetchParticipantInfo(session.user.id, rows);

  const awaiting = rows.filter((r) => r.state === STATES.PENDING);
  const matched = rows.filter(
    (r) =>
      r.state !== STATES.PENDING &&
      r.state !== STATES.USER_REJECTED &&
      (r.recType === RECONCILIATION_TYPES.FRONTED_SHARED_EXPENSE ||
        r.recType === RECONCILIATION_TYPES.REIMBURSEMENT_RECEIVED ||
        r.recType === RECONCILIATION_TYPES.REIMBURSEMENT_SENT) &&
      r.txnAmount !== null &&
      r.swExpenseId !== null,
  );
  const splitwiseOnly = rows.filter(
    (r) =>
      r.recType === RECONCILIATION_TYPES.SPLITWISE_ONLY &&
      r.state !== STATES.USER_REJECTED,
  );
  const personal = rows.filter(
    (r) =>
      r.recType === RECONCILIATION_TYPES.PERSONAL_EXPENSE &&
      r.state !== STATES.USER_REJECTED,
  );

  const totalActual = [...matched, ...splitwiseOnly, ...personal].reduce(
    (s, r) => s + Number(r.actualAmount),
    0,
  );
  const totalBank = [...matched, ...personal].reduce(
    (s, r) => s + Number(r.txnAmount ?? 0),
    0,
  );
  const sharedAdjustments = totalBank - totalActual;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />

      <main className="max-w-3xl mx-auto px-6 pt-10 pb-24">
        <div className="flex items-center justify-between">
          <h1 className="text-xl tracking-tight font-medium">Review</h1>
          <RunReconcileButton />
        </div>

        <div className="mt-8 bg-surface border border-border rounded-xl p-6">
          <SubtractionBlock
            bank={totalBank}
            shared={Math.max(0, sharedAdjustments)}
            actual={totalActual}
            bankLabel="Bank outflow (covered)"
            sharedLabel="Shared adjustments"
            actualLabel="Actual spend"
            decimals={0}
          />
          <div className="mt-6 text-sm text-secondary leading-relaxed">
            {sharedAdjustments > 0
              ? "Most of the difference comes from shared expenses you initially paid for."
              : sharedAdjustments < 0
                ? "You owe more than you've spent through this account — Splitwise sees expenses your bank doesn't."
                : "Nothing pass-through detected in this period."}
          </div>
        </div>

        <ReconSection
          title="Awaiting your review"
          count={awaiting.length}
          defaultOpen
        >
          {awaiting.length === 0 ? (
            <p className="text-sm text-secondary">Nothing to review.</p>
          ) : (
            awaiting.map((r) => (
              <ReconAwaitingCard key={r.recId} pair={toPair(r, participants)} />
            ))
          )}
        </ReconSection>

        <ReconSection title="Matched automatically" count={matched.length}>
          {matched.length === 0 ? (
            <p className="text-sm text-secondary">No matches yet.</p>
          ) : (
            matched.map((r) => (
              <div
                key={r.recId}
                data-testid={`matched-${r.recId}`}
                className="bg-surface border border-border border-l-2 border-l-[var(--emerald)] rounded-xl p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-mono text-secondary">
                      {r.txnDate ? dateShort(r.txnDate) : "—"}
                    </div>
                    <div className="text-[15px]">
                      {r.txnName ?? "(no description)"}
                    </div>
                    <div className="text-xs text-secondary mt-1">
                      {r.swDescription ?? ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">
                      {usd(-Number(r.txnAmount ?? 0), { decimals: 2 })}
                    </div>
                    <div className="font-mono text-xs text-secondary mt-1">
                      {r.confidence
                        ? `${Math.round(Number(r.confidence) * 100)}%`
                        : ""}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </ReconSection>

        <ReconSection title="Splitwise-only" count={splitwiseOnly.length}>
          {splitwiseOnly.length === 0 ? (
            <p className="text-sm text-secondary">None.</p>
          ) : (
            splitwiseOnly.map((r) => (
              <div
                key={r.recId}
                data-testid={`splitwise-only-${r.recId}`}
                className="bg-surface border border-border border-l-2 border-l-[var(--border)] rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[15px]">
                      {r.swDescription ?? "(no description)"}
                    </div>
                    <div className="text-xs text-secondary mt-1">
                      {groupLabel(
                        r.swExpenseId ? participants.get(r.swExpenseId) : undefined,
                      )}
                    </div>
                  </div>
                  <div className="font-mono text-sm">
                    {usd(Number(r.swUserShare ?? 0), { decimals: 2 })}
                  </div>
                </div>
              </div>
            ))
          )}
        </ReconSection>

        <ReconSection title="Personal / unmatched" count={personal.length}>
          {personal.length === 0 ? (
            <p className="text-sm text-secondary">None.</p>
          ) : (
            personal.map((r) => (
              <div
                key={r.recId}
                data-testid={`personal-${r.recId}`}
                className="bg-surface border border-border rounded-xl p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-mono text-secondary">
                      {r.txnDate ? dateShort(r.txnDate) : "—"}
                    </div>
                    <div className="text-[15px]">
                      {r.txnName ?? "(no description)"}
                    </div>
                  </div>
                  <div className="font-mono text-sm">
                    {usd(-Number(r.txnAmount ?? 0), { decimals: 2 })}
                  </div>
                </div>
              </div>
            ))
          )}
        </ReconSection>
      </main>
    </div>
  );
}
