import { NextRequest, NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { extractSamlLogin, getSamlProvider } from "@/lib/auth/saml";
import { mintSamlTicket } from "@/lib/auth/saml-ticket";
import { signIn } from "@/lib/auth";

async function findOrCreateSamlUser(login: ReturnType<typeof extractSamlLogin>) {
  const [existing] = await db
    .select()
    .from(users)
    .where(or(eq(users.samlNameId, login.nameId), eq(users.email, login.email)))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({ samlNameId: login.nameId, samlIdp: login.idpEntityId })
      .where(eq(users.id, existing.id));
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      email: login.email,
      name: login.name,
      emailVerified: new Date(),
      samlNameId: login.nameId,
      samlIdp: login.idpEntityId,
    })
    .returning();
  return created;
}

// Assertion Consumer Service — the IdP POSTs the SAMLResponse here.
export async function POST(req: NextRequest) {
  const saml = getSamlProvider();
  if (!saml) {
    return NextResponse.json({ error: "SAML SSO is not configured" }, { status: 501 });
  }

  const form = await req.formData();
  const samlResponse = form.get("SAMLResponse");
  const relayState = form.get("RelayState");
  if (typeof samlResponse !== "string") {
    return NextResponse.json({ error: "Missing SAMLResponse" }, { status: 400 });
  }

  let profile: Record<string, unknown> | null;
  try {
    const result = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });
    profile = result.profile as Record<string, unknown> | null;
  } catch (err) {
    console.error("saml_acs validation error:", err);
    return NextResponse.redirect(new URL("/login?error=saml_invalid", req.url));
  }

  if (!profile) {
    return NextResponse.redirect(new URL("/login?error=saml_invalid", req.url));
  }

  const login = extractSamlLogin(profile);
  if (!login.email) {
    return NextResponse.redirect(new URL("/login?error=saml_no_email", req.url));
  }

  const user = await findOrCreateSamlUser(login);
  if (user.scimActive === false) {
    return NextResponse.redirect(new URL("/login?error=account_disabled", req.url));
  }

  const ticket = await mintSamlTicket(user.id);
  const redirectTo = typeof relayState === "string" && relayState.startsWith("/") ? relayState : "/";

  await signIn("saml", { ticket, redirectTo, redirect: true });
}
