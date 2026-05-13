import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  numeric,
  boolean,
  date,
  jsonb,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// Plaid's Personal Finance Category shape — preserved verbatim per the
// 3-layer category architecture: never lose Plaid's taxonomy.
export type PlaidCategory = {
  primary: string;
  detailed: string;
  confidence_level?: "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
};

// ---------- Auth.js v5 (NextAuth Drizzle adapter) ----------

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ---------- ActualSpend domain ----------

// One row per Plaid Item (a bank connection). A user can connect multiple banks.
// access_token here is the long-lived Plaid token — treat as a secret.
export const plaidItems = pgTable("plaid_item", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  institutionId: text("institution_id"),
  institutionName: text("institution_name"),
  cursor: text("cursor"), // Plaid /transactions/sync cursor for incremental pulls
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// One row per user. Splitwise OAuth2 tokens.
// Splitwise tokens don't expire by default — refresh_token / expires_at are
// kept on the schema for forward-compat but typically null.
export const splitwiseCredentials = pgTable("splitwise_credential", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  splitwiseUserId: integer("splitwise_user_id"),
  // Watermark for incremental sync: feed into `updated_after` on next pull.
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Layer 2 — canonical internal categories. Seeded but extensible (text PK so a
// user can add bespoke codes later without a migration).
export const categories = pgTable("category", {
  code: text("code").primaryKey(),
  displayName: text("display_name").notNull(),
  isInflow: boolean("is_inflow").notNull().default(false),
  description: text("description"),
});

// Bank transactions as reported by Plaid.
// Plaid convention: positive amount = outflow from the account (debit/spend),
// negative = inflow (credit/refund). We keep this convention.
export const transactions = pgTable(
  "transaction",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plaidItemId: text("plaid_item_id")
      .notNull()
      .references(() => plaidItems.id, { onDelete: "cascade" }),
    plaidTransactionId: text("plaid_transaction_id").notNull().unique(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    isoCurrencyCode: text("iso_currency_code").default("USD"),
    date: date("date").notNull(),
    name: text("name").notNull(),
    merchantName: text("merchant_name"),
    // Layer 1: raw Plaid taxonomy. Immutable; preserved for ML/debugging.
    plaidCategory: jsonb("plaid_category").$type<PlaidCategory>(),
    // Layer 2: our canonical bucket. Nullable until classifier runs.
    canonicalCategory: text("canonical_category").references(
      () => categories.code,
      { onDelete: "set null" },
    ),
    pending: boolean("pending").notNull().default(false),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("txn_user_date_idx").on(t.userId, t.date),
    index("txn_user_amount_idx").on(t.userId, t.amount),
  ],
);

// Splitwise expenses pulled via API.
// userShare = the portion this user is responsible for (net of what they paid).
// Sign convention: positive userShare = user owes / spent that much net.
export const splitwiseExpenses = pgTable(
  "splitwise_expense",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    splitwiseExpenseId: text("splitwise_expense_id").notNull().unique(),
    description: text("description"),
    cost: numeric("cost", { precision: 12, scale: 2 }).notNull(),
    currencyCode: text("currency_code").default("USD"),
    userShare: numeric("user_share", { precision: 12, scale: 2 }).notNull(),
    paidByUser: numeric("paid_by_user", { precision: 12, scale: 2 }).notNull(),
    date: date("date").notNull(),
    groupId: integer("group_id"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (e) => [
    index("sw_user_date_idx").on(e.userId, e.date),
    index("sw_user_cost_idx").on(e.userId, e.cost),
  ],
);

// Layer 3 — semantic tags. Multi-tag per transaction OR Splitwise expense.
// Exactly one of (transaction_id, splitwise_expense_id) is set; CHECK enforces.
// This lets the same "shared_groceries" tag apply to both a Costco bank charge
// and a Splitwise Costco entry without polymorphic juggling.
export const tags = pgTable(
  "tag",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id").references(() => transactions.id, {
      onDelete: "cascade",
    }),
    splitwiseExpenseId: text("splitwise_expense_id").references(
      () => splitwiseExpenses.id,
      { onDelete: "cascade" },
    ),
    kind: text("kind").notNull(), // 'label' | 'financial_role' | 'ownership' | 'reimbursement_status' | future
    value: text("value").notNull(), // e.g. 'shared_groceries', 'fronted_payment'
    confidence: numeric("confidence", { precision: 3, scale: 2 }), // 0.00–1.00; null = unspecified
    source: text("source").notNull(), // 'rule' | 'user' | 'ai'
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // Exactly one subject FK populated.
    check(
      "tag_subject_xor",
      sql`(${t.transactionId} IS NOT NULL)::int + (${t.splitwiseExpenseId} IS NOT NULL)::int = 1`,
    ),
    // Same tag (kind+value) shouldn't appear twice on the same subject.
    uniqueIndex("tag_txn_uq")
      .on(t.transactionId, t.kind, t.value)
      .where(sql`${t.transactionId} IS NOT NULL`),
    uniqueIndex("tag_swe_uq")
      .on(t.splitwiseExpenseId, t.kind, t.value)
      .where(sql`${t.splitwiseExpenseId} IS NOT NULL`),
    index("tag_user_kind_idx").on(t.userId, t.kind),
  ],
);

// Reconciliation: a derived decision about a transaction and/or a Splitwise
// expense. Exactly one of (transaction_id, splitwise_expense_id) may be null:
// - both set        → a matched pair (the common case)
// - txn null        → SPLITWISE_ONLY (cash dinner Splitwise sees, bank doesn't)
// - sw null         → PERSONAL_EXPENSE or UNMATCHED (bank-side only)
//
// `reconciliation_type` and `state` are stored as text (not enum) so we can
// extend the vocabulary without migrations. Valid values mirror the constants
// in src/lib/reconciliation/types.ts.
//
// Code that creates these rows should treat them as part of a logical
// "reconciliation group" even though v1 writes 1:1 — future N:M expansion is
// an additive schema change (join table), not a rewrite.
export type MatchReason = {
  kind: "amount" | "date" | "text" | "currency";
  weight: number;
  detail: string;
};

export const reconciliations = pgTable(
  "reconciliation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id").references(() => transactions.id, {
      onDelete: "cascade",
    }),
    splitwiseExpenseId: text("splitwise_expense_id").references(
      () => splitwiseExpenses.id,
      { onDelete: "set null" },
    ),
    actualAmount: numeric("actual_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    reconciliationType: text("reconciliation_type").notNull(),
    state: text("state").notNull(),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    matchReasons: jsonb("match_reasons").$type<MatchReason[]>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (r) => [
    // One reconciliation per (user, bank txn) when txn is set. Postgres treats
    // multiple NULL transaction_ids as distinct, so this doesn't block
    // SPLITWISE_ONLY rows.
    uniqueIndex("rec_user_txn_uq")
      .on(r.userId, r.transactionId)
      .where(sql`${r.transactionId} IS NOT NULL`),
    // For SPLITWISE_ONLY (txn null), one reconciliation per splitwise expense.
    uniqueIndex("rec_user_swe_uq")
      .on(r.userId, r.splitwiseExpenseId)
      .where(
        sql`${r.transactionId} IS NULL AND ${r.splitwiseExpenseId} IS NOT NULL`,
      ),
  ],
);
