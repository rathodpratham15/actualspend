import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const AUTHORIZE_URL = "https://secure.splitwise.com/oauth/authorize";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const clientId = process.env.SPLITWISE_CLIENT_ID;
  const redirectUri = process.env.SPLITWISE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return new Response("SPLITWISE_CLIENT_ID / SPLITWISE_REDIRECT_URI not set", {
      status: 500,
    });
  }

  // CSRF guard: random state stashed in an HttpOnly cookie, checked on callback.
  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("sw_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url);
}
