import type { DashboardMetrics } from "@/lib/dashboard/metrics";

function usd(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function SpendNarrative({
  metrics,
  periodLabel,
}: {
  metrics: DashboardMetrics;
  periodLabel: string;
}) {
  const {
    bankSpent,
    sharedExpensesFronted,
    actualSpend,
    reimbursementsPending,
    reimbursementsReceived,
  } = metrics;

  // Nothing to say if there's no activity.
  if (bankSpent === 0 && sharedExpensesFronted === 0) return null;

  const fronted = sharedExpensesFronted;
  const othersShare = Math.max(fronted - actualSpend, 0);

  let sentence: string;

  if (fronted === 0) {
    sentence = `Your bank shows ${usd(bankSpent)} out this ${periodLabel} — no shared expenses recorded, so that's all personal spend.`;
  } else if (othersShare < 1) {
    sentence = `Your bank shows ${usd(bankSpent)} out this ${periodLabel}. You fronted ${usd(fronted)} for shared expenses, but your personal share covers most of it — actual spend ${usd(actualSpend)}.`;
  } else {
    const pendingClause =
      reimbursementsPending < 1
        ? "All reimbursements received."
        : reimbursementsReceived > 0
          ? `${usd(reimbursementsPending)} is still outstanding (${usd(reimbursementsReceived)} already received).`
          : `${usd(reimbursementsPending)} is still outstanding.`;

    sentence = `Your bank shows ${usd(bankSpent)} out this ${periodLabel}. You fronted ${usd(fronted)} for shared expenses — your actual share works out to ${usd(actualSpend)}. ${pendingClause}`;
  }

  return (
    <p className="mt-4 text-sm text-secondary leading-relaxed px-1">
      {sentence}
    </p>
  );
}
