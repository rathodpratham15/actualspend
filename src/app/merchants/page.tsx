import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reconciliations, transactions } from "@/lib/db/schema";
import { RECONCILIATION_TYPES, STATES } from "@/lib/reconciliation/types";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { AppHeader } from "@/components/app-header";
import { MonthPicker } from "@/components/month-picker";
import { usd, dateShort } from "@/lib/format";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentYearMonth(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

function parseYearMonth(raw: string | undefined): string {
  if (!raw) return currentYearMonth();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  return currentYearMonth();
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

type MerchantRow = {
  merchant: string;
  channel: string | null;
  totalActual: number;
  txnCount: number;
  lastSeen: string;
};

type ChannelRow = {
  channel: string;
  totalActual: number;
  txnCount: number;
  lastSeen: string;
};

const BASE_WHERE = (userId: string) =>
  and(
    eq(reconciliations.userId, userId),
    isNull(transactions.deletedAt),
    ne(
      reconciliations.reconciliationType,
      RECONCILIATION_TYPES.REIMBURSEMENT_RECEIVED,
    ),
    inArray(reconciliations.state, [
      STATES.AUTO_MATCHED,
      STATES.USER_CONFIRMED,
      STATES.PENDING,
      STATES.MANUAL_MATCH,
    ]),
    sql`${reconciliations.transactionId} IS NOT NULL`,
  );

async function fetchMerchants(
  userId: string,
  yearMonth: string,
): Promise<MerchantRow[]> {
  const [y, m] = yearMonth.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  // Last day of month
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const rows = await db
    .select({
      merchant: sql<string>`COALESCE(${transactions.effectiveMerchant}, ${transactions.merchantName}, ${transactions.name})`,
      channel: transactions.channel,
      totalActual: sql<number>`SUM(${reconciliations.actualAmount}::numeric)`,
      txnCount: sql<number>`COUNT(DISTINCT ${reconciliations.id})::int`,
      lastSeen: sql<string>`MAX(${transactions.date})`,
    })
    .from(reconciliations)
    .innerJoin(transactions, eq(transactions.id, reconciliations.transactionId))
    .where(
      and(
        BASE_WHERE(userId),
        sql`${transactions.date} >= ${from}`,
        sql`${transactions.date} <= ${to}`,
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

async function fetchChannels(
  userId: string,
  yearMonth: string,
): Promise<ChannelRow[]> {
  const [y, m] = yearMonth.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const rows = await db
    .select({
      channel: transactions.channel,
      totalActual: sql<number>`SUM(${reconciliations.actualAmount}::numeric)`,
      txnCount: sql<number>`COUNT(DISTINCT ${reconciliations.id})::int`,
      lastSeen: sql<string>`MAX(${transactions.date})`,
    })
    .from(reconciliations)
    .innerJoin(transactions, eq(transactions.id, reconciliations.transactionId))
    .where(
      and(
        BASE_WHERE(userId),
        sql`${transactions.channel} IS NOT NULL`,
        sql`${transactions.date} >= ${from}`,
        sql`${transactions.date} <= ${to}`,
      ),
    )
    .groupBy(transactions.channel)
    .orderBy(sql`SUM(${reconciliations.actualAmount}::numeric) DESC`);

  return rows
    .filter((r): r is typeof r & { channel: string } => !!r.channel)
    .map((r) => ({
      channel: r.channel,
      totalActual: Number(r.totalActual ?? 0),
      txnCount: Number(r.txnCount ?? 0),
      lastSeen: r.lastSeen ?? "",
    }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MerchantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const params = await searchParams;
  const yearMonth = parseYearMonth(params.m as string | undefined);

  const [merchants, channels] = await Promise.all([
    fetchMerchants(session.user.id, yearMonth),
    fetchChannels(session.user.id, yearMonth),
  ]);

  const totalActual = merchants.reduce((s, m) => s + m.totalActual, 0);
  const hasChannels = channels.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-24">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl tracking-tight font-medium">Merchants</h1>
            <p className="mt-0.5 text-sm text-secondary">
              Ranked by actual spend — your share only.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {totalActual > 0 && (
              <span className="text-sm font-mono text-secondary">
                {usd(totalActual, { decimals: 0 })} total
              </span>
            )}
            <Suspense>
              <MonthPicker yearMonth={yearMonth} />
            </Suspense>
          </div>
        </div>

        {merchants.length === 0 ? (
          <div className="mt-16 text-center text-secondary text-sm">
            No spend data for {monthLabel(yearMonth)}.
          </div>
        ) : hasChannels ? (
          /* Two-column layout when delivery channels exist */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
            <MerchantTable rows={merchants} />
            <ChannelTable rows={channels} />
          </div>
        ) : (
          <MerchantTable rows={merchants} />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

function MerchantTable({ rows }: { rows: MerchantRow[] }) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-widest text-secondary font-normal w-8">
              #
            </th>
            <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-widest text-secondary font-normal">
              Merchant
            </th>
            <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-widest text-secondary font-normal hidden sm:table-cell">
              Txns
            </th>
            <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-widest text-secondary font-normal hidden sm:table-cell">
              Last
            </th>
            <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-widest text-secondary font-normal">
              Actual
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={`${r.merchant}-${i}`} className="hover:bg-background/50 transition-colors">
              <td className="px-4 py-3 font-mono text-xs text-secondary text-right">
                {i + 1}
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{r.merchant}</span>
                  {r.channel && (
                    <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-border/60 text-secondary hidden sm:inline">
                      {r.channel}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-3 text-right font-mono text-xs text-secondary hidden sm:table-cell">
                {r.txnCount}
              </td>
              <td className="px-3 py-3 text-right font-mono text-xs text-secondary hidden sm:table-cell">
                {r.lastSeen ? dateShort(r.lastSeen) : "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm">
                {usd(r.totalActual, { decimals: 0 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChannelTable({ rows }: { rows: ChannelRow[] }) {
  const total = rows.reduce((s, r) => s + r.totalActual, 0);
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border">
        <span className="text-[11px] uppercase tracking-widest text-secondary">
          By channel
        </span>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const pct = total > 0 ? (r.totalActual / total) * 100 : 0;
            return (
              <tr key={r.channel} className="hover:bg-background/50 transition-colors">
                <td className="px-4 py-3">
                  <div>{r.channel}</div>
                  {/* Inline mini-bar */}
                  <div className="mt-1.5 h-px bg-border w-full relative">
                    <div
                      className="absolute left-0 top-0 h-px bg-foreground/50"
                      style={{ width: `${pct.toFixed(1)}%` }}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="font-mono text-sm">
                    {usd(r.totalActual, { decimals: 0 })}
                  </div>
                  <div className="text-[11px] text-secondary font-mono mt-0.5">
                    {r.txnCount} txn{r.txnCount !== 1 ? "s" : ""}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
