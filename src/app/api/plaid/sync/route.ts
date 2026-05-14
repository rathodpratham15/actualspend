import { auth } from "@/lib/auth";
import { runPlaidSync } from "@/lib/plaid/sync";
import { rateLimitOrReject } from "@/lib/rate-limit";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rl = await rateLimitOrReject(`plaid-sync:${session.user.id}`);
  if (rl) return rl;

  const result = await runPlaidSync(session.user.id);
  return Response.json(result);
}
