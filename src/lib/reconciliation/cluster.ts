// N:M cluster detection for the reconciliation engine.
//
// Detects two shapes:
//   1:N  — one bank txn paid for multiple Splitwise entries
//           (e.g. one Costco charge split into "Groceries" + "Household" in SW)
//   N:1  — multiple bank txns from the same merchant map to one SW entry
//           (e.g. two Instacart orders matched by a single "Groceries" SW entry)
//
// The algorithm is intentionally conservative: it only fires when the sum of
// `paidByUser` amounts matches the bank total within AMOUNT_TOL_HARD, and only
// considers subsets of size 2–3 (large subsets explode combinatorially and are
// almost never the right answer in practice).
//
// All matched txns / expenses are marked in the returned `usedTxnIds` /
// `usedSwIds` sets so the engine's 1:1 loop can skip them.

import type { MatchReason } from "@/lib/db/schema";
import {
  AMOUNT_TOL_EXACT,
  AMOUNT_TOL_HARD,
  AMOUNT_TOL_SOFT,
  DATE_WINDOW_DAYS,
} from "./types";

export type ClusterBankTxn = {
  id: string;
  amount: string;
  date: string;
  name: string;
  isoCurrencyCode: string | null;
};

export type ClusterSwExpense = {
  id: string;
  cost: string;
  date: string;
  description: string | null;
  currencyCode: string | null;
  paidByUser: string;
  userShare: string;
};

export type NmCluster = {
  /** "1:N" = one bank txn → many SW expenses; "N:1" = many bank txns → one SW expense */
  shape: "1:N" | "N:1";
  bankTxns: ClusterBankTxn[];
  swExpenses: ClusterSwExpense[];
  /** Sum of all userShare values across every SW expense in this cluster. */
  actualAmount: number;
  confidence: number;
  reasons: MatchReason[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(a: string, b: string): number {
  return Math.round(
    Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000,
  );
}

function amountScore(diff: number): number {
  if (diff <= AMOUNT_TOL_EXACT) return 1;
  if (diff <= AMOUNT_TOL_SOFT) return 0.85;
  if (diff <= AMOUNT_TOL_HARD) return 0.35;
  return 0;
}

function dateScore(days: number): number {
  if (days === 0) return 1;
  if (days === 1) return 0.9;
  if (days <= DATE_WINDOW_DAYS) return 0.7;
  return 0;
}

/** Leading significant token (≥4 chars) from a txn name, lower-cased. */
function merchantKey(name: string): string {
  const tokens = name.toLowerCase().split(/[^a-z0-9]+/);
  return tokens.find((t) => t.length >= 4) ?? name.toLowerCase().slice(0, 8);
}

// ---------------------------------------------------------------------------
// 1:N detection — one bank txn paid for N Splitwise entries
// ---------------------------------------------------------------------------

function detect1N(
  txn: ClusterBankTxn,
  candidates: ClusterSwExpense[], // already filtered to date-window and paidByUser>0
): NmCluster | null {
  const txnAmt = Number(txn.amount);
  const n = candidates.length;

  // Try pairs first (size 2), then triples (size 3). Beyond that the
  // probability of a spurious sum-match grows too fast relative to benefit.
  for (let size = 2; size <= Math.min(3, n); size++) {
    const result = findSubset(txnAmt, candidates, size, txn.date);
    if (result) return { shape: "1:N", bankTxns: [txn], ...result };
  }
  return null;
}

function findSubset(
  targetAmt: number,
  candidates: ClusterSwExpense[],
  size: number,
  txnDate: string,
): Omit<NmCluster, "shape" | "bankTxns"> | null {
  const n = candidates.length;

  // Brute-force over C(n, size). Capped at size ≤ 3 so worst case is C(~10,3)=120.
  function combo(start: number, chosen: ClusterSwExpense[]): ClusterSwExpense[] | null {
    if (chosen.length === size) {
      const sum = chosen.reduce((s, e) => s + Number(e.paidByUser), 0);
      const diff = Math.abs(sum - targetAmt);
      if (diff <= AMOUNT_TOL_HARD) return chosen;
      return null;
    }
    for (let i = start; i < n; i++) {
      const r = combo(i + 1, [...chosen, candidates[i]]);
      if (r) return r;
    }
    return null;
  }

  const matched = combo(0, []);
  if (!matched) return null;

  const sum = matched.reduce((s, e) => s + Number(e.paidByUser), 0);
  const diff = Math.abs(sum - targetAmt);
  const aScore = amountScore(diff);

  const maxDays = Math.max(...matched.map((e) => daysBetween(txnDate, e.date)));
  const avgDays =
    matched.reduce((s, e) => s + daysBetween(txnDate, e.date), 0) /
    matched.length;
  const dScore = dateScore(Math.round(avgDays));

  const confidence = Number((aScore * 0.7 + dScore * 0.2).toFixed(4));

  const descriptions = matched
    .map((e) => e.description)
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");

  return {
    swExpenses: matched,
    actualAmount: matched.reduce((s, e) => s + Number(e.userShare), 0),
    confidence,
    reasons: [
      {
        kind: "amount",
        weight: 0.7,
        detail: `Cluster sum $${sum.toFixed(2)} ≈ bank $${targetAmt.toFixed(2)}${diff > AMOUNT_TOL_EXACT ? ` (off $${diff.toFixed(2)})` : ""}`,
      },
      {
        kind: "date",
        weight: 0.2,
        detail: `Within ${maxDays} day${maxDays !== 1 ? "s" : ""} of bank charge`,
      },
      ...(descriptions
        ? [
            {
              kind: "text" as const,
              weight: 0.1,
              detail: `SW entries: ${descriptions}`,
            },
          ]
        : []),
    ],
  };
}

// ---------------------------------------------------------------------------
// N:1 detection — N bank txns from the same merchant → one SW entry
// ---------------------------------------------------------------------------

function detectN1(
  txns: ClusterBankTxn[], // pre-grouped by merchant key, ≥2 items
  swExpenses: ClusterSwExpense[],
  usedSwIds: Set<string>,
): NmCluster | null {
  const n = txns.length;

  for (let size = 2; size <= Math.min(3, n); size++) {
    const result = findTxnSubset(txns, size, swExpenses, usedSwIds);
    if (result) return { shape: "N:1", ...result };
  }
  return null;
}

function findTxnSubset(
  txns: ClusterBankTxn[],
  size: number,
  swExpenses: ClusterSwExpense[],
  usedSwIds: Set<string>,
): Omit<NmCluster, "shape"> | null {
  const n = txns.length;

  function combo(start: number, chosen: ClusterBankTxn[]): Omit<NmCluster, "shape"> | null {
    if (chosen.length === size) {
      // Check date spread within window
      const dates = chosen.map((t) => new Date(t.date).getTime());
      const spread = Math.round(
        (Math.max(...dates) - Math.min(...dates)) / 86_400_000,
      );
      if (spread > DATE_WINDOW_DAYS) return null;

      const txnSum = chosen.reduce((s, t) => s + Number(t.amount), 0);
      const avgDate = new Date(
        dates.reduce((s, d) => s + d, 0) / dates.length,
      ).toISOString().slice(0, 10);

      // Find a matching SW expense
      for (const exp of swExpenses) {
        if (usedSwIds.has(exp.id)) continue;
        if (Number(exp.paidByUser) <= 0) continue;
        const diff = Math.abs(Number(exp.paidByUser) - txnSum);
        if (diff > AMOUNT_TOL_HARD) continue;
        const days = daysBetween(avgDate, exp.date);
        if (days > DATE_WINDOW_DAYS) continue;

        const aScore = amountScore(diff);
        const dScore = dateScore(days);
        const confidence = Number((aScore * 0.7 + dScore * 0.2).toFixed(4));

        return {
          bankTxns: chosen,
          swExpenses: [exp],
          actualAmount: Number(exp.userShare),
          confidence,
          reasons: [
            {
              kind: "amount",
              weight: 0.7,
              detail: `Txn sum $${txnSum.toFixed(2)} ≈ SW cost $${Number(exp.paidByUser).toFixed(2)}${diff > AMOUNT_TOL_EXACT ? ` (off $${diff.toFixed(2)})` : ""}`,
            },
            {
              kind: "date",
              weight: 0.2,
              detail: `Within ${Math.max(spread, days)} day${Math.max(spread, days) !== 1 ? "s" : ""}`,
            },
            ...(exp.description
              ? [
                  {
                    kind: "text" as const,
                    weight: 0.1,
                    detail: `SW: "${exp.description}"`,
                  },
                ]
              : []),
          ],
        };
      }
      return null;
    }

    for (let i = start; i < n; i++) {
      const r = combo(i + 1, [...chosen, txns[i]]);
      if (r) return r;
    }
    return null;
  }

  return combo(0, []);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function detectClusters(
  bankTxns: ClusterBankTxn[],
  swExpenses: ClusterSwExpense[],
): {
  clusters: NmCluster[];
  usedTxnIds: Set<string>;
  usedSwIds: Set<string>;
} {
  const usedTxnIds = new Set<string>();
  const usedSwIds = new Set<string>();
  const clusters: NmCluster[] = [];

  // --- 1:N pass ---
  for (const txn of bankTxns) {
    if (usedTxnIds.has(txn.id)) continue;

    const candidates = swExpenses.filter((exp) => {
      if (usedSwIds.has(exp.id)) return false;
      if (Number(exp.paidByUser) <= 0) return false;
      return daysBetween(txn.date, exp.date) <= DATE_WINDOW_DAYS;
    });

    if (candidates.length < 2) continue;

    const cluster = detect1N(txn, candidates);
    if (!cluster) continue;

    usedTxnIds.add(txn.id);
    for (const e of cluster.swExpenses) usedSwIds.add(e.id);
    clusters.push(cluster);
  }

  // --- N:1 pass ---
  // Group remaining (unclaimed) bank txns by merchant key.
  const byMerchant = new Map<string, ClusterBankTxn[]>();
  for (const txn of bankTxns) {
    if (usedTxnIds.has(txn.id)) continue;
    const key = merchantKey(txn.name);
    const arr = byMerchant.get(key) ?? [];
    arr.push(txn);
    byMerchant.set(key, arr);
  }

  for (const [, txns] of byMerchant) {
    if (txns.length < 2) continue;
    // Only consider txns not yet claimed.
    const available = txns.filter((t) => !usedTxnIds.has(t.id));
    if (available.length < 2) continue;

    const cluster = detectN1(available, swExpenses, usedSwIds);
    if (!cluster) continue;

    for (const t of cluster.bankTxns) usedTxnIds.add(t.id);
    for (const e of cluster.swExpenses) usedSwIds.add(e.id);
    clusters.push(cluster);
  }

  return { clusters, usedTxnIds, usedSwIds };
}
