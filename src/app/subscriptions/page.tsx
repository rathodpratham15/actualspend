import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import {
  computeSubscriptions,
  computeCardExposure,
  fetchMerchantTransactions,
  type SubscriptionRow,
} from "@/lib/dashboard/subscriptions";
import { ExposureRow } from "@/components/subscriptions-exposure-row";
import { MerchantFavicon } from "@/components/merchant-favicon";
import { TimeRangePicker } from "@/components/time-range-picker";
import { parsePeriod } from "@/lib/dashboard/period";
import { usd } from "@/lib/format";
import { Repeat, Users, Calendar, CreditCard, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

const EXPOSURE_PAGE_SIZE = 20;

// Default lookback for the subscriptions page: 12 months.
function defaultPeriod(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setFullYear(from.getFullYear() - 1);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { from: fmt(from), to: fmt(now) };
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const params = await searchParams;

  // Use 12-month window as default (wider than dashboard's current-month default).
  const hasParams =
    (typeof params.from === "string" && params.from) ||
    (typeof params.to === "string" && params.to);
  const period = hasParams ? parsePeriod(params) : defaultPeriod();

  const page = Math.max(1, parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);

  const subs = await computeSubscriptions(session.user.id, period.from, period.to);
  const recurringMerchants = new Set(subs.map((s) => s.merchant));

  const exposure = await computeCardExposure(
    session.user.id,
    period.from,
    period.to,
    recurringMerchants,
  );

  const totalPages = Math.max(1, Math.ceil(exposure.length / EXPOSURE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedExposure = exposure.slice(
    (safePage - 1) * EXPOSURE_PAGE_SIZE,
    safePage * EXPOSURE_PAGE_SIZE,
  );

  const txnsByMerchant = await fetchMerchantTransactions(
    session.user.id,
    pagedExposure.map((r) => r.merchant),
    period.from,
    period.to,
  );

  const totalMonthly = subs.reduce((s, r) => s + r.monthlyActual, 0);
  const sharedCount = subs.filter((r) => r.isShared).length;
  const nonRecurring = exposure.filter((r) => !r.isRecurring);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-24">
        {/* Header row */}
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-secondary">Card usage</div>
            <h1 className="text-[22px] font-medium tracking-tight mt-1">Where your card is used</h1>
          </div>
          <Suspense>
            <TimeRangePicker from={period.from} to={period.to} />
          </Suspense>
        </div>

        {/* Summary strip */}
        {(subs.length > 0 || exposure.length > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <SummaryCard label="All places" value={String(exposure.length)} sub="distinct merchants" />
            <SummaryCard label="Recurring" value={String(subs.length)} sub="stable charges" />
            <SummaryCard label="Est. monthly" value={usd(totalMonthly, { decimals: 0 })} sub="recurring actual" />
            <SummaryCard label="Shared" value={String(sharedCount)} sub="via Splitwise" />
          </div>
        )}

        {/* ── Recurring charges ─────────────────────────────────────────── */}
        <Section
          icon={<Repeat className="h-4 w-4" strokeWidth={1.5} />}
          title="Recurring charges"
          subtitle={`Appeared in 3+ months with stable amounts within the selected period`}
          count={subs.length}
        >
          {subs.length === 0 ? (
            <EmptySection
              message="No recurring charges detected in this period."
              hint="Try widening the date range — we need at least 3 months of consistent charges."
            />
          ) : (
            <>
              <div className="flex items-center gap-4 px-5 py-2.5 border-b border-border bg-background/50 text-[10px] uppercase tracking-widest text-secondary">
                <div className="flex-1">Merchant</div>
                <div className="w-24 text-center hidden sm:block">6-mo trend</div>
                <div className="w-20 text-right hidden sm:block">Bank</div>
                <div className="w-20 text-right">Actual/mo</div>
                <div className="w-16 text-right">Active</div>
              </div>
              <div className="divide-y divide-border">
                {subs.map((sub) => (
                  <RecurringRow key={sub.merchant} sub={sub} />
                ))}
              </div>
            </>
          )}
        </Section>

        {/* ── All places ────────────────────────────────────────────────── */}
        <Section
          icon={<CreditCard className="h-4 w-4" strokeWidth={1.5} />}
          title="All places"
          subtitle="Every merchant that charged your card in this period"
          count={exposure.length}
          className="mt-4"
        >
          {exposure.length === 0 ? (
            <EmptySection message="No transactions found in this period." />
          ) : (
            <>
              <div className="flex items-center gap-4 px-5 py-2.5 border-b border-border bg-background/50 text-[10px] uppercase tracking-widest text-secondary">
                {/* spacer for chevron column */}
                <div className="w-4 shrink-0" />
                <div className="flex-1">Merchant</div>
                <div className="w-28 text-right hidden sm:block">First seen</div>
                <div className="w-28 text-right hidden sm:block">Last seen</div>
                <div className="w-14 text-right">Txns</div>
                <div className="w-24 text-right">Total spent</div>
              </div>
              <div className="divide-y divide-border">
                {pagedExposure.map((row) => (
                  <ExposureRow
                    key={row.merchant}
                    row={row}
                    periodTo={period.to}
                    txns={txnsByMerchant[row.merchant] ?? []}
                  />
                ))}
              </div>
              {totalPages > 1 && (
                <ExposurePagination
                  page={safePage}
                  totalPages={totalPages}
                  totalCount={exposure.length}
                  from={period.from}
                  to={period.to}
                />
              )}
            </>
          )}
        </Section>

        {nonRecurring.length > 0 && (
          <p className="mt-4 text-xs text-secondary">
            {nonRecurring.length} of {exposure.length} merchants charged you once or twice — they appear in "All places" but not "Recurring."
          </p>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="surface-card p-4">
      <div className="text-[10px] uppercase tracking-widest text-secondary">{label}</div>
      <div className="font-mono text-xl font-medium mt-1">{value}</div>
      <div className="text-xs text-secondary mt-0.5">{sub}</div>
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  count,
  children,
  className = "",
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`surface-card overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-secondary">{icon}</span>
          <div>
            <div className="text-sm font-medium">{title}</div>
            <div className="text-xs text-secondary mt-0.5">{subtitle}</div>
          </div>
        </div>
        <span className="text-xs text-secondary font-mono shrink-0">{count}</span>
      </div>
      {children}
    </div>
  );
}

function EmptySection({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="px-5 py-8 text-center">
      <p className="text-sm text-secondary">{message}</p>
      {hint && <p className="text-xs text-secondary mt-1">{hint}</p>}
    </div>
  );
}

function Sparkline({ amounts }: { amounts: { month: string; actual: number }[] }) {
  if (amounts.length < 2) return <span className="text-secondary text-xs">—</span>;
  const vals = amounts.map((a) => a.actual);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const range = max - min || 1;
  const H = 24;
  const W = 80;
  const step = W / (vals.length - 1);

  const points = vals
    .map((v, i) => `${i * step},${H - ((v - min) / range) * H}`)
    .join(" ");

  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-emerald-accent/70"
      />
      <circle
        cx={(vals.length - 1) * step}
        cy={H - ((vals[vals.length - 1] - min) / range) * H}
        r="2.5"
        className="fill-emerald-accent"
      />
    </svg>
  );
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RecurringRow({ sub }: { sub: SubscriptionRow }) {
  const isDiscounted = sub.monthlyActual < sub.monthlyBank - 0.5;
  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <MerchantFavicon name={sub.merchant} />
        <div className="min-w-0">
          <div className="text-sm font-medium truncate flex items-center gap-1.5">
            {sub.merchant}
            {sub.isShared && (
              <span title="Shared via Splitwise"><Users className="h-3 w-3 text-secondary shrink-0" strokeWidth={1.5} /></span>
            )}
          </div>
          <div className="text-[10px] text-secondary mt-0.5 flex items-center gap-1.5">
            {sub.channel && sub.channel !== sub.merchant && (
              <span>via {sub.channel}</span>
            )}
            <span className="flex items-center gap-0.5">
              <Calendar className="h-2.5 w-2.5" strokeWidth={1.5} />
              {shortDate(sub.lastSeen)}
            </span>
          </div>
        </div>
      </div>
      <div className="w-24 hidden sm:flex justify-center">
        <Sparkline amounts={sub.monthlyAmounts} />
      </div>
      <div className="w-20 text-right hidden sm:block">
        <span className="font-mono text-sm text-secondary">{usd(sub.monthlyBank, { decimals: 0 })}</span>
      </div>
      <div className="w-20 text-right">
        <span className="font-mono text-sm font-medium">{usd(sub.monthlyActual, { decimals: 0 })}</span>
        {isDiscounted && <div className="text-[10px] text-emerald-accent">shared</div>}
      </div>
      <div className="w-16 text-right">
        <span className="text-sm text-secondary font-mono flex items-center justify-end gap-1">
          <Repeat className="h-3 w-3 shrink-0" strokeWidth={1.5} />
          {sub.monthsActive}mo
        </span>
      </div>
    </div>
  );
}

function ExposurePagination({
  page,
  totalPages,
  totalCount,
  from,
  to,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  from: string;
  to: string;
}) {
  const base = `?from=${from}&to=${to}`;
  const btnCls =
    "inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors";
  const activeCls = `${btnCls} hover:bg-muted/60 text-foreground`;
  const disabledCls = `${btnCls} opacity-30 pointer-events-none`;

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border text-xs text-secondary">
      <span className="font-mono">
        {(page - 1) * EXPOSURE_PAGE_SIZE + 1}–
        {Math.min(page * EXPOSURE_PAGE_SIZE, totalCount)} of {totalCount}
      </span>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={`${base}&page=${page - 1}`} className={activeCls}>
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </Link>
        ) : (
          <span className={disabledCls}>
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </span>
        )}
        <span className="px-2 font-mono">
          {page} / {totalPages}
        </span>
        {page < totalPages ? (
          <Link href={`${base}&page=${page + 1}`} className={activeCls}>
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className={disabledCls}>
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}
