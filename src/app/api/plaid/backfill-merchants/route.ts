// Backfill effective_merchant + channel for transactions that were ingested
// before the merchant-normalize pass was added.
//
// POST /api/plaid/backfill-merchants
// Returns: { updated: number }
//
// Safe to call multiple times — only rows where effective_merchant IS NULL
// are touched. Run once after deploying feat/merchant-normalize.

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { normalizeEffectiveMerchant } from "@/lib/plaid/merchant-normalize";
import { rateLimitOrReject } from "@/lib/rate-limit";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rl = await rateLimitOrReject(
    `plaid-backfill-merchants:${session.user.id}`,
  );
  if (rl) return rl;

  // Only look at rows that haven't been normalized yet and come from an
  // aggregator (the normalizer returns null for regular transactions, so we
  // can't distinguish "processed + not an aggregator" from "not processed
  // yet" for the general case — the backfill is therefore idempotent: running
  // it again re-evaluates every null row, which is fine since normalizeEffective
  // Merchant is a pure function).
  const rows = await db
    .select({ id: transactions.id, name: transactions.name })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, session.user.id),
        isNull(transactions.effectiveMerchant),
        isNull(transactions.deletedAt),
      ),
    );

  let updated = 0;
  for (const row of rows) {
    const norm = normalizeEffectiveMerchant(row.name);
    if (!norm) continue; // Not an aggregator — leave null.
    await db
      .update(transactions)
      .set({
        effectiveMerchant: norm.destination,
        channel: norm.channel,
      })
      .where(eq(transactions.id, row.id));
    updated++;
  }

  return Response.json({ updated });
}
