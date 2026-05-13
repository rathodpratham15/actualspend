import { auth } from "@/lib/auth";
import { runPlaidSync } from "@/lib/plaid/sync";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runPlaidSync(session.user.id);
  return Response.json(result);
}
