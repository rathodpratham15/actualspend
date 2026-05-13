import type { MatchReason } from "@/lib/db/schema";
import {
  AMOUNT_TOL_EXACT,
  AMOUNT_TOL_HARD,
  AMOUNT_TOL_SOFT,
  DATE_WINDOW_DAYS,
} from "./types";

// Scoring is intentionally explicit and inspectable: each signal contributes a
// 0–1 value with a known weight, and we keep the reasons so the UI can render
// them later. Amount is the trust anchor — a strong amount mismatch zeroes the
// whole score even if date/text look good.

const W_AMOUNT = 0.7;
const W_DATE = 0.2;
const W_TEXT = 0.1;

export type CandidateScore = {
  score: number;
  reasons: MatchReason[];
};

function scoreAmount(
  bankAmount: number,
  splitwiseTotal: number,
): { value: number; reason: MatchReason } {
  const diff = Math.abs(bankAmount - splitwiseTotal);
  if (diff <= AMOUNT_TOL_EXACT) {
    return {
      value: 1,
      reason: {
        kind: "amount",
        weight: W_AMOUNT,
        detail: `Exact match ($${bankAmount.toFixed(2)})`,
      },
    };
  }
  if (diff <= AMOUNT_TOL_SOFT) {
    return {
      value: 0.85,
      reason: {
        kind: "amount",
        weight: W_AMOUNT,
        detail: `Within $${diff.toFixed(2)}`,
      },
    };
  }
  if (diff <= AMOUNT_TOL_HARD) {
    return {
      value: 0.35,
      reason: {
        kind: "amount",
        weight: W_AMOUNT,
        detail: `Off by $${diff.toFixed(2)}`,
      },
    };
  }
  return {
    value: 0,
    reason: {
      kind: "amount",
      weight: W_AMOUNT,
      detail: `Off by $${diff.toFixed(2)} — too far`,
    },
  };
}

function scoreDate(
  bankDate: string,
  splitwiseDate: string,
): { value: number; reason: MatchReason } {
  const a = new Date(bankDate).getTime();
  const b = new Date(splitwiseDate).getTime();
  const days = Math.round(Math.abs(a - b) / 86_400_000);
  if (days === 0) {
    return {
      value: 1,
      reason: { kind: "date", weight: W_DATE, detail: "Same day" },
    };
  }
  if (days === 1) {
    return {
      value: 0.9,
      reason: { kind: "date", weight: W_DATE, detail: "1 day apart" },
    };
  }
  if (days <= DATE_WINDOW_DAYS) {
    return {
      value: 0.7,
      reason: {
        kind: "date",
        weight: W_DATE,
        detail: `${days} days apart`,
      },
    };
  }
  return {
    value: 0,
    reason: {
      kind: "date",
      weight: W_DATE,
      detail: `${days} days apart — outside window`,
    },
  };
}

// Simple token-set overlap. Soft signal only — NEVER overrides amount.
function scoreText(
  bankText: string,
  splitwiseText: string | null,
): { value: number; reason: MatchReason } {
  if (!splitwiseText) {
    return {
      value: 0,
      reason: { kind: "text", weight: W_TEXT, detail: "No Splitwise description" },
    };
  }
  const toTokens = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3),
    );
  const a = toTokens(bankText);
  const b = toTokens(splitwiseText);
  if (a.size === 0 || b.size === 0) {
    return {
      value: 0,
      reason: { kind: "text", weight: W_TEXT, detail: "Not enough text" },
    };
  }
  let hits = 0;
  const overlap: string[] = [];
  for (const t of a) {
    if (b.has(t)) {
      hits++;
      overlap.push(t);
    }
  }
  const ratio = hits / Math.min(a.size, b.size);
  return {
    value: ratio,
    reason: {
      kind: "text",
      weight: W_TEXT,
      detail:
        overlap.length > 0
          ? `Shared text: ${overlap.slice(0, 3).join(", ")}`
          : "No text overlap",
    },
  };
}

export function scoreCandidate(
  bank: { amount: number; date: string; name: string },
  splitwise: { cost: number; date: string; description: string | null },
): CandidateScore {
  const amount = scoreAmount(bank.amount, splitwise.cost);
  const date = scoreDate(bank.date, splitwise.date);
  const text = scoreText(bank.name, splitwise.description);

  // Hard gate: if amount or date is zero, the whole match dies. Text alone
  // never rescues a mismatch.
  if (amount.value === 0 || date.value === 0) {
    return {
      score: 0,
      reasons: [amount.reason, date.reason, text.reason],
    };
  }

  const score =
    amount.value * W_AMOUNT + date.value * W_DATE + text.value * W_TEXT;

  return {
    score: Number(score.toFixed(4)),
    reasons: [amount.reason, date.reason, text.reason],
  };
}
