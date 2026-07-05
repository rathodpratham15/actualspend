"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Search, X } from "lucide-react";
import { usd, dateShort } from "@/lib/format";

export type PersonalRow = {
  recId: string;
  txnName: string | null;
  txnAmount: string | null;
  txnDate: string | null;
  actualAmount: string;
  state: string;
};

type SwExpense = {
  id: string;
  description: string | null;
  date: string;
  cost: string;
  userShare: string;
  paidByUser: string;
};

function fmt(n: string | number) {
  return `$${Number(n).toFixed(2)}`;
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function SwPicker({
  referenceReconId,
  onPick,
  onCancel,
}: {
  referenceReconId: string;
  onPick: (expenseId: string) => void;
  onCancel: () => void;
}) {
  const [expenses, setExpenses] = useState<SwExpense[] | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useState(() => {
    fetch(`/api/reconcile/sw-candidates?reconId=${referenceReconId}`)
      .then((r) => r.json())
      .then((data) => { setExpenses(data); setLoading(false); })
      .catch(() => setLoading(false));
  });

  const filtered = (expenses ?? []).filter((e) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (e.description ?? "").toLowerCase().includes(q) ||
      e.date.includes(q) ||
      fmt(e.cost).includes(q)
    );
  });

  return (
    <div className="mt-3 border border-border rounded-lg bg-surface overflow-hidden shadow-lift">
      <div className="px-3 py-2 border-b border-border text-xs text-secondary font-medium">
        Pick a Splitwise expense to link the selected transactions to
      </div>
      <div className="relative border-b border-border">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-secondary" strokeWidth={1.5} />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search expenses…"
          className="w-full h-9 pl-8 pr-3 bg-transparent text-sm focus:outline-none"
        />
      </div>
      <div className="max-h-52 overflow-y-auto">
        {loading ? (
          <div className="py-6 text-center text-xs text-secondary">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-6 text-center text-xs text-secondary">No expenses found.</div>
        ) : (
          filtered.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onPick(e.id)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-secondary/40 transition-colors text-left"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{e.description ?? "(no description)"}</div>
                <div className="text-xs text-secondary font-mono">{fmtDate(e.date)}</div>
              </div>
              <div className="shrink-0 text-right font-mono text-xs">
                <div>{fmt(e.paidByUser)}</div>
                <div className="text-emerald-accent">share {fmt(e.userShare)}</div>
              </div>
            </button>
          ))
        )}
      </div>
      <div className="border-t border-border px-3 py-2 flex justify-end">
        <button type="button" onClick={onCancel} className="text-xs text-secondary hover:text-foreground">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function PersonalMergeSection({
  rows,
  markSharedSlot,
}: {
  rows: PersonalRow[];
  markSharedSlot: (reconId: string, bankAmt: number, overridden: boolean, actual: number) => React.ReactNode;
}) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelecting(false);
    setSelected(new Set());
    setShowPicker(false);
  };

  const handlePick = async (splitwiseExpenseId: string) => {
    setSaving(true);
    try {
      const r = await fetch("/api/reconcile/manual-group", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reconIds: Array.from(selected),
          splitwiseExpenseId,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      router.refresh();
      exitSelectMode();
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="surface-card p-12 text-center text-sm text-secondary">
        No unmatched bank charges.
      </div>
    );
  }

  return (
    <div>
      {/* Section header with Select toggle */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-secondary">
          {selecting
            ? `${selected.size} of ${rows.length} selected`
            : `${rows.length} unmatched`}
        </span>
        {selecting ? (
          <button
            type="button"
            onClick={exitSelectMode}
            className="inline-flex items-center gap-1 text-xs text-secondary hover:text-foreground"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSelecting(true)}
            className="text-xs text-emerald-accent hover:underline underline-offset-4"
          >
            Group transactions
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {rows.map((r) => {
          const bankAmt = Number(r.txnAmount ?? 0);
          const actual = Number(r.actualAmount);
          const overridden =
            r.state === "MANUAL_MATCH" && Math.abs(actual - bankAmt) > 0.005;
          const isChecked = selected.has(r.recId);

          return (
            <div
              key={r.recId}
              data-testid={`personal-${r.recId}`}
              className={`surface-card p-4 transition-colors ${
                selecting && isChecked ? "border-emerald-accent/60" : ""
              }`}
              onClick={selecting ? () => toggle(r.recId) : undefined}
              style={selecting ? { cursor: "pointer" } : undefined}
            >
              <div className="flex items-center justify-between gap-4">
                {selecting && (
                  <div
                    className={`h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                      isChecked
                        ? "bg-emerald-accent border-emerald-accent"
                        : "border-border"
                    }`}
                  >
                    {isChecked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="pill pill-muted">Personal</span>
                  </div>
                  <div className="text-sm font-medium truncate">
                    {r.txnName ?? "(no description)"}
                  </div>
                  <div className="text-xs text-secondary mt-0.5">
                    {r.txnDate ? dateShort(r.txnDate) : "—"}
                  </div>
                </div>
                <div className="text-right shrink-0 font-mono text-sm">
                  {overridden ? (
                    <>
                      <div>{usd(-actual, { decimals: 2 })}</div>
                      <div className="text-xs text-secondary line-through">
                        {usd(-bankAmt, { decimals: 2 })}
                      </div>
                    </>
                  ) : (
                    usd(-bankAmt, { decimals: 2 })
                  )}
                </div>
              </div>

              {/* Mark-shared form only shown when not in select mode */}
              {!selecting &&
                markSharedSlot(r.recId, bankAmt, overridden, actual)}
            </div>
          );
        })}
      </div>

      {/* Group action bar */}
      {selecting && selected.size >= 2 && (
        <div className="mt-4 sticky bottom-4">
          <div className="surface-card border-emerald-accent/30 p-3 flex flex-col gap-2 shadow-lift">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Group {selected.size} transactions
              </span>
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowPicker(true)}
                className="h-8 px-4 rounded-md text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "var(--emerald)" }}
              >
                {saving ? "Saving…" : "Pick Splitwise expense →"}
              </button>
            </div>

            {showPicker && (
              <SwPicker
                referenceReconId={Array.from(selected)[0]}
                onPick={handlePick}
                onCancel={() => setShowPicker(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
