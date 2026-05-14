import { db } from "@/lib/db";
import { plaidItems, reconciliations, transactions } from "@/lib/db/schema";
import {
  RECONCILIATION_TYPES,
  STATES,
} from "@/lib/reconciliation/types";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";

export type ReconSectionCounts = {
  matched: number;
  awaiting: number;
  splitwiseOnly: number;
  personal: number;
};

export async function computeReconSectionCounts(
  userId: string,
): Promise<ReconSectionCounts> {
  const rows = await db
    .select({
      reconciliationType: reconciliations.reconciliationType,
      state: reconciliations.state,
      count: sql<number>`count(*)::int`,
    })
    .from(reconciliations)
    .where(eq(reconciliations.userId, userId))
    .groupBy(reconciliations.reconciliationType, reconciliations.state);

  let matched = 0;
  let awaiting = 0;
  let splitwiseOnly = 0;
  let personal = 0;
  for (const r of rows) {
    if (r.state === STATES.PENDING) {
      awaiting += r.count;
      continue;
    }
    if (r.state === STATES.USER_REJECTED) continue;
    if (r.reconciliationType === RECONCILIATION_TYPES.SPLITWISE_ONLY) {
      splitwiseOnly += r.count;
    } else if (r.reconciliationType === RECONCILIATION_TYPES.PERSONAL_EXPENSE) {
      personal += r.count;
    } else if (
      r.state === STATES.AUTO_MATCHED ||
      r.state === STATES.USER_CONFIRMED ||
      r.state === STATES.MANUAL_MATCH
    ) {
      matched += r.count;
    }
  }
  return { matched, awaiting, splitwiseOnly, personal };
}

export type BankStats = {
  txnCount: number;
  lastSyncAt: Date | null;
};

// Per-plaid-item rollup used on the Accounts page. txnCount is the count of
// non-deleted transactions; lastSyncAt is the most recent createdAt across
// those rows (an indirect but accurate "last seen" signal — we don't track
// sync timestamps on plaid_item itself).
export async function computeBankStats(
  userId: string,
): Promise<Map<string, BankStats>> {
  const rows = await db
    .select({
      plaidItemId: transactions.plaidItemId,
      txnCount: sql<number>`count(*)::int`,
      lastSyncAt: sql<Date | null>`max(${transactions.createdAt})`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .groupBy(transactions.plaidItemId);

  const out = new Map<string, BankStats>();
  for (const r of rows) {
    out.set(r.plaidItemId, { txnCount: r.txnCount, lastSyncAt: r.lastSyncAt });
  }
  return out;
}

export async function findReauthInstitution(
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({
      institutionName: plaidItems.institutionName,
      errorCode: plaidItems.errorCode,
    })
    .from(plaidItems)
    .where(
      and(eq(plaidItems.userId, userId), isNotNull(plaidItems.errorCode)),
    )
    .limit(1);
  if (!row?.errorCode) return null;
  return row.institutionName ?? "your bank";
}
