import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { extractSamlLogin, getSamlProvider } from "@/lib/auth/saml";
import { mintSamlTicket } from "@/lib/auth/saml-ticket";
import { signIn } from "@/lib/auth";
import { SAML_STATE_COOKIE, verifySamlState } from "@/lib/auth/saml-state";

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
  if (!getSamlProvider()) {
    return NextResponse.json({ error: "SAML SSO is not configured" }, { status: 501 });
  }

  // The state cookie set at /login binds this response to the browser that
  // started the flow (InResponseTo check) and carries the trusted destination.
  // It is single-use: cleared on every outcome below.
  const stateCookie = req.cookies.get(SAML_STATE_COOKIE)?.value;
  const state = stateCookie ? await verifySamlState(stateCookie) : null;
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${code}`, req.url), 303);
    res.cookies.delete({ name: SAML_STATE_COOKIE, path: "/api/auth/saml" });
    return res;
  };
  if (!state) return fail("saml_invalid");

  const saml = getSamlProvider({ expectedRequestId: state.requestId })!;

  const form = await req.formData();
  const samlResponse = form.get("SAMLResponse");
  if (typeof samlResponse !== "string") {
    return NextResponse.json({ error: "Missing SAMLResponse" }, { status: 400 });
  }

  let profile: Record<string, unknown> | null;
  try {
    const result = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });
    profile = result.profile as Record<string, unknown> | null;
  } catch (err) {
    console.error("saml_acs validation error:", err);
    return fail("saml_invalid");
  }

  if (!profile) return fail("saml_invalid");

  const login = extractSamlLogin(profile);
  if (!login.email) {
    return fail("saml_no_email");
  }

  const user = await findOrCreateSamlUser(login);
  if (user.scimActive === false) {
    return fail("account_disabled");
  }

  const ticket = await mintSamlTicket(user.id);
  const redirectTo = state.redirectTo;

  // Consume the state cookie before handing off to signIn (which redirects).
  (await cookies()).delete({ name: SAML_STATE_COOKIE, path: "/api/auth/saml" });
  await signIn("saml", { ticket, redirectTo, redirect: true });
}
