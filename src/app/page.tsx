import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { plaidItems, splitwiseCredentials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DateRangePicker } from "@/components/date-range-picker";
import {
  formatPeriod,
  parsePeriod,
  type Period,
} from "@/lib/dashboard/period";
import {
  computeCategoryBreakdown,
  computeDashboardMetrics,
  type CategoryBreakdown,
  type DashboardMetrics,
} from "@/lib/dashboard/metrics";
import { cn } from "@/lib/utils";

function fmtUSD(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtUSDPrecise(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function HeroMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && (
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

function ActualSpendHero({
  metrics,
  period,
}: {
  metrics: DashboardMetrics;
  period: Period;
}) {
  const passthrough = metrics.bankSpent - metrics.actualSpend;
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardDescription>
          Actual personal spend · {formatPeriod(period)}
        </CardDescription>
        <CardTitle className="text-4xl font-semibold tracking-tight">
          {fmtUSDPrecise(metrics.actualSpend)}
        </CardTitle>
        {metrics.bankSpent > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Your bank shows{" "}
            <span className="font-medium text-foreground">
              {fmtUSDPrecise(metrics.bankSpent)}
            </span>{" "}
            of outflow.{" "}
            {passthrough > 0 ? (
              <>
                About{" "}
                <span className="font-medium text-foreground">
                  {fmtUSDPrecise(passthrough)}
                </span>{" "}
                of that is really other people&apos;s money flowing through
                your account.
              </>
            ) : passthrough < 0 ? (
              <>
                You also have{" "}
                <span className="font-medium text-foreground">
                  {fmtUSDPrecise(-passthrough)}
                </span>{" "}
                of shared expenses Splitwise sees that didn&apos;t hit this
                bank.
              </>
            ) : (
              <>Nothing pass-through detected.</>
            )}
          </p>
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 border-t border-border pt-6 sm:grid-cols-3">
        <HeroMetric label="Bank outflow" value={fmtUSD(metrics.bankSpent)} />
        <HeroMetric
          label="Shared expenses (you fronted)"
          value={fmtUSD(metrics.sharedExpensesFronted)}
        />
        <HeroMetric
          label="Reimbursements pending"
          value={fmtUSD(metrics.reimbursementsPending)}
          hint={
            metrics.reimbursementsReceived > 0
              ? `${fmtUSD(metrics.reimbursementsGrossOwed)} owed − ${fmtUSD(metrics.reimbursementsReceived)} received`
              : `${fmtUSD(metrics.reimbursementsGrossOwed)} owed · none received yet`
          }
        />
      </CardContent>
    </Card>
  );
}

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
  OTHER: "Other",
};

function CategorySection({ rows }: { rows: CategoryBreakdown[] }) {
  if (rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + r.total, 0);
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Where it went (bank-side)
      </h2>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => {
          const label = r.category
            ? (CATEGORY_LABEL[r.category] ?? r.category)
            : "Uncategorized";
          const pct = total > 0 ? (r.total / total) * 100 : 0;
          return (
            <li key={r.category ?? "null"} className="text-sm">
              <div className="flex items-baseline justify-between">
                <span>{label}</span>
                <span className="font-medium">{fmtUSD(r.total)}</span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-foreground/70"
                  style={{ width: `${pct.toFixed(1)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EmptyState() {
  return (
    <Card className="mt-12 text-center">
      <CardHeader>
        <CardTitle>Connect your accounts to begin</CardTitle>
        <CardDescription>
          ActualSpend reconciles your bank with Splitwise to show what you
          really spent — not what your bank statement says.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          href="/accounts"
          className={cn(buttonVariants({ variant: "default" }))}
        >
          Manage accounts
        </Link>
      </CardContent>
    </Card>
  );
}

export default async function Dashboard({
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

  const metrics = connected
    ? await computeDashboardMetrics(user.id, period)
    : null;
  const categories = connected
    ? await computeCategoryBreakdown(user.id, period)
    : [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">ActualSpend</h1>
        <nav className="flex items-center gap-1">
          <Link
            href="/accounts"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-muted-foreground hover:text-foreground",
            )}
          >
            Accounts
          </Link>
          <Link
            href="/reconcile"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-muted-foreground hover:text-foreground",
            )}
          >
            Review
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </nav>
      </header>

      {connected ? (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Signed in as {user.email}
            </p>
            <DateRangePicker from={period.from} to={period.to} />
          </div>
          {metrics && <ActualSpendHero metrics={metrics} period={period} />}
          <CategorySection rows={categories} />
        </>
      ) : (
        <EmptyState />
      )}
    </main>
  );
}
