import { auth } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { computeSubscriptions, type SubscriptionRow } from "@/lib/dashboard/subscriptions";
import { MerchantFavicon } from "@/components/merchant-favicon";
import { usd } from "@/lib/format";
import { Repeat, Users, Calendar } from "lucide-react";

export default async function SubscriptionsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const subs = await computeSubscriptions(session.user.id);

  const totalMonthly = subs.reduce((s, r) => s + r.monthlyActual, 0);
  const sharedCount = subs.filter((r) => r.isShared).length;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-24">
        {/* Header */}
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-widest text-secondary">Subscriptions</div>
          <h1 className="text-[22px] font-medium tracking-tight mt-1">Recurring charges</h1>
          <p className="text-sm text-secondary mt-1">
            Merchants that charged you in 3+ of the last 12 months with stable amounts.
          </p>
        </div>

        {subs.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <SummaryCard
                label="Est. monthly"
                value={usd(totalMonthly, { decimals: 0 })}
                sub="combined actual"
              />
              <SummaryCard
                label="Active"
                value={String(subs.length)}
                sub={`subscription${subs.length !== 1 ? "s" : ""}`}
              />
              <SummaryCard
                label="Shared"
                value={String(sharedCount)}
                sub="via Splitwise"
              />
            </div>

            {/* Table */}
            <div className="surface-card overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-3 border-b border-border bg-background/50 text-[11px] uppercase tracking-widest text-secondary">
                <div className="flex-1">Merchant</div>
                <div className="w-24 text-center hidden sm:block">Trend</div>
                <div className="w-20 text-right hidden sm:block">Bank</div>
                <div className="w-20 text-right">Actual/mo</div>
                <div className="w-16 text-right">Active</div>
              </div>

              <div className="divide-y divide-border">
                {subs.map((sub) => (
                  <SubscriptionRow key={sub.merchant} sub={sub} />
                ))}
              </div>
            </div>

            <p className="mt-4 text-xs text-secondary">
              Actual/mo reflects your reconciled share — shared expenses show your portion only.
              Last 12 months of data.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="surface-card p-4">
      <div className="text-[11px] uppercase tracking-widest text-secondary">{label}</div>
      <div className="font-mono text-xl font-medium mt-1">{value}</div>
      <div className="text-xs text-secondary mt-0.5">{sub}</div>
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
    .map((v, i) => {
      const x = i * step;
      const y = H - ((v - min) / range) * H;
      return `${x},${y}`;
    })
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
      {/* Last dot */}
      <circle
        cx={(vals.length - 1) * step}
        cy={H - ((vals[vals.length - 1] - min) / range) * H}
        r="2.5"
        className="fill-emerald-accent"
      />
    </svg>
  );
}

function lastSeenLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function SubscriptionRow({ sub }: { sub: SubscriptionRow }) {
  const isDiscounted = sub.monthlyActual < sub.monthlyBank - 0.5;

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
      {/* Merchant */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <MerchantFavicon name={sub.merchant} />
        <div className="min-w-0">
          <div className="text-sm font-medium truncate flex items-center gap-1.5">
            {sub.merchant}
            {sub.isShared && (
              <span title="Shared via Splitwise">
                <Users className="h-3 w-3 text-secondary inline" strokeWidth={1.5} />
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {sub.channel && sub.channel !== sub.merchant && (
              <span className="text-[10px] text-secondary">via {sub.channel}</span>
            )}
            <span className="text-[10px] text-secondary flex items-center gap-0.5">
              <Calendar className="h-2.5 w-2.5" strokeWidth={1.5} />
              {lastSeenLabel(sub.lastSeen)}
            </span>
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <div className="w-24 flex justify-center hidden sm:flex">
        <Sparkline amounts={sub.monthlyAmounts} />
      </div>

      {/* Bank amount */}
      <div className="w-20 text-right hidden sm:block">
        <span className="font-mono text-sm text-secondary">
          {usd(sub.monthlyBank, { decimals: 0 })}
        </span>
      </div>

      {/* Actual amount */}
      <div className="w-20 text-right">
        <span className="font-mono text-sm font-medium">
          {usd(sub.monthlyActual, { decimals: 0 })}
        </span>
        {isDiscounted && (
          <div className="text-[10px] text-emerald-accent">shared</div>
        )}
      </div>

      {/* Months active */}
      <div className="w-16 text-right">
        <span className="flex items-center justify-end gap-1 text-sm text-secondary">
          <Repeat className="h-3 w-3 shrink-0" strokeWidth={1.5} />
          {sub.monthsActive}mo
        </span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-16 text-center">
      <Repeat className="h-8 w-8 text-secondary mx-auto mb-3" strokeWidth={1} />
      <p className="text-secondary text-sm">No recurring charges detected yet.</p>
      <p className="text-xs text-secondary mt-1">
        We look for merchants that appear in 3+ months with stable amounts.
        Check back after a few months of transaction history.
      </p>
    </div>
  );
}
