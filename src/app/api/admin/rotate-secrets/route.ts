import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { plaidItems, splitwiseCredentials } from "@/lib/db/schema";
import { reencryptSecret } from "@/lib/crypto";
import { eq } from "drizzle-orm";

// One-time endpoint to re-encrypt all DB secrets with the current active key.
// Call this after adding a new ENCRYPTION_KEY_V{N} and before retiring the old one.
//
// Protected by X-Admin-Secret header (must match ADMIN_SECRET env var).
// Only runs server-side; safe to call from a curl command or a one-off script.

export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json(
      { error: "ADMIN_SECRET is not set — rotation endpoint is disabled" },
      { status: 503 },
    );
  }
  if (req.headers.get("x-admin-secret") !== adminSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let plaidRotated = 0;
  let swRotated = 0;
  const errors: string[] = [];

  // Re-encrypt Plaid access tokens.
  const plaidRows = await db.select({ id: plaidItems.id, accessToken: plaidItems.accessToken }).from(plaidItems);
  for (const row of plaidRows) {
    try {
      const updated = reencryptSecret(row.accessToken);
      if (updated !== row.accessToken) {
        await db.update(plaidItems).set({ accessToken: updated }).where(eq(plaidItems.id, row.id));
        plaidRotated++;
      }
    } catch (e) {
      errors.push(`plaidItem ${row.id}: ${String(e)}`);
    }
  }

  // Re-encrypt Splitwise access tokens.
  const swRows = await db
    .select({ userId: splitwiseCredentials.userId, accessToken: splitwiseCredentials.accessToken })
    .from(splitwiseCredentials);
  for (const row of swRows) {
    try {
      const updated = reencryptSecret(row.accessToken);
      if (updated !== row.accessToken) {
        await db
          .update(splitwiseCredentials)
          .set({ accessToken: updated })
          .where(eq(splitwiseCredentials.userId, row.userId));
        swRotated++;
      }
    } catch (e) {
      errors.push(`splitwiseCred ${row.userId}: ${String(e)}`);
    }
  }

  return NextResponse.json({
    plaidRotated,
    swRotated,
    errors,
    total: plaidRows.length + swRows.length,
  });
}
