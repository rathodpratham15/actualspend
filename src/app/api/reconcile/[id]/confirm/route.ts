import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reconciliations } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { STATES } from "@/lib/reconciliation/types";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  const userId = session.user.id;

  // Fetch the row so we know whether it belongs to an N:M group.
  const [row] = await db
    .select({ id: reconciliations.id, nmGroupId: reconciliations.nmGroupId })
    .from(reconciliations)
    .where(
      and(
        eq(reconciliations.id, id),
        eq(reconciliations.userId, userId),
        eq(reconciliations.state, STATES.PENDING),
      ),
    );

  if (!row) {
    return new Response("Not found or not in pending state", { status: 404 });
  }

  if (row.nmGroupId) {
    // N:M group — confirm every row that shares this group ID so all cluster
    // members transition together.
    await db
      .update(reconciliations)
      .set({ state: STATES.USER_CONFIRMED })
      .where(
        and(
          eq(reconciliations.userId, userId),
          eq(reconciliations.nmGroupId, row.nmGroupId),
          eq(reconciliations.state, STATES.PENDING),
        ),
      );
  } else {
    // Standard 1:1 row.
    await db
      .update(reconciliations)
      .set({ state: STATES.USER_CONFIRMED })
      .where(
        and(
          eq(reconciliations.id, id),
          eq(reconciliations.userId, userId),
        ),
      );
  }

  return Response.json({ ok: true });
}
