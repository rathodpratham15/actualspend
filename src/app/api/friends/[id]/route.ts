import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  splitwiseFriends,
  splitwiseExpenses,
  splitwiseExpenseParticipants,
  userRoommates,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const splitwiseUserId = parseInt(id, 10);
  if (isNaN(splitwiseUserId)) return new Response("Invalid id", { status: 400 });

  const userId = session.user.id;

  const [friend, roommateRows] = await Promise.all([
    db.select().from(splitwiseFriends)
      .where(and(eq(splitwiseFriends.userId, userId), eq(splitwiseFriends.splitwiseUserId, splitwiseUserId)))
      .limit(1).then((r) => r[0] ?? null),
    db.select().from(userRoommates)
      .where(and(eq(userRoommates.userId, userId), eq(userRoommates.splitwiseUserId, splitwiseUserId)))
      .limit(1),
  ]);

  if (!friend) return new Response("Not found", { status: 404 });

  // Find expenses where this friend participated.
  const friendParticipations = await db
    .select({ expenseId: splitwiseExpenseParticipants.expenseId })
    .from(splitwiseExpenseParticipants)
    .where(eq(splitwiseExpenseParticipants.splitwiseUserId, splitwiseUserId));

  const expenseIds = [...new Set(friendParticipations.map((p) => p.expenseId))];

  let timeline: {
    id: string;
    description: string | null;
    date: string;
    total: number;
    your_share: number;
    group_name: string;
  }[] = [];

  if (expenseIds.length > 0) {
    const expenses = await db
      .select()
      .from(splitwiseExpenses)
      .where(and(eq(splitwiseExpenses.userId, userId), inArray(splitwiseExpenses.id, expenseIds)))
      .orderBy(splitwiseExpenses.date);

    timeline = expenses
      .filter((e) => !e.isPayment && !e.deletedAt)
      .map((e) => ({
        id: e.id,
        description: e.description,
        date: e.date,
        total: Number(e.cost),
        your_share: Number(e.userShare),
        group_name: e.groupId ? `Group ${e.groupId}` : "Direct",
      }))
      .reverse(); // most recent first
  }

  return Response.json({
    friend: {
      id: splitwiseUserId,
      name: `${friend.firstName ?? ""} ${friend.lastName ?? ""}`.trim(),
      email: friend.email,
      avatar_url: friend.pictureUrl,
    },
    balance: Number(friend.balance),
    expense_count: timeline.length,
    is_roommate: roommateRows.length > 0,
    timeline,
  });
}
