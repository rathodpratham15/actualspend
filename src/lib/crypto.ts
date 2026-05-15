import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

// Envelope encryption for at-rest secrets stored in the DB (Plaid + Splitwise
// access tokens). Neon already encrypts data at rest, but DB-level encryption
// stops at "someone with DB read access has cleartext tokens." This adds an
// application-layer key so the tokens are useless without ENCRYPTION_KEY,
// which lives only in environment variables.
//
// Format: v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
//
// Algorithm: AES-256-GCM. 12-byte IV, 16-byte auth tag.
//
// Backward compatible: decryptSecret() detects the v1 prefix and treats
// values without it as plaintext. This lets us roll the change out without
// a separate migration — existing plaintext tokens keep working, new tokens
// land encrypted, and any row that gets re-saved (e.g. on re-link / new
// Splitwise callback) transitions to encrypted automatically.

const PREFIX = "v1:";

function loadKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY env var is required to encrypt/decrypt secrets. " +
        "Generate with: openssl rand -base64 32",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length}). ` +
        "Use a base64-encoded 32-byte value.",
    );
  }
  return buf;
}

export function encryptSecret(plain: string): string {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  // Backwards-compat: values without the prefix are plaintext (pre-encryption
  // era). Let them through so existing rows don't break before they're
  // re-saved with an encrypted value.
  if (!stored.startsWith(PREFIX)) {
    return stored;
  }
  const [, ivB64, tagB64, dataB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted secret");
  }
  const key = loadKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString("utf8");
}
