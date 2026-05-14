import { auth } from "@/lib/auth";
import { syncSplitwiseExpenses } from "@/lib/splitwise/sync";
import { rateLimitOrReject } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  // Force-sync is heavy (full re-pull); rate-limit it tighter via a distinct key.
  const rl = await rateLimitOrReject(
    force ? `splitwise-force:${session.user.id}` : `splitwise-sync:${session.user.id}`,
  );
  if (rl) return rl;

  try {
    const upserted = await syncSplitwiseExpenses(session.user.id, { force });
    return Response.json({ upserted, force });
  } catch (err) {
    console.error("[splitwise] sync failed", err);
    return new Response(
      err instanceof Error ? err.message : "Sync failed",
      { status: 500 },
    );
  }
}
