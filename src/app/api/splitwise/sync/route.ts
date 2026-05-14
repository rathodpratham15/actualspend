import { auth } from "@/lib/auth";
import { syncSplitwiseExpenses } from "@/lib/splitwise/sync";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

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
