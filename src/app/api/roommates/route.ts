import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userRoommates, splitwiseFriends } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const rows = await db
    .select({
      splitwiseUserId: userRoommates.splitwiseUserId,
      firstName: splitwiseFriends.firstName,
      lastName: splitwiseFriends.lastName,
    })
    .from(userRoommates)
    .leftJoin(
      splitwiseFriends,
      eq(splitwiseFriends.splitwiseUserId, userRoommates.splitwiseUserId),
    )
    .where(eq(userRoommates.userId, session.user.id));

  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  let body: { splitwiseUserIds: number[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ids: number[] = (body.splitwiseUserIds ?? []).filter(
    (id) => typeof id === "number",
  );

  // Replace roommate list atomically: delete all then re-insert.
  await db.delete(userRoommates).where(eq(userRoommates.userId, userId));

  if (ids.length > 0) {
    await db.insert(userRoommates).values(
      ids.map((splitwiseUserId) => ({ userId, splitwiseUserId })),
    );
  }

  return Response.json({ ok: true });
}
