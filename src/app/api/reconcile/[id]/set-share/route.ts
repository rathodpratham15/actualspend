import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reconciliations } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { STATES } from "@/lib/reconciliation/types";

// Manual override: set the user's actual share on a reconciliation row when
// the underlying bank txn isn't tracked on Splitwise. The classic case is
// rent — paid by user out of bank, roommates Venmo back directly without
// anyone logging it in Splitwise. The engine can't match what isn't there,
// so the user sets their share by hand.
//
// Sets state to MANUAL_MATCH so the rebuild loop in reconcileForUser
// preserves it.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;

  let body: { actualAmount?: number };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const n = Number(body.actualAmount);
  if (!Number.isFinite(n) || n < 0) {
    return new Response("actualAmount must be a non-negative number", {
      status: 400,
    });
  }

  const updated = await db
    .update(reconciliations)
    .set({
      actualAmount: n.toFixed(2),
      state: STATES.MANUAL_MATCH,
    })
    .where(
      and(
        eq(reconciliations.id, id),
        eq(reconciliations.userId, session.user.id),
      ),
    )
    .returning({ id: reconciliations.id });

  if (updated.length === 0) {
    return new Response("Not found", { status: 404 });
  }
  return Response.json({ ok: true });
}
