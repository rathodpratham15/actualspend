import Link from "next/link";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  plaidItems,
  splitwiseCredentials,
  splitwiseFriends,
  userProfiles,
} from "@/lib/db/schema";
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
import { computeSpendTimeline } from "@/lib/dashboard/spend-timeline";
import { detectLikelyRent } from "@/lib/dashboard/detect-rent";

import { AppHeader } from "@/components/app-header";
import { DashboardHero } from "@/components/dashboard-hero";
import { SpendChartWrapper } from "@/components/spend-chart-wrapper";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { RoommateModal } from "@/components/roommate-modal";
import { TimeRangePicker } from "@/components/time-range-picker";
import { Suspense } from "react";
import { Home, ShoppingBasket, Zap, UtensilsCrossed, Bus, Package, ShoppingBag, Plane, Heart, BookOpen, Check, Clock, X } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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

  const [metrics, categoryRows, counts, reauthInstitution, timeline, profile, friends] =
    await Promise.all([
      computeDashboardMetrics(user.id, period),
      computeCategoryBreakdown(user.id, period),
      computeReconSectionCounts(user.id),
      findReauthInstitution(user.id),
      computeSpendTimeline(user.id),
      db.select().from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1).then(r => r[0] ?? null),
      db.select().from(splitwiseFriends).where(eq(splitwiseFriends.userId, user.id)),
    ]);

  // Show onboarding banner when profile is incomplete and user has transactions.
  // Show banner only when onboarding was never completed AND there's real data to improve.
  const showBanner = !profile?.onboardingCompletedAt && metrics.bankSpent > 0;
  const detectedRent = showBanner ? await detectLikelyRent(user.id) : null;

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-24">
        {/* Header row */}
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <div className="text-xs uppercase tracking-widest text-secondary">Overview</div>
            <h1 className="text-[26px] font-medium tracking-tight mt-1">Your spend, reconciled.</h1>
          </div>
          <Suspense>
            <TimeRangePicker from={period.from} to={period.to} />
          </Suspense>
        </div>

        <DashboardHero
          metrics={metrics}
          periodLabel={periodLabel(period)}
        />

        {showBanner && <OnboardingBanner detectedRent={detectedRent} />}

        {/* Chart + Reconciliation status — side by side on lg */}
        <div className="mt-4 grid lg:grid-cols-[1fr_300px] gap-4">
          <SpendChartWrapper data={timeline} />

          {/* Reconciliation status panel */}
          <div className="surface-card p-5" data-testid="recon-strip">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-medium">Reconciliation</div>
                <div className="text-xs text-secondary">All-time status</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-success-soft">
                <span className="flex items-center gap-2 text-sm text-success">
                  <Check className="h-3.5 w-3.5" strokeWidth={2} /> Matched
                </span>
                <span className="font-mono text-sm text-success" data-testid="count-matched">{counts.matched}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-amber-soft">
                <span className="flex items-center gap-2 text-sm text-amber-accent">
                  <Clock className="h-3.5 w-3.5" strokeWidth={2} /> Awaiting review
                </span>
                <span className="font-mono text-sm text-amber-accent" data-testid="count-awaiting">{counts.awaiting}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-destructive-soft">
                <span className="flex items-center gap-2 text-sm text-destructive">
                  <X className="h-3.5 w-3.5" strokeWidth={2} /> Unmatched
                </span>
                <span className="font-mono text-sm text-destructive">{counts.personal}</span>
              </div>
            </div>
            <Link href="/reconcile" className="mt-4 inline-flex items-center gap-1 text-sm text-emerald-accent hover:underline underline-offset-4">
              Review transactions <span>›</span>
            </Link>
          </div>
        </div>

        <CategorySection rows={categoryRows} />

        {/* Roommate modal — shown once after Splitwise OAuth (?sw=connected) */}
        <Suspense>
          <RoommateModal friends={friends.map(f => ({
            splitwiseUserId: f.splitwiseUserId,
            firstName: f.firstName,
            lastName: f.lastName,
            email: f.email,
            balance: f.balance,
          }))} />
        </Suspense>
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

const CATEGORY_ICON: Record<string, React.ElementType> = {
  RENT: Home, GROCERIES: ShoppingBasket, UTILITIES: Zap,
  EATING_OUT: UtensilsCrossed, TRANSPORT: Bus, SHOPPING: ShoppingBag,
  TRAVEL: Plane, HEALTH: Heart, EDUCATION: BookOpen,
};

function CategorySection({ rows }: { rows: CategoryBreakdown[] }) {
  if (rows.length === 0) return null;
  const max = rows[0]?.total ?? 0;

  const totalAll = rows.reduce((s, r) => s + r.total, 0);

  return (
    <section className="mt-4 surface-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-medium">Categories</div>
          <div className="text-xs text-secondary">After reconciliation</div>
        </div>
        <Link href="/merchants" className="text-xs text-emerald-accent hover:underline underline-offset-4">
          View merchants
        </Link>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {rows.map((r) => {
          const label = r.category ? (CATEGORY_LABEL[r.category] ?? r.category) : "Uncategorized";
          const pct = totalAll > 0 ? Math.round((r.total / totalAll) * 100) : 0;
          const Icon = (r.category && CATEGORY_ICON[r.category]) ? CATEGORY_ICON[r.category] : Package;
          return (
            <AccordionItem key={r.category ?? "null"} value={r.category ?? "null"}
              className="border-border" data-testid={`cat-${(r.category ?? "uncategorized").toLowerCase()}`}>
              <AccordionTrigger className="hover:no-underline py-3 group">
                <div className="flex items-center gap-4 w-full pr-4">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground shrink-0">
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </span>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-accent/70 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-right tabular shrink-0">
                    <div className="font-mono text-sm">${r.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
                    <div className="text-[11px] text-secondary">{pct}%</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-12 pr-2 space-y-2 pb-2">
                  {r.txns.slice(0, 8).map((t) => {
                    const bankLabel = t.merchantName || t.name;
                    const primary = t.swDescription || bankLabel;
                    const shared = t.actualAmount > 0 && t.actualAmount < t.amount - 0.005;
                    return (
                      <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/60 last:border-0">
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{primary}</div>
                          <div className="text-[11px] text-secondary">{fmtTxnDate(t.date)}</div>
                        </div>
                        <div className="text-right font-mono text-xs ml-3">
                          ${t.actualAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {shared && (
                            <div className="text-secondary line-through">
                              ${t.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {r.txns.length > 8 && (
                    <div className="text-xs text-secondary pt-1">+{r.txns.length - 8} more</div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );
}
