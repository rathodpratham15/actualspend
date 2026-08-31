import { NextRequest, NextResponse } from "next/server";
import { getSamlProvider } from "@/lib/auth/saml";

// SP-initiated SSO — redirects the browser to the IdP's SSO endpoint.
export async function GET(req: NextRequest) {
  const saml = getSamlProvider();
  if (!saml) {
    return NextResponse.json({ error: "SAML SSO is not configured" }, { status: 501 });
  }

  const relayState = req.nextUrl.searchParams.get("redirectTo") || "/";
  try {
    const url = await saml.getAuthorizeUrlAsync(relayState, req.headers.get("host") ?? undefined, {});
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("saml_login error:", err);
    return NextResponse.json({ error: "Failed to start SAML login" }, { status: 500 });
  }
}
