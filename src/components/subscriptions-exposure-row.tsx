"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { CardExposureRow, MerchantTxn } from "@/lib/dashboard/subscriptions";
import { MerchantFavicon } from "@/components/merchant-favicon";
import { usd } from "@/lib/format";

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ExposureRow({
  row,
  periodTo,
  txns,
}: {
  row: CardExposureRow;
  periodTo: string;
  txns: MerchantTxn[];
}) {
  const [open, setOpen] = useState(false);

  const msPerDay = 86_400_000;
  const toMs = new Date(periodTo).getTime();
  const lastMs = new Date(row.lastSeen).getTime();
  const isActive = Math.round((toMs - lastMs) / msPerDay) <= 45;

  return (
    <>
      {/* Main row */}
      <div
        className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
      >
        {/* Expand chevron */}
        <div className="w-4 shrink-0 text-secondary">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </div>

        <div className="flex-1 flex items-center gap-3 min-w-0">
          <MerchantFavicon name={row.merchant} />
          <div className="min-w-0">
            <div className="text-sm font-medium truncate flex items-center gap-1.5">
              {row.merchant}
              {row.isRecurring && (
                <span className="text-[9px] uppercase tracking-wide text-emerald-accent border border-emerald-accent/30 rounded px-1 py-px">
                  recurring
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-secondary">
              {row.channel && row.channel !== row.merchant && (
                <span>via {row.channel}</span>
              )}
              <span
                className={`inline-flex items-center gap-0.5 ${isActive ? "text-success" : "text-secondary"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full inline-block ${isActive ? "bg-success" : "bg-secondary"}`}
                />
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        <div className="w-28 text-right hidden sm:block">
          <span className="text-xs text-secondary font-mono">
            {shortDate(row.firstSeen)}
          </span>
        </div>
        <div className="w-28 text-right hidden sm:block">
          <span className="text-xs text-secondary font-mono">
            {shortDate(row.lastSeen)}
          </span>
        </div>
        <div className="w-14 text-right">
          <span className="font-mono text-sm text-secondary">{row.txnCount}</span>
        </div>
        <div className="w-24 text-right">
          <span className="font-mono text-sm font-medium">
            {usd(row.totalActual, { decimals: 2 })}
          </span>
        </div>
      </div>

      {/* Transaction sub-table */}
      {open && txns.length > 0 && (
        <div className="border-t border-border bg-muted/20">
          {/* Sub-header */}
          <div className="flex items-center gap-3 px-9 py-2 text-[10px] uppercase tracking-widest text-secondary border-b border-border/50">
            <div className="flex-1">Transaction</div>
            <div className="w-28 text-right hidden sm:block">Date</div>
            <div className="w-20 text-right hidden sm:block">Bank</div>
            <div className="w-20 text-right">Actual</div>
          </div>

          {txns.map((t) => {
            const discounted =
              t.actualAmount != null && t.actualAmount < t.amount - 0.01;
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 px-9 py-2.5 text-sm border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors"
              >
                <div className="flex-1 truncate text-secondary text-xs">
                  {t.name}
                </div>
                <div className="w-28 text-right hidden sm:block">
                  <span className="text-xs text-secondary font-mono">
                    {shortDate(t.date)}
                  </span>
                </div>
                <div className="w-20 text-right hidden sm:block">
                  <span className="font-mono text-xs text-secondary">
                    {usd(t.amount, { decimals: 2 })}
                  </span>
                </div>
                <div className="w-20 text-right">
                  <span
                    className={`font-mono text-xs ${discounted ? "text-emerald-accent" : ""}`}
                  >
                    {t.actualAmount != null
                      ? usd(t.actualAmount, { decimals: 2 })
                      : usd(t.amount, { decimals: 2 })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
