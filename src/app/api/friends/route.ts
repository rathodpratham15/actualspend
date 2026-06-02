import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { splitwiseFriends, userRoommates, splitwiseExpenseParticipants } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const userId = session.user.id;

  const [friends, roommates] = await Promise.all([
    db.select().from(splitwiseFriends).where(eq(splitwiseFriends.userId, userId)),
    db.select({ splitwiseUserId: userRoommates.splitwiseUserId })
      .from(userRoommates).where(eq(userRoommates.userId, userId)),
  ]);

  const roommateSet = new Set(roommates.map((r) => r.splitwiseUserId));

  // Expense count per friend via participants table.
  const counts = await db
    .select({
      splitwiseUserId: splitwiseExpenseParticipants.splitwiseUserId,
      count: sql<number>`count(*)::int`,
    })
    .from(splitwiseExpenseParticipants)
    .groupBy(splitwiseExpenseParticipants.splitwiseUserId);

  const countMap = new Map(counts.map((c) => [c.splitwiseUserId, c.count]));

  const result = friends.map((f) => ({
    id: f.splitwiseUserId,
    name: `${f.firstName ?? ""} ${f.lastName ?? ""}`.trim() || `User ${f.splitwiseUserId}`,
    email: f.email,
    avatar_url: f.pictureUrl,
    balance: Number(f.balance),
    is_roommate: roommateSet.has(f.splitwiseUserId),
    expense_count: countMap.get(f.splitwiseUserId) ?? 0,
  }));

  // Sort: roommates first, then by absolute balance descending.
  result.sort((a, b) => {
    if (a.is_roommate !== b.is_roommate) return a.is_roommate ? -1 : 1;
    return Math.abs(b.balance) - Math.abs(a.balance);
  });

  return Response.json(result);
}
