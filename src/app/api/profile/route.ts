import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, session.user.id));

  return Response.json(profile ?? null);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = [
    "monthlyRent",
    "totalMonthlyRent",
    "ownRentShare",
    "rentPaidBy",
    "rentPaymentMethod",
    "roommatePaybackMethods",
    "roommatePaybackPattern",
    "groceryChannels",
    "onboardingCompletedAt",
  ] as const;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (!(key in body)) continue;
    // Drizzle timestamp columns need a Date object, not an ISO string.
    if (key === "onboardingCompletedAt" && typeof body[key] === "string") {
      updates[key] = new Date(body[key] as string);
    } else {
      updates[key] = body[key];
    }
  }

  await db
    .insert(userProfiles)
    .values({ userId: session.user.id, ...updates })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: updates,
    });

  return Response.json({ ok: true });
}
