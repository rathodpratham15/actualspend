// Vocabulary for the reconciliation engine. Stored as text columns so we can
// extend without schema changes; keep this file the canonical source.

export const RECONCILIATION_TYPES = {
  /** I paid for a group thing on my card. Splitwise has me as payer. */
  FRONTED_SHARED_EXPENSE: "FRONTED_SHARED_EXPENSE",
  /** Someone Venmo'd me back for a shared expense I previously fronted. */
  REIMBURSEMENT_RECEIVED: "REIMBURSEMENT_RECEIVED",
  /** I sent a Venmo/Zelle to settle a shared expense someone else fronted. */
  REIMBURSEMENT_SENT: "REIMBURSEMENT_SENT",
  /** Just me — no shared context. Full bank amount is my actual spend. */
  PERSONAL_EXPENSE: "PERSONAL_EXPENSE",
  /** Splitwise sees it (cash dinner, etc.), bank doesn't. user_share counts. */
  SPLITWISE_ONLY: "SPLITWISE_ONLY",
} as const;
export type ReconciliationType =
  (typeof RECONCILIATION_TYPES)[keyof typeof RECONCILIATION_TYPES];

export const STATES = {
  /** Engine proposed it, awaiting user confirmation. */
  PENDING: "PENDING",
  /** Engine confidence ≥ AUTO_MATCH; written without confirmation. */
  AUTO_MATCHED: "AUTO_MATCHED",
  /** User explicitly approved a proposal. */
  USER_CONFIRMED: "USER_CONFIRMED",
  /** User explicitly rejected; engine should not re-propose. */
  USER_REJECTED: "USER_REJECTED",
  /** User created the match by hand (no engine proposal). */
  MANUAL_MATCH: "MANUAL_MATCH",
  /** User marked the row as "ignore" (e.g. weird internal transfer). */
  IGNORED: "IGNORED",
} as const;
export type ReconciliationState = (typeof STATES)[keyof typeof STATES];

/** Tuned for trust-first behavior — false positives are far worse than false negatives. */
export const THRESHOLDS = {
  AUTO_MATCH: 0.93,
  PROPOSE: 0.65,
} as const;

/** Look at Splitwise expenses dated within this many days of the bank txn. */
export const DATE_WINDOW_DAYS = 3;

/** Amount tolerance bands. Differences ≤ TOL_EXACT keep top-tier score. */
export const AMOUNT_TOL_EXACT = 0.01;
export const AMOUNT_TOL_SOFT = 1.0;
export const AMOUNT_TOL_HARD = 5.0;
