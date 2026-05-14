import { db } from "@/lib/db";
import { splitwiseCredentials, splitwiseExpenses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { splitwiseFetch } from "@/lib/splitwise/client";
import type { GetExpensesResponse } from "@/lib/splitwise/types";

// Pulls expenses from Splitwise for the given user and upserts them. Uses
// last_synced_at as a high-water mark via the API's `updated_after` filter.
// Returns the number of expenses written this run.
export async function syncSplitwiseExpenses(userId: string): Promise<number> {
  const [cred] = await db
    .select()
    .from(splitwiseCredentials)
    .where(eq(splitwiseCredentials.userId, userId));
  if (!cred) throw new Error("Splitwise not connected for this user");

  const limit = 100;
  let offset = 0;
  let upserted = 0;

  const updatedAfter = cred.lastSyncedAt
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

      await db
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
        });
      upserted++;
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
