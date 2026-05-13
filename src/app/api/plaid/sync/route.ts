import { auth } from "@/lib/auth";
import { plaid } from "@/lib/plaid/client";
import { db } from "@/lib/db";
import {
  plaidItems,
  transactions,
  type PlaidCategory,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { toCanonical } from "@/lib/plaid/categorize";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const items = await db
    .select()
    .from(plaidItems)
    .where(eq(plaidItems.userId, session.user.id));

  let added = 0;
  let modified = 0;
  let removed = 0;

  for (const item of items) {
    let cursor: string | undefined = item.cursor ?? undefined;
    let hasMore = true;

    try {
      while (hasMore) {
        const res = await plaid.transactionsSync({
          access_token: item.accessToken,
          cursor,
        });

        const data = res.data;

        for (const t of data.added) {
          const pfc =
            (t.personal_finance_category as PlaidCategory | undefined) ?? null;
          await db
            .insert(transactions)
            .values({
              userId: session.user.id,
              plaidItemId: item.id,
              plaidTransactionId: t.transaction_id,
              amount: t.amount.toFixed(2),
              isoCurrencyCode: t.iso_currency_code ?? "USD",
              date: t.date,
              name: t.name,
              merchantName: t.merchant_name ?? null,
              plaidCategory: pfc,
              canonicalCategory: toCanonical(pfc),
              pending: t.pending,
            })
            .onConflictDoNothing();
          added++;
        }

        for (const t of data.modified) {
          const pfc =
            (t.personal_finance_category as PlaidCategory | undefined) ?? null;
          await db
            .update(transactions)
            .set({
              amount: t.amount.toFixed(2),
              date: t.date,
              name: t.name,
              merchantName: t.merchant_name ?? null,
              plaidCategory: pfc,
              canonicalCategory: toCanonical(pfc),
              pending: t.pending,
            })
            .where(eq(transactions.plaidTransactionId, t.transaction_id));
          modified++;
        }

        for (const t of data.removed) {
          if (!t.transaction_id) continue;
          await db
            .update(transactions)
            .set({ deletedAt: new Date() })
            .where(eq(transactions.plaidTransactionId, t.transaction_id));
          removed++;
        }

        cursor = data.next_cursor;
        hasMore = data.has_more;
      }

      await db
        .update(plaidItems)
        .set({ cursor: cursor ?? null })
        .where(eq(plaidItems.id, item.id));
    } catch (err) {
      console.error(`[plaid] sync failed for item ${item.id}`, err);
    }
  }

  return Response.json({ added, modified, removed });
}
