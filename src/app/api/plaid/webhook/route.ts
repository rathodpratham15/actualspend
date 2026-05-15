import { db } from "@/lib/db";
import { plaidItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { runPlaidSync } from "@/lib/plaid/sync";
import { verifyPlaidWebhook } from "@/lib/plaid/webhook-verify";

// Plaid webhook receiver. Set this URL in your Plaid dashboard under
// Team Settings → Webhooks. Public dev tunneling (e.g. ngrok) is required
// since localhost isn't reachable from Plaid's servers.

type PlaidWebhook = {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error?: { error_code?: string };
};

export async function POST(req: Request) {
  // We must read the raw body before parsing — the JWT signature is computed
  // over the exact bytes Plaid sent.
  const rawBody = await req.text();
  const jwtToken = req.headers.get("Plaid-Verification");

  // In environments without Plaid keys configured, skip verification entirely
  // (otherwise verifyPlaidWebhook would fail on the /webhook_verification_key
  // call). This branch is for local dev only — production must have keys.
  const skipVerify =
    !process.env.PLAID_CLIENT_ID ||
    !process.env.PLAID_SECRET ||
    process.env.PLAID_WEBHOOK_VERIFY === "false";

  if (!skipVerify) {
    const v = await verifyPlaidWebhook(jwtToken, rawBody);
    if (!v.valid) {
      console.warn("[plaid:webhook] rejected:", v.reason);
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let payload: PlaidWebhook;
  try {
    payload = JSON.parse(rawBody) as PlaidWebhook;
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
