import Link from "next/link";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { plaidItems, splitwiseCredentials } from "@/lib/db/schema";
import {
  computeCategoryBreakdown,
  computeDashboardMetrics,
  type CategoryBreakdown,
} from "@/lib/dashboard/metrics";
import {
  computeReconSectionCounts,
  findReauthInstitution,
} from "@/lib/dashboard/counts";
import { parsePeriod, formatPeriod, type Period } from "@/lib/dashboard/period";

import { AppHeader } from "@/components/app-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { DashboardHero } from "@/components/dashboard-hero";

const CATEGORY_LABEL: Record<string, string> = {
  GROCERIES: "Groceries",
  RENT: "Rent",
  UTILITIES: "Utilities",
  TRANSPORT: "Transport",
  SUBSCRIPTION: "Subscriptions",
  SOCIAL: "Social",
  EATING_OUT: "Eating out",
  ENTERTAINMENT: "Entertainment",
  EDUCATION: "Education",
  INCOME: "Income",
  REIMBURSEMENT: "Reimbursement",
  TRANSFER: "Transfer",
  SHOPPING: "Shopping",
  TRAVEL: "Travel",
  HEALTH: "Health",
  FEES: "Fees & loans",
  TAXES: "Taxes & gov",
  OTHER: "Other",
};

function periodLabel(p: Period): string {
  const [fy, fm] = p.from.split("-").map(Number);
  const [ty, tm] = p.to.split("-").map(Number);
  if (fy === ty && fm === tm) {
    return new Date(fy, fm - 1, 1).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
  }
  return formatPeriod(p);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  const params = await searchParams;
  const period = parsePeriod(params);

  const [hasBank] = await db
    .select({ id: plaidItems.id })
    .from(plaidItems)
    .where(eq(plaidItems.userId, user.id))
    .limit(1);
  const [hasSw] = await db
    .select({ userId: splitwiseCredentials.userId })
    .from(splitwiseCredentials)
    .where(eq(splitwiseCredentials.userId, user.id))
    .limit(1);

  const connected = !!hasBank || !!hasSw;

  if (!connected) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader variant="app" />
        <main className="max-w-3xl mx-auto px-6 pt-24 pb-24">
          <div className="bg-surface border border-border rounded-xl p-10 text-center">
            <h1 className="text-2xl tracking-tight font-medium">
              Connect your accounts to begin
            </h1>
            <p className="mt-3 text-secondary leading-relaxed">
              ActualSpend reconciles your bank with Splitwise to show what you
              really spent — not what your bank statement says.
            </p>
            <Link
              href="/accounts"
              className="inline-flex items-center mt-8 h-9 px-4 rounded-md bg-foreground text-background text-sm hover:opacity-90 transition-opacity"
            >
              Manage accounts
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const [metrics, categoryRows, counts, reauthInstitution] = await Promise.all([
    computeDashboardMetrics(user.id, period),
    computeCategoryBreakdown(user.id, period),
    computeReconSectionCounts(user.id),
    findReauthInstitution(user.id),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />

      {reauthInstitution && (
        <div className="border-b border-border bg-amber-soft/40">
          <div className="max-w-5xl mx-auto px-6 py-2.5 flex items-center justify-between text-sm">
            <span className="text-foreground">
              Your{" "}
              <span className="font-medium">{reauthInstitution}</span>{" "}
              connection needs to be refreshed.
            </span>
            <Link
              href="/accounts"
              data-testid="reauth-link"
              className="text-amber-accent hover:underline underline-offset-4"
            >
              Reconnect →
            </Link>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        <div className="flex items-center justify-between mb-8">
          <div
            className="text-sm text-secondary font-mono"
            data-testid="user-email"
          >
            {user.email}
          </div>
          <DateRangePicker from={period.from} to={period.to} />
        </div>

        <DashboardHero
          metrics={metrics}
          periodLabel={periodLabel(period)}
        />

        <Link
          href="/reconcile"
          data-testid="recon-strip"
          className="mt-4 block bg-surface border border-border rounded-xl px-5 py-3 text-sm hover:bg-secondary/40 transition-colors"
        >
          <span className="font-mono">{counts.matched}</span> matched ·{" "}
          <span
            className={`font-mono ${counts.awaiting > 0 ? "text-amber-accent" : ""}`}
          >
            {counts.awaiting}
          </span>{" "}
          awaiting your review ·{" "}
          <span className="font-mono">{counts.splitwiseOnly}</span>{" "}
          Splitwise-only ·{" "}
          <span className="font-mono">{counts.personal}</span> personal
        </Link>

        <CategorySection rows={categoryRows} />
      </main>
    </div>
  );
}

function fmtTxnDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function CategorySection({ rows }: { rows: CategoryBreakdown[] }) {
  if (rows.length === 0) return null;
  const max = rows[0]?.total ?? 0;

  return (
    <section className="mt-10">
      <div className="text-[11px] uppercase tracking-widest text-secondary mb-6">
        Where it went
      </div>
      <div className="space-y-4">
        {rows.map((r) => {
          const label = r.category
            ? (CATEGORY_LABEL[r.category] ?? r.category)
            : "Uncategorized";
          const pct = max > 0 ? (r.total / max) * 100 : 0;
          return (
            <details
              key={r.category ?? "null"}
              data-testid={`cat-${(r.category ?? "uncategorized").toLowerCase()}`}
              className="group"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex items-baseline justify-between text-[15px]">
                  <span className="flex items-baseline gap-2">
                    <span className="text-secondary text-xs transition-transform group-open:rotate-90 inline-block">
                      ›
                    </span>
                    <span>{label}</span>
                    <span className="text-xs text-secondary font-mono">
                      {r.count} txn{r.count === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="font-mono">
                    $
                    {r.total.toLocaleString("en-US", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
                <div className="mt-2 h-px bg-border w-full relative">
                  <div
                    className="absolute left-0 top-0 h-px bg-foreground transition-all"
                    style={{ width: `${pct.toFixed(1)}%` }}
                  />
                </div>
              </summary>
              <ul className="mt-3 pl-5 space-y-1.5 text-sm">
                {r.txns.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-baseline justify-between gap-2"
                  >
                    <span className="flex items-baseline gap-2 min-w-0">
                      <span className="text-xs text-secondary font-mono shrink-0">
                        {fmtTxnDate(t.date)}
                      </span>
                      <span className="truncate">
                        {t.merchantName || t.name}
                      </span>
                    </span>
                    <span className="font-mono text-xs">
                      $
                      {t.amount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}
