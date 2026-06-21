"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fmtAmt(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function MerchantTxnTooltip({
  txnCount,
  txnDates,
  children,
}: {
  txnCount: number;
  txnDates: { date: string; amount: number }[];
  children: React.ReactNode;
}) {
  if (txnCount <= 1 || txnDates.length === 0) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger className="cursor-default">{children}</TooltipTrigger>
        <TooltipContent side="right">
          <div className="text-left min-w-[140px]">
            <div className="text-[10px] opacity-60 uppercase tracking-wider mb-1.5">
              {txnCount} transactions
            </div>
            <div className="space-y-1">
              {txnDates.map((t, i) => (
                <div key={i} className="flex items-center justify-between gap-4 font-mono text-xs">
                  <span className="opacity-80">{fmtDate(t.date)}</span>
                  <span>{fmtAmt(t.amount)}</span>
                </div>
              ))}
              {txnCount > txnDates.length && (
                <div className="text-[10px] opacity-60 pt-0.5">
                  +{txnCount - txnDates.length} more
                </div>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
