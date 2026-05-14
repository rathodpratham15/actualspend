import { auth } from "@/lib/auth";
import { plaid } from "@/lib/plaid/client";
import { CountryCode, Products } from "plaid";
import { rateLimitOrReject } from "@/lib/rate-limit";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rl = await rateLimitOrReject(`plaid-link-token:${session.user.id}`);
  if (rl) return rl;

  try {
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: session.user.id },
      client_name: "ActualSpend",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return Response.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error("[plaid] link-token failed", err);
    return new Response("Failed to create link token", { status: 500 });
  }
}
