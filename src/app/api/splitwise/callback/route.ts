import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { splitwiseCredentials } from "@/lib/db/schema";
import { splitwiseFetch } from "@/lib/splitwise/client";
import { syncSplitwiseExpenses } from "@/lib/splitwise/sync";
import type { GetCurrentUserResponse } from "@/lib/splitwise/types";

const TOKEN_URL = "https://secure.splitwise.com/oauth/token";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("sw_oauth_state")?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return new Response("Invalid OAuth state", { status: 400 });
  }
  cookieStore.delete("sw_oauth_state");

  const clientId = process.env.SPLITWISE_CLIENT_ID;
  const clientSecret = process.env.SPLITWISE_CLIENT_SECRET;
  const redirectUri = process.env.SPLITWISE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return new Response("Splitwise env vars not set", { status: 500 });
  }

  // Exchange the authorization code for an access token.
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "");
    console.error("[splitwise] token exchange failed", tokenRes.status, body);
    return new Response("Token exchange failed", { status: 502 });
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Resolve the user's Splitwise user_id — needed to pick out our share from
  // each expense's `users` array.
  const me = await splitwiseFetch<GetCurrentUserResponse>(
    "/get_current_user",
    access_token,
  );

  await db
    .insert(splitwiseCredentials)
    .values({
      userId: session.user.id,
      accessToken: access_token,
      splitwiseUserId: me.user.id,
    })
    .onConflictDoUpdate({
      target: splitwiseCredentials.userId,
      set: {
        accessToken: access_token,
        splitwiseUserId: me.user.id,
        lastSyncedAt: null, // force a full re-pull on first sync
      },
    });

  // Kick off the initial sync inline so the user lands on a populated page.
  try {
    await syncSplitwiseExpenses(session.user.id);
  } catch (err) {
    console.error("[splitwise] initial sync failed", err);
  }

  return NextResponse.redirect(new URL("/?sw=connected", req.url));
}
