// POST /api/auth/reset-password
// Body: { token: string, password: string }
//
// Verifies the token hash, checks expiry + unused, updates password,
// marks the token as used.

import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { token, password } = body;
  if (!token || !password) {
    return Response.json({ error: "Token and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
      ),
    )
    .limit(1);

  if (!row) {
    return Response.json({ error: "Invalid or already used reset link." }, { status: 400 });
  }
  if (row.expiresAt < new Date()) {
    return Response.json({ error: "This reset link has expired. Request a new one." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await Promise.all([
    db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, row.userId)),
    db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, row.id)),
  ]);

  return Response.json({ ok: true });
}
