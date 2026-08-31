import { SignJWT, jwtVerify } from "jose";

// Short-lived bridge token between the SAML ACS handler (which validates the
// IdP assertion) and the "saml" Credentials provider's authorize() (which
// Auth.js's public /api/auth/callback/saml endpoint runs on whatever it's
// POSTed). authorize() must never trust a raw user id from that endpoint —
// only a ticket signed here, immediately after a real SAML validation,
// proves the caller actually completed SSO.
const AUDIENCE = "saml-sso-ticket";
const TTL_SECONDS = 60;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function mintSamlTicket(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySamlTicket(ticket: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(ticket, secretKey(), { audience: AUDIENCE });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
