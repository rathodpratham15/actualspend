// One-off endpoint to backfill webhook registration on existing Plaid Items.
//
// New Items created after the link-token change already receive the webhook
// URL automatically. This endpoint calls /item/webhook/update for Items that
// were connected before that change.
//
// POST /api/plaid/update-webhooks
// Returns: { updated: number, skipped: number, errors: number }

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { plaidItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { plaid } from "@/lib/plaid/client";
import { decryptSecret } from "@/lib/crypto";
import { rateLimitOrReject } from "@/lib/rate-limit";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rl = await rateLimitOrReject(`plaid-update-webhooks:${session.user.id}`);
  if (rl) return rl;

  const webhookUrl = process.env.PLAID_WEBHOOK_URL;
  if (!webhookUrl) {
    return new Response("PLAID_WEBHOOK_URL not configured", { status: 503 });
  }

  const items = await db
    .select()
    .from(plaidItems)
    .where(eq(plaidItems.userId, session.user.id));

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of items) {
    if (item.errorCode) {
      // Item needs re-auth — skip; webhook update would fail anyway.
      skipped++;
      continue;
    }
    try {
      const accessToken = decryptSecret(item.accessToken);
      await plaid.itemWebhookUpdate({
        access_token: accessToken,
        webhook: webhookUrl,
      });
      updated++;
    } catch (err) {
      console.error(
        `[plaid:update-webhooks] failed for item ${item.itemId}`,
        err,
      );
      errors++;
    }
  }

  return Response.json({ updated, skipped, errors });
}
