import { NextResponse } from "next/server";

// Placeholder for the Welcome-page email capture. Logs the email and returns
// 200. Wire to a real store (Drizzle table or external service) when the
// marketing surface ships beyond this UI preview branch.
export async function POST(req: Request) {
  let email: string | undefined;
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  console.log("[waitlist] signup:", email);
  return NextResponse.json({ ok: true });
}
