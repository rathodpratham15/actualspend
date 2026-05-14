import { db } from "@/lib/db";
import {
  splitwiseCredentials,
  splitwiseExpenseParticipants,
  splitwiseExpenses,
  splitwiseFriends,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { splitwiseFetch } from "@/lib/splitwise/client";
import type {
  GetExpensesResponse,
  GetFriendsResponse,
} from "@/lib/splitwise/types";

// Refreshes the friends directory. Cheap (one API call, ≤100 friends typical)
// and lets the UI render real names instead of "user 4837192".
async function syncFriends(userId: string, accessToken: string): Promise<number> {
  const data = await splitwiseFetch<GetFriendsResponse>(
    "/get_friends",
    accessToken,
  );
  let count = 0;
  for (const f of data.friends) {
    await db
      .insert(splitwiseFriends)
      .values({
        userId,
        splitwiseUserId: f.id,
        firstName: f.first_name,
        lastName: f.last_name,
        email: f.email,
        pictureUrl: f.picture?.medium ?? f.picture?.small ?? null,
      })
      .onConflictDoUpdate({
        target: [splitwiseFriends.userId, splitwiseFriends.splitwiseUserId],
        set: {
          firstName: f.first_name,
          lastName: f.last_name,
          email: f.email,
          pictureUrl: f.picture?.medium ?? f.picture?.small ?? null,
          updatedAt: new Date(),
        },
      });
    count++;
  }
  return count;
}

// Pulls expenses from Splitwise for the given user and upserts them along
// with the full participant breakdown. Uses last_synced_at as a high-water
// mark via the API's `updated_after` filter. Returns the number of expenses
// written this run.
//
// Pass `{ force: true }` to ignore the watermark and re-pull everything.
// Useful after schema changes that need a full backfill (e.g. capturing
// participants for the first time).
export async function syncSplitwiseExpenses(
  userId: string,
  opts: { force?: boolean } = {},
): Promise<number> {
  const [cred] = await db
    .select()
    .from(splitwiseCredentials)
    .where(eq(splitwiseCredentials.userId, userId));
  if (!cred) throw new Error("Splitwise not connected for this user");

  // Refresh the friends cache first — cheap and lets participant rows
  // resolve to display names on render.
  await syncFriends(userId, cred.accessToken);

  const limit = 100;
  let offset = 0;
  let upserted = 0;

  const updatedAfter =
    !opts.force && cred.lastSyncedAt
      ? cred.lastSyncedAt.toISOString()
      : undefined;

  while (true) {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (updatedAfter) params.set("updated_after", updatedAfter);

    const data = await splitwiseFetch<GetExpensesResponse>(
      `/get_expenses?${params.toString()}`,
      cred.accessToken,
    );

    for (const exp of data.expenses) {
      const me = exp.users.find((u) => u.user_id === cred.splitwiseUserId);
      if (!me) continue; // skip expenses we're not party to

      const row = {
        userId,
        splitwiseExpenseId: String(exp.id),
        description: exp.description,
        cost: exp.cost,
        currencyCode: exp.currency_code,
        userShare: me.owed_share,
        paidByUser: me.paid_share,
        date: exp.date.slice(0, 10),
        groupId: exp.group_id,
        isPayment: exp.payment === true,
        deletedAt: exp.deleted_at ? new Date(exp.deleted_at) : null,
      };

      const [expenseRow] = await db
        .insert(splitwiseExpenses)
        .values(row)
        .onConflictDoUpdate({
          target: splitwiseExpenses.splitwiseExpenseId,
          set: {
            description: row.description,
            cost: row.cost,
            currencyCode: row.currencyCode,
            userShare: row.userShare,
            paidByUser: row.paidByUser,
            date: row.date,
            groupId: row.groupId,
            isPayment: row.isPayment,
            deletedAt: row.deletedAt,
          },
        })
        .returning({ id: splitwiseExpenses.id });
      upserted++;

      // Replace this expense's participant rows. Splitwise can edit who
      // was on an expense, so delete + insert is the cleanest way to keep
      // the set in sync.
      await db
        .delete(splitwiseExpenseParticipants)
        .where(eq(splitwiseExpenseParticipants.expenseId, expenseRow.id));
      for (const u of exp.users) {
        await db.insert(splitwiseExpenseParticipants).values({
          expenseId: expenseRow.id,
          splitwiseUserId: u.user_id,
          paidShare: u.paid_share,
          owedShare: u.owed_share,
          netBalance: u.net_balance,
        });
      }
    }

    if (data.expenses.length < limit) break;
    offset += limit;
  }

  await db
    .update(splitwiseCredentials)
    .set({ lastSyncedAt: new Date() })
    .where(eq(splitwiseCredentials.userId, userId));

  return upserted;
}
