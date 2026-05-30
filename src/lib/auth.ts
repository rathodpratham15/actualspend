import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase().trim()))
          .limit(1);

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user, account }) {
      // Credentials sign-ins are already verified in authorize(); just pass through.
      if (account?.provider === "credentials") return true;

      if (account?.provider !== "google" || !user.email) return false;

      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);

      if (existing) {
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
