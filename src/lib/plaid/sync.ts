import { db } from "@/lib/db";
import {
  plaidItems,
  transactions,
  userMerchantRules,
  type PlaidCategory,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { plaid } from "./client";
import { resolveCategory } from "./ai-categorize";
import { normalizeEffectiveMerchant } from "./merchant-normalize";
import { decryptSecret } from "@/lib/crypto";

// Load all user merchant rules once per sync run, keyed by lowercased rawPattern.
async function loadMerchantRules(userId: string): Promise<Map<string, string>> {
  const rules = await db
    .select({ rawPattern: userMerchantRules.rawPattern, destination: userMerchantRules.destination })
    .from(userMerchantRules)
    .where(eq(userMerchantRules.userId, userId));
  return new Map(rules.map((r) => [r.rawPattern.toLowerCase(), r.destination]));
}

// Resolve effective merchant + channel for a transaction name, applying user
// rules when the aggregator regex leaves destination ambiguous (= channel).
function resolveEffectiveMerchant(
  name: string,
  rules: Map<string, string>,
): { channel: string | null; destination: string | null } {
  const norm = normalizeEffectiveMerchant(name);
  if (!norm) return { channel: null, destination: null };

  // Ambiguous when destination === channel (regex matched but no sub-store extracted).
  if (norm.destination === norm.channel) {
    const userDest = rules.get(name.toLowerCase());
    if (userDest) return { channel: norm.channel, destination: userDest };
    // Still ambiguous — store channel as destination so it appears under the
    // aggregator name rather than being lost entirely.
    return { channel: norm.channel, destination: norm.channel };
  }

  return { channel: norm.channel, destination: norm.destination };
}

export type PlaidSyncResult = {
  added: number;
  modified: number;
  removed: number;
  itemsTouched: number;
  itemsErrored: number;
};

// Shared by the manual sync endpoint and the Plaid webhook. If itemFilter is
// provided we only sync that single item (webhook path); otherwise sync all
// of the user's items (manual button path).
export async function runPlaidSync(
  userId: string,
  itemFilter?: { itemId: string },
): Promise<PlaidSyncResult> {
  const items = await db
    .select()
    .from(plaidItems)
    .where(
      itemFilter
        ? and(
            eq(plaidItems.userId, userId),
            eq(plaidItems.itemId, itemFilter.itemId),
          )
        : eq(plaidItems.userId, userId),
    );

  const merchantRules = await loadMerchantRules(userId);

  const result: PlaidSyncResult = {
    added: 0,
    modified: 0,
    removed: 0,
    itemsTouched: 0,
    itemsErrored: 0,
  };

  for (const item of items) {
    let cursor: string | undefined = item.cursor ?? undefined;
    let hasMore = true;
    let touchedThisItem = false;
    // Decrypt once per item rather than per sync page.
    const accessToken = decryptSecret(item.accessToken);

    try {
      while (hasMore) {
        const res = await plaid.transactionsSync({
          access_token: accessToken,
          cursor,
        });
        const data = res.data;

        for (const t of data.added) {
          const pfc =
            (t.personal_finance_category as PlaidCategory | undefined) ?? null;
          const norm = resolveEffectiveMerchant(t.name, merchantRules);
          await db
            .insert(transactions)
            .values({
              userId,
              plaidItemId: item.id,
              plaidTransactionId: t.transaction_id,
              amount: t.amount.toFixed(2),
              isoCurrencyCode: t.iso_currency_code ?? "USD",
              date: t.date,
              name: t.name,
              merchantName: t.merchant_name ?? null,
              effectiveMerchant: norm.destination,
              channel: norm.channel,
              plaidCategory: pfc,
              canonicalCategory: await resolveCategory(pfc, t.merchant_name ?? t.name),
              pending: t.pending,
            })
            .onConflictDoNothing();
          result.added++;
          touchedThisItem = true;
        }

        for (const t of data.modified) {
          const pfc =
            (t.personal_finance_category as PlaidCategory | undefined) ?? null;
          const norm = resolveEffectiveMerchant(t.name, merchantRules);
          await db
            .update(transactions)
            .set({
              amount: t.amount.toFixed(2),
              date: t.date,
              name: t.name,
              merchantName: t.merchant_name ?? null,
              effectiveMerchant: norm.destination,
              channel: norm.channel,
              plaidCategory: pfc,
              canonicalCategory: await resolveCategory(pfc, t.merchant_name ?? t.name),
              pending: t.pending,
            })
            .where(eq(transactions.plaidTransactionId, t.transaction_id));
          result.modified++;
          touchedThisItem = true;
        }

        for (const t of data.removed) {
          if (!t.transaction_id) continue;
          await db
            .update(transactions)
            .set({ deletedAt: new Date() })
            .where(eq(transactions.plaidTransactionId, t.transaction_id));
          result.removed++;
          touchedThisItem = true;
        }

        cursor = data.next_cursor;
        hasMore = data.has_more;
      }

      // Persist cursor + clear any prior error on success.
      await db
        .update(plaidItems)
        .set({ cursor: cursor ?? null, errorCode: null })
        .where(eq(plaidItems.id, item.id));
      if (touchedThisItem) result.itemsTouched++;
    } catch (err) {
      result.itemsErrored++;
      const code = extractPlaidErrorCode(err);
      if (code) {
        await db
          .update(plaidItems)
          .set({ errorCode: code })
          .where(eq(plaidItems.id, item.id));
      }
      console.error(`[plaid] sync failed for item ${item.id}`, code ?? err);
    }
  }

  return result;
}

// Plaid returns errors via axios; the useful bit is in response.data.error_code.
function extractPlaidErrorCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { response?: { data?: { error_code?: string } } };
  return e.response?.data?.error_code ?? null;
}
