// POST /api/auth/forgot-password
// Body: { email: string }
//
// Generates a one-time reset token (expires 1 hour), stores the SHA-256
// hash in the DB, and sends the raw token in an email link.
//
// Always returns 200 regardless of whether the email exists — we never
// confirm or deny that an account is registered.

import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: true }); // silent — don't reveal parsing errors
  }

  const email = body.email?.toLowerCase().trim();
  if (!email) return Response.json({ ok: true });

  const [user] = await db
    .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Only allow reset for accounts with a password (not Google-only).
  if (!user?.passwordHash) return Response.json({ ok: true });

  // Invalidate any existing unexpired tokens for this user.
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id));

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const origin =
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const resetUrl = `${origin}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);

  return Response.json({ ok: true });
}
