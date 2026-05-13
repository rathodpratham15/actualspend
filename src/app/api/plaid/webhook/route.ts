import { db } from "@/lib/db";
import { plaidItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { runPlaidSync } from "@/lib/plaid/sync";

// Plaid webhook receiver. Set this URL in your Plaid dashboard under
// Team Settings → Webhooks. Public dev tunneling (e.g. ngrok) is required
// since localhost isn't reachable from Plaid's servers.
//
// We handle the most useful events:
//
//  - TRANSACTIONS / SYNC_UPDATES_AVAILABLE   → trigger sync for that item
//  - ITEM / ERROR (ITEM_LOGIN_REQUIRED etc.) → persist error_code so the UI
//                                              can surface a re-link prompt
//  - ITEM / PENDING_EXPIRATION               → persist as a soft warning
//
// Note: this v1 doesn't yet verify Plaid's webhook signature (JWT in the
// `Plaid-Verification` header). Add signature verification before
// exposing this URL publicly in production.

type PlaidWebhook = {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error?: { error_code?: string };
};

export async function POST(req: Request) {
  let payload: PlaidWebhook;
  try {
    payload = (await req.json()) as PlaidWebhook;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  console.log(
    "[plaid:webhook]",
    payload.webhook_type,
    payload.webhook_code,
    payload.item_id,
  );

  const [item] = await db
    .select()
    .from(plaidItems)
    .where(eq(plaidItems.itemId, payload.item_id));
  if (!item) {
    // Unknown item — could be a stale webhook after deletion. Acknowledge
    // 200 so Plaid stops retrying.
    return Response.json({ ok: true, unknown: true });
  }

  switch (`${payload.webhook_type}/${payload.webhook_code}`) {
    case "TRANSACTIONS/SYNC_UPDATES_AVAILABLE":
    case "TRANSACTIONS/INITIAL_UPDATE":
    case "TRANSACTIONS/HISTORICAL_UPDATE":
    case "TRANSACTIONS/DEFAULT_UPDATE": {
      await runPlaidSync(item.userId, { itemId: item.itemId });
      break;
    }
    case "ITEM/ERROR": {
      const code = payload.error?.error_code ?? "UNKNOWN_ERROR";
      await db
        .update(plaidItems)
        .set({ errorCode: code })
        .where(eq(plaidItems.id, item.id));
      break;
    }
    case "ITEM/PENDING_EXPIRATION":
    case "ITEM/PENDING_DISCONNECT": {
      await db
        .update(plaidItems)
        .set({ errorCode: payload.webhook_code })
        .where(eq(plaidItems.id, item.id));
      break;
    }
    default:
      // Ignored — many webhook events aren't relevant to us yet.
      break;
  }

  return Response.json({ ok: true });
}
