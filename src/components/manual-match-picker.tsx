"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Check } from "lucide-react";

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

export function ManualMatchPicker({
  reconId,
  onClose,
}: {
  reconId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [expenses, setExpenses] = useState<SwExpense[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reconcile/sw-candidates?reconId=${reconId}`)
      .then((r) => r.json())
      .then((data) => setExpenses(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [reconId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = expenses.filter((e) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (e.description ?? "").toLowerCase().includes(q) ||
      e.date.includes(q) ||
      fmt(e.cost).includes(q)
    );
  });

  const pick = async (expenseId: string) => {
    setSaving(expenseId);
    try {
      const r = await fetch(`/api/reconcile/${reconId}/manual-match`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ splitwiseExpenseId: expenseId }),
      });
      if (!r.ok) throw new Error(await r.text());
      router.refresh();
      onClose();
    } catch (e) {
      console.error(e);
      setSaving(null);
    }
  };

  return (
    <div className="mt-2 border border-border rounded-lg bg-surface overflow-hidden shadow-lift">
      {/* Search bar */}
      <div className="relative border-b border-border">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-secondary" strokeWidth={1.5} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by description or date…"
          className="w-full h-9 pl-8 pr-3 bg-transparent text-sm focus:outline-none"
        />
      </div>

      {/* Expense list */}
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
              disabled={!!saving}
              onClick={() => void pick(e.id)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-secondary/40 transition-colors text-left disabled:opacity-60"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{e.description ?? "(no description)"}</div>
                <div className="text-xs text-secondary font-mono">{fmtDate(e.date)}</div>
              </div>
              <div className="shrink-0 text-right font-mono text-xs">
                <div>{fmt(e.paidByUser)}</div>
                <div className="text-emerald-accent">share {fmt(e.userShare)}</div>
              </div>
              {saving === e.id && (
                <Check className="h-4 w-4 text-emerald-accent shrink-0" />
              )}
            </button>
          ))
        )}
      </div>

      <div className="border-t border-border px-3 py-2 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-secondary hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
