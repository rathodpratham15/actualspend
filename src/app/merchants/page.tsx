import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reconciliations, transactions } from "@/lib/db/schema";
import { RECONCILIATION_TYPES, STATES } from "@/lib/reconciliation/types";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { AppHeader } from "@/components/app-header";
import { usd, dateShort } from "@/lib/format";

type MerchantRow = {
  merchant: string;
  channel: string | null;
  totalActual: number;
  txnCount: number;
  lastSeen: string;
};

async function fetchMerchants(userId: string): Promise<MerchantRow[]> {
  // Aggregate actual spend by effective merchant (falling back to merchant_name
  // then raw name). Excludes rejected/ignored rows and CC payment pass-throughs.
  const rows = await db
    .select({
      merchant: sql<string>`COALESCE(${transactions.effectiveMerchant}, ${transactions.merchantName}, ${transactions.name})`,
      channel: transactions.channel,
      totalActual: sql<number>`SUM(${reconciliations.actualAmount}::numeric)`,
      txnCount: sql<number>`COUNT(DISTINCT ${reconciliations.id})::int`,
      lastSeen: sql<string>`MAX(${transactions.date})`,
    })
    .from(reconciliations)
    .innerJoin(
      transactions,
      eq(transactions.id, reconciliations.transactionId),
    )
    .where(
      and(
        eq(reconciliations.userId, userId),
        isNull(transactions.deletedAt),
        // Only real-spend rows — exclude pass-through types.
        ne(
          reconciliations.reconciliationType,
          RECONCILIATION_TYPES.REIMBURSEMENT_RECEIVED,
        ),
        // Exclude user-rejected and ignored rows.
        inArray(reconciliations.state, [
          STATES.AUTO_MATCHED,
          STATES.USER_CONFIRMED,
          STATES.PENDING,
          STATES.MANUAL_MATCH,
        ]),
        // Must have a bank transaction (not SPLITWISE_ONLY).
        sql`${reconciliations.transactionId} IS NOT NULL`,
      ),
    )
    .groupBy(
      sql`COALESCE(${transactions.effectiveMerchant}, ${transactions.merchantName}, ${transactions.name})`,
      transactions.channel,
    )
    .orderBy(sql`SUM(${reconciliations.actualAmount}::numeric) DESC`)
    .limit(50);

  return rows.map((r) => ({
    merchant: r.merchant,
    channel: r.channel,
    totalActual: Number(r.totalActual ?? 0),
    txnCount: Number(r.txnCount ?? 0),
    lastSeen: r.lastSeen ?? "",
  }));
}

export default async function MerchantsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const merchants = await fetchMerchants(session.user.id);
  const maxActual = merchants[0]?.totalActual ?? 1;
  const totalActual = merchants.reduce((s, m) => s + m.totalActual, 0);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-24">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl tracking-tight font-medium">Merchants</h1>
          <div className="text-sm text-secondary font-mono">
            {usd(totalActual, { decimals: 0 })} total
          </div>
        </div>

        <p className="mt-1 text-sm text-secondary">
          Ranked by actual spend — your share only, not what passed through.
        </p>

        {merchants.length === 0 ? (
          <div className="mt-12 text-center text-secondary text-sm">
            No transaction data yet.{" "}
            <span className="text-foreground">Sync your bank</span> and run
            reconcile to see merchants.
          </div>
        ) : (
          <div className="mt-8 space-y-1">
            {merchants.map((m, i) => (
              <MerchantRow
                key={`${m.merchant}-${i}`}
                rank={i + 1}
                merchant={m.merchant}
                channel={m.channel}
                totalActual={m.totalActual}
                txnCount={m.txnCount}
                lastSeen={m.lastSeen}
                barWidth={maxActual > 0 ? m.totalActual / maxActual : 0}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function MerchantRow({
  rank,
  merchant,
  channel,
  totalActual,
  txnCount,
  lastSeen,
  barWidth,
}: {
  rank: number;
  merchant: string;
  channel: string | null;
  totalActual: number;
  txnCount: number;
  lastSeen: string;
  barWidth: number; // 0–1
}) {
  return (
    <div className="group rounded-xl px-4 py-3 hover:bg-surface transition-colors">
      <div className="flex items-center gap-3">
        {/* Rank */}
        <div className="w-6 text-right font-mono text-xs text-secondary shrink-0">
          {rank}
        </div>

        {/* Name + channel badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] truncate">{merchant}</span>
            {channel && (
              <span className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-border/60 text-secondary shrink-0">
                via {channel}
              </span>
            )}
          </div>
          {/* Bar */}
          <div className="mt-1.5 h-px bg-border w-full relative">
            <div
              className="absolute left-0 top-0 h-px bg-foreground/40 transition-all"
              style={{ width: `${barWidth * 100}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="text-right shrink-0">
          <div className="font-mono text-sm">
            {usd(totalActual, { decimals: 0 })}
          </div>
          <div className="text-[11px] text-secondary mt-0.5">
            {txnCount} txn{txnCount !== 1 ? "s" : ""} · {lastSeen ? dateShort(lastSeen) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
