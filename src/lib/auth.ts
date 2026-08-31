import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifySamlTicket } from "@/lib/auth/saml-ticket";

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

        if (!user?.passwordHash || user.scimActive === false) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    // Bridge provider for SAML SSO — never called directly by users. The
    // /api/auth/saml/acs handler validates the IdP assertion, then mints a
    // one-time ticket and calls signIn("saml", { ticket }) in-process. See
    // src/lib/auth/saml-ticket.ts for why a raw user id can't be trusted here.
    Credentials({
      id: "saml",
      name: "SAML SSO",
      credentials: { ticket: { label: "Ticket", type: "text" } },
      async authorize(credentials) {
        const ticket = credentials?.ticket as string | undefined;
        if (!ticket) return null;

        const userId = await verifySamlTicket(ticket);
        if (!userId) return null;

        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user || user.scimActive === false) return null;

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

      if (existing?.scimActive === false) return false;

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
