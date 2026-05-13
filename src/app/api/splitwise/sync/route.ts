import { auth } from "@/lib/auth";
import { syncSplitwiseExpenses } from "@/lib/splitwise/sync";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const upserted = await syncSplitwiseExpenses(session.user.id);
    return Response.json({ upserted });
  } catch (err) {
    console.error("[splitwise] sync failed", err);
    return new Response(
      err instanceof Error ? err.message : "Sync failed",
      { status: 500 },
    );
  }
}
