import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSamlProvider } from "@/lib/auth/saml";
import {
  SAML_STATE_COOKIE,
  SAML_STATE_COOKIE_OPTIONS,
  mintSamlState,
  safeRedirectPath,
} from "@/lib/auth/saml-state";

// SP-initiated SSO — redirects the browser to the IdP's SSO endpoint.
export async function GET(req: NextRequest) {
  const requestId = `_${randomBytes(20).toString("hex")}`;
  const saml = getSamlProvider({ requestId });
  if (!saml) {
    return NextResponse.json({ error: "SAML SSO is not configured" }, { status: 501 });
  }

  const redirectTo = safeRedirectPath(req.nextUrl.searchParams.get("redirectTo"));
  try {
    const url = await saml.getAuthorizeUrlAsync(redirectTo, req.headers.get("host") ?? undefined, {});
    const res = NextResponse.redirect(url);
    res.cookies.set(SAML_STATE_COOKIE, await mintSamlState(requestId, redirectTo), SAML_STATE_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    console.error("saml_login error:", err);
    return NextResponse.json({ error: "Failed to start SAML login" }, { status: 500 });
  }
}
