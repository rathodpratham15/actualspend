import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

// Envelope encryption for at-rest secrets stored in the DB (Plaid + Splitwise
// access tokens). Algorithm: AES-256-GCM. 12-byte IV, 16-byte auth tag.
//
// --- Key versioning ---
// Ciphertext is prefixed with the key version so old secrets can always be
// decrypted even after a rotation.
//
//   v1:<iv_b64>:<tag_b64>:<ciphertext_b64>  →  uses ENCRYPTION_KEY
//   v2:<iv_b64>:<tag_b64>:<ciphertext_b64>  →  uses ENCRYPTION_KEY_V2
//   v3:...                                  →  uses ENCRYPTION_KEY_V3
//   (and so on for future versions)
//
// encryptSecret() always writes with the highest version key present in env.
// decryptSecret() reads the prefix and selects the right key automatically.
//
// --- Rotation procedure ---
//   1. Generate a new key:  openssl rand -base64 32
//   2. Add ENCRYPTION_KEY_V{N+1}=<new key> to your env (Vercel + .env.local).
//   3. New writes immediately use the new key. Old ciphertext keeps working.
//   4. Call POST /api/admin/rotate-secrets to re-encrypt all existing DB
//      secrets with the current active key. Requires X-Admin-Secret header.
//   5. Once all rows are re-encrypted, ENCRYPTION_KEY_V{old} can be removed.
//
// --- Backward compat ---
// Values without any "v{N}:" prefix are treated as plaintext (pre-encryption
// era). They pass through decryptSecret() unchanged so existing rows don't
// break before they're re-saved.

// Map from version number → env var name.
function envVarForVersion(v: number): string {
  return v === 1 ? "ENCRYPTION_KEY" : `ENCRYPTION_KEY_V${v}`;
}

// Detect the highest version key set in the current environment.
function activeVersion(): number {
  // Scan upward from v2; fall back to v1 (the original ENCRYPTION_KEY).
  for (let v = 20; v >= 2; v--) {
    if (process.env[envVarForVersion(v)]) return v;
  }
  return 1;
}

function loadKeyForVersion(v: number): Buffer {
  const name = envVarForVersion(v);
  const raw = process.env[name];
  if (!raw) {
    throw new Error(
      `${name} is not set — needed to decrypt a v${v} secret. ` +
        (v === 1
          ? "Generate with: openssl rand -base64 32"
          : `If this key was retired, re-encrypt all secrets first (POST /api/admin/rotate-secrets).`),
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(`${name} must decode to 32 bytes (got ${buf.length}).`);
  }
  return buf;
}

// Parse the version number from a "v{N}:..." prefix.
function parseVersion(stored: string): number | null {
  const m = stored.match(/^v(\d+):/);
  return m ? parseInt(m[1], 10) : null;
}

export function encryptSecret(plain: string): string {
  const v = activeVersion();
  const key = loadKeyForVersion(v);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v${v}:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  // Backward-compat: no prefix → plaintext from pre-encryption era.
  const v = parseVersion(stored);
  if (v === null) return stored;

  // Strip the "v{N}:" prefix, then split remaining parts.
  const withoutPrefix = stored.slice(stored.indexOf(":") + 1);
  const [ivB64, tagB64, dataB64] = withoutPrefix.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted secret");
  }

  const key = loadKeyForVersion(v);
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString("utf8");
}

// Re-encrypt a stored value with the current active key. No-op if it's
// already on the active version. Returns the (possibly new) ciphertext.
export function reencryptSecret(stored: string): string {
  const currentV = activeVersion();
  const storedV = parseVersion(stored);

  // Plaintext passthrough or already on current version — nothing to do.
  if (storedV === null || storedV === currentV) return stored;

  return encryptSecret(decryptSecret(stored));
}
