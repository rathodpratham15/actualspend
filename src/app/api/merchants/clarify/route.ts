import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { transactions, userMerchantRules } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json();
  const { pattern, destination, channel } = body as {
    pattern?: string;
    destination?: string;
    channel?: string;
  };

  if (!pattern || !destination || !channel) {
    return NextResponse.json({ error: "pattern, destination, and channel required" }, { status: 400 });
  }

  // Upsert the rule.
  await db
    .insert(userMerchantRules)
    .values({ id: crypto.randomUUID(), userId, rawPattern: pattern, destination, channel })
    .onConflictDoUpdate({
      target: [userMerchantRules.userId, userMerchantRules.rawPattern],
      set: { destination, channel },
    });

  // Apply immediately to all matching transactions for this user.
  await db
    .update(transactions)
    .set({ effectiveMerchant: destination })
    .where(
      and(
        eq(transactions.userId, userId),
        sql`LOWER(${transactions.name}) = LOWER(${pattern})`,
      ),
    );

  return NextResponse.json({ ok: true });
}
