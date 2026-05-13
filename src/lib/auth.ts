import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

// Auth.js v5 + Google. JWT sessions (no DB-backed session table needed).
// Ported from the dad-gift project pattern; trimmed for single-user v1
// (no Credentials provider, no admin allowlist, no firstName/lastName split).
export const { handlers, auth, signIn, signOut } = NextAuth({
  // AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET are auto-picked up from env.
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) return false;

      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);

      if (existing) {
        // Backfill profile image if we didn't have it before.
        if (!existing.image && user.image) {
          await db
            .update(users)
            .set({ image: user.image })
            .where(eq(users.id, existing.id));
        }
        user.id = existing.id;
      } else {
        const [created] = await db
          .insert(users)
          .values({
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
            emailVerified: new Date(),
          })
          .returning();
        user.id = created.id;
      }
      return true;
    },
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
