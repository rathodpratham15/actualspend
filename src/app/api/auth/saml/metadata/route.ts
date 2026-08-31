import { NextResponse } from "next/server";
import { getSamlProvider } from "@/lib/auth/saml";

// SP metadata — give this URL (or its XML) to the IdP admin when setting up
// the SAML app so they can configure the SP entity id / ACS URL.
export async function GET() {
  const saml = getSamlProvider();
  if (!saml) {
    return NextResponse.json({ error: "SAML SSO is not configured" }, { status: 501 });
  }

  const xml = saml.generateServiceProviderMetadata(null);
  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
