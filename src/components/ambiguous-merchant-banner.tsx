"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, Check } from "lucide-react";

export type AmbiguousGroup = {
  rawPattern: string;
  channel: string;
  txnCount: number;
};

const COMMON_STORES: Record<string, string[]> = {
  Instacart: [
    "Costco", "Aldi", "Trader Joe's", "Whole Foods", "Target",
    "Walmart", "Kroger", "Safeway", "Stop & Shop", "BJ's Wholesale",
    "H Mart", "Sprouts", "CVS", "Walgreens",
  ],
  DoorDash: ["McDonald's", "Chipotle", "Starbucks", "Panera Bread", "Sweetgreen", "Shake Shack"],
  "Uber Eats": ["McDonald's", "Chipotle", "Starbucks", "Panera Bread"],
  GrubHub: ["McDonald's", "Chipotle", "Starbucks"],
};

export function AmbiguousMerchantBanner({ groups }: { groups: AmbiguousGroup[] }) {
  const [open, setOpen] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [customs, setCustoms] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const router = useRouter();

  if (groups.length === 0) return null;

  const totalTxns = groups.reduce((s, g) => s + g.txnCount, 0);

  async function save(group: AmbiguousGroup) {
    const dest = customs[group.rawPattern]?.trim() || selections[group.rawPattern];
    if (!dest) return;
    await fetch("/api/merchants/clarify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pattern: group.rawPattern, destination: dest, channel: group.channel }),
    });
    setSaved((prev) => new Set([...prev, group.rawPattern]));
    startTransition(() => router.refresh());
  }

  const pending = groups.filter((g) => !saved.has(g.rawPattern));
  if (pending.length === 0) return null;

  return (
    <div className="mb-5 rounded-xl border border-amber-accent/30 bg-amber-soft/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-accent shrink-0" strokeWidth={1.5} />
          <span className="text-sm font-medium">
            {totalTxns} transaction{totalTxns !== 1 ? "s" : ""} need a store assigned
          </span>
          <span className="text-xs text-secondary">
            ({pending.length} pattern{pending.length !== 1 ? "s" : ""})
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-secondary transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <div className="border-t border-amber-accent/20 px-5 pb-4 pt-3 space-y-4">
          <p className="text-xs text-secondary leading-relaxed">
            These {pending[0].channel} charges had no store name in the bank descriptor.
            Clarify once and they'll update across your history.
          </p>

          {pending.map((group) => {
            const storeOptions = COMMON_STORES[group.channel] ?? [];
            const selectedStore = customs[group.rawPattern]?.trim() || selections[group.rawPattern];
            const isSaved = saved.has(group.rawPattern);

            return (
              <div key={group.rawPattern} className="rounded-lg bg-background border border-border p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-sm font-medium font-mono">{group.rawPattern}</div>
                    <div className="text-xs text-secondary mt-0.5">
                      {group.txnCount} txn{group.txnCount !== 1 ? "s" : ""} · via {group.channel}
                    </div>
                  </div>
                  {isSaved && (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <Check className="h-3.5 w-3.5" /> Saved
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {storeOptions.map((store) => (
                    <button
                      key={store}
                      onClick={() => {
                        setSelections((p) => ({ ...p, [group.rawPattern]: store }));
                        setCustoms((p) => ({ ...p, [group.rawPattern]: "" }));
                      }}
                      className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                        selections[group.rawPattern] === store && !customs[group.rawPattern]
                          ? "bg-foreground text-background border-foreground"
                          : "border-border hover:border-foreground/40"
                      }`}
                    >
                      {store}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Or type a store name…"
                    value={customs[group.rawPattern] ?? ""}
                    onChange={(e) =>
                      setCustoms((p) => ({ ...p, [group.rawPattern]: e.target.value }))
                    }
                    className="flex-1 h-8 px-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30"
                  />
                  <button
                    disabled={!selectedStore || isSaved}
                    onClick={() => save(group)}
                    className="h-8 px-4 text-sm rounded-md bg-foreground text-background disabled:opacity-40 hover:opacity-90 transition-opacity"
                  >
                    Save
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
