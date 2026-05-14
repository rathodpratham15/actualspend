import crypto from "node:crypto";
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from "jose";
import { plaid } from "./client";

// Verifies Plaid webhook authenticity per:
// https://plaid.com/docs/api/webhooks/webhook-verification/
//
// Flow:
//   1. Plaid signs every webhook payload with an EC public key (ES256) and
//      sends the JWT in the `Plaid-Verification` header.
//   2. The JWT header carries a `kid` (key id). We fetch the matching public
//      key via /webhook_verification_key/get and verify the signature.
//   3. The JWT payload includes `request_body_sha256`. We compare against
//      the SHA-256 of the actual request body to ensure it wasn't tampered
//      with after signing.
//
// Keys are rotated periodically; we cache them in module scope and refetch on
// verification failure. Serverless cold starts naturally re-cache.

const keyCache = new Map<string, CryptoKey>();

export type VerifyResult = { valid: true } | { valid: false; reason: string };

export async function verifyPlaidWebhook(
  jwtToken: string | null,
  rawBody: string,
): Promise<VerifyResult> {
  if (!jwtToken) return { valid: false, reason: "missing Plaid-Verification" };

  let header;
  try {
    header = decodeProtectedHeader(jwtToken);
  } catch {
    return { valid: false, reason: "malformed jwt header" };
  }
  const kid = header.kid;
  if (!kid || typeof kid !== "string") {
    return { valid: false, reason: "missing kid" };
  }
  if (header.alg !== "ES256") {
    return { valid: false, reason: `unexpected alg ${header.alg}` };
  }

  let publicKey = keyCache.get(kid);
  if (!publicKey) {
    try {
      const res = await plaid.webhookVerificationKeyGet({ key_id: kid });
      const jwk = res.data.key as unknown as JWK;
      publicKey = (await importJWK(jwk, "ES256")) as CryptoKey;
      keyCache.set(kid, publicKey);
    } catch {
      return { valid: false, reason: "key fetch failed" };
    }
  }

  try {
    const { payload } = await jwtVerify(jwtToken, publicKey);
    const expected = crypto
      .createHash("sha256")
      .update(rawBody)
      .digest("hex");
    if (payload.request_body_sha256 !== expected) {
      return { valid: false, reason: "body hash mismatch" };
    }
    // iat is required and must be recent (5 min window — Plaid recommends).
    const iat = payload.iat;
    if (typeof iat === "number") {
      const ageSeconds = Math.floor(Date.now() / 1000) - iat;
      if (ageSeconds > 5 * 60) {
        return { valid: false, reason: "jwt too old" };
      }
    }
    return { valid: true };
  } catch {
    // Cached key might be stale — drop it so the next call refetches.
    keyCache.delete(kid);
    return { valid: false, reason: "signature verification failed" };
  }
}
