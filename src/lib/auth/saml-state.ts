import { SignJWT, jwtVerify } from "jose";

// Browser-bound SAML login state. At login we generate the AuthnRequest id and
// stash it (plus the post-login destination) in a short-lived signed cookie.
// The ACS handler requires the IdP's InResponseTo to match that id, so a
// response can only be consumed by the browser that started the login — an
// intercepted or replayed SAMLResponse has no matching cookie. Stateless on
// purpose: an in-memory request-id cache doesn't survive across serverless
// instances.
const AUDIENCE = "saml-sso-state";
const TTL_SECONDS = 10 * 60;

export const SAML_STATE_COOKIE = "saml_state";

export const SAML_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  // The IdP POSTs back cross-site, and Lax cookies are not sent on cross-site
  // POSTs. Browsers treat http://localhost as secure, so this works in dev.
  sameSite: "none" as const,
  secure: true,
  path: "/api/auth/saml",
  maxAge: TTL_SECONDS,
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/** Only same-origin absolute paths. Rejects `//host`, `/\host`, and control chars. */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return "/";
  return value;
}

export async function mintSamlState(requestId: string, redirectTo: string): Promise<string> {
  return new SignJWT({ rid: requestId, to: redirectTo })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySamlState(
  token: string,
): Promise<{ requestId: string; redirectTo: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { audience: AUDIENCE });
    if (typeof payload.rid !== "string" || !payload.rid) return null;
    return { requestId: payload.rid, redirectTo: safeRedirectPath(payload.to) };
  } catch {
    return null;
  }
}
