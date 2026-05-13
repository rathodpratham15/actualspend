import { auth } from "@/lib/auth";
import { plaid } from "@/lib/plaid/client";
import { db } from "@/lib/db";
import { plaidItems } from "@/lib/db/schema";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: {
    public_token?: string;
    institution?: { institution_id?: string; name?: string };
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.public_token) {
    return new Response("Missing public_token", { status: 400 });
  }

  try {
    const tokenRes = await plaid.itemPublicTokenExchange({
      public_token: body.public_token,
    });
    const { access_token, item_id } = tokenRes.data;

    await db.insert(plaidItems).values({
      userId: session.user.id,
      itemId: item_id,
      accessToken: access_token,
      institutionId: body.institution?.institution_id ?? null,
      institutionName: body.institution?.name ?? null,
    });

    return Response.json({ ok: true, item_id });
  } catch (err) {
    console.error("[plaid] exchange failed", err);
    return new Response("Failed to exchange public token", { status: 500 });
  }
}
