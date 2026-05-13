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

  const result = await db
    .update(reconciliations)
    .set({ state: STATES.USER_CONFIRMED })
    .where(
      and(
        eq(reconciliations.id, id),
        eq(reconciliations.userId, session.user.id),
        eq(reconciliations.state, STATES.PENDING),
      ),
    )
    .returning({ id: reconciliations.id });

  if (result.length === 0) {
    return new Response("Not found or not in pending state", { status: 404 });
  }
  return Response.json({ ok: true });
}
