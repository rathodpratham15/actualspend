"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { usd, dateShort } from "@/lib/format";
import type { ReconciliationPair } from "@/lib/seed";

type State = "confirmed" | "awaiting" | "splitwise" | "personal";

const BORDER_FOR_STATE: Record<State, string> = {
  confirmed: "border-l-[var(--emerald)]",
  awaiting: "border-l-[var(--amber)]",
  splitwise: "border-l-[var(--border)]",
  personal: "border-l-transparent",
};

export function ReconCard({
  pair,
  state = "awaiting",
  onConfirm,
  onReject,
  dismissed,
}: {
  pair: ReconciliationPair;
  state?: State;
  onConfirm?: (id: string) => void;
  onReject?: (id: string) => void;
  dismissed?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  if (dismissed) return null;

  return (
    <div
      data-testid={`recon-card-${pair.id}`}
      className={`bg-surface border border-border ${BORDER_FOR_STATE[state]} border-l-2 rounded-xl p-4 sm:p-5`}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 sm:gap-5 items-start">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-secondary mb-2">
            Bank transaction
          </div>
          <div className="font-mono text-xs text-secondary">
            {dateShort(pair.bank.date)} · {pair.bank.account}
          </div>
          <div className="mt-1 text-[15px] font-medium">
            {pair.bank.merchant}
          </div>
          <div className="mt-2 font-mono text-lg">
            {usd(pair.bank.amount, { decimals: 2 })}
          </div>
        </div>

        <div className="hidden md:flex flex-col items-center justify-center self-stretch text-secondary">
          <div className="h-full w-px bg-border" />
          <span className="my-2 text-xs font-mono">↔</span>
          <div className="h-full w-px bg-border" />
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-secondary mb-2">
            Splitwise expense
          </div>
          <div className="font-mono text-xs text-secondary">
            {pair.splitwise.group}
          </div>
          <div className="mt-1 text-[15px] font-medium">
            {pair.splitwise.title}
          </div>
          <div className="mt-2 font-mono text-sm text-secondary">
            Total: {usd(pair.splitwise.total, { decimals: 2 })}
          </div>
          <div className="font-mono text-sm">
            Your share:{" "}
            <span className="text-emerald-accent">
              {usd(pair.splitwise.yourShare, { decimals: 2 })}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {pair.reasons.map((r) => (
          <span key={r} className="text-secondary">
            · {r}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="font-mono text-xs text-secondary">
          Engine confidence{" "}
          <span className="text-foreground ml-1">{pair.confidence}%</span>
        </div>

        {state === "awaiting" && (
          <div className="flex flex-wrap items-center gap-2 relative">
            <button
              type="button"
              data-testid={`reject-${pair.id}`}
              onClick={() => onReject?.(pair.id)}
              className="h-9 px-3 rounded-md border border-border text-sm hover:bg-secondary transition-colors"
            >
              Reject
            </button>
            <button
              type="button"
              data-testid={`confirm-${pair.id}`}
              onClick={() => onConfirm?.(pair.id)}
              className="h-9 px-4 rounded-md text-white text-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "var(--emerald)" }}
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setShowMenu((s) => !s)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border text-secondary hover:text-foreground hover:bg-secondary"
              aria-label="More"
              data-testid={`more-${pair.id}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-10 z-10 w-56 bg-surface border border-border rounded-md py-1 text-sm">
                <button
                  className="w-full text-left px-3 py-2 hover:bg-secondary"
                  onClick={() => setShowMenu(false)}
                >
                  Match to a different expense
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
