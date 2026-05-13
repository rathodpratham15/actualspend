import { auth } from "@/lib/auth";
import { reconcileForUser } from "@/lib/reconciliation/engine";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const result = await reconcileForUser(session.user.id);
    return Response.json(result);
  } catch (err) {
    console.error("[reconcile] failed", err);
    return new Response(
      err instanceof Error ? err.message : "Reconciliation failed",
      { status: 500 },
    );
  }
}
