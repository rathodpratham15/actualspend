"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GROCERY_OPTIONS = [
  { id: "instacart", label: "Instacart" },
  { id: "costco", label: "Costco" },
  { id: "aldi", label: "Aldi" },
  { id: "trader_joes", label: "Trader Joe's" },
  { id: "whole_foods", label: "Whole Foods" },
  { id: "amazon_fresh", label: "Amazon Fresh" },
  { id: "walmart", label: "Walmart" },
  { id: "target", label: "Target" },
  { id: "local", label: "Local grocery stores" },
];

const PAYMENT_METHODS = [
  { id: "bank_transfer", label: "Bank transfer / ACH" },
  { id: "check", label: "Check" },
  { id: "zelle", label: "Zelle" },
  { id: "venmo", label: "Venmo" },
  { id: "credit_card", label: "Credit card" },
  { id: "other", label: "Other" },
];

const PAYBACK_METHODS = [
  { id: "venmo", label: "Venmo" },
  { id: "zelle", label: "Zelle" },
  { id: "cash", label: "Cash" },
  { id: "other", label: "Other" },
];

type Friend = {
  splitwiseUserId: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

type Step = "rent" | "groceries" | "roommates";

type InitialProfile = {
  totalMonthlyRent: string;
  ownRentShare: string;
  rentPaymentMethod: string;
  roommatePaybackMethods: string[];
  roommatePaybackPattern: string;
  groceryChannels: string[];
} | null;

type Props = {
  friends: Friend[];
  savedRoommateIds: number[];
  hasSplitwise: boolean;
  initialStep?: string;
  initialProfile?: InitialProfile;
};

function AmountInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm">$</span>
      <input type="number" min="0" step="1" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-10 pl-7 pr-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-foreground/30" />
    </div>
  );
}

function RadioCard({ id, label, sub, current, setter }: { id: string; label: string; sub: string; current: string; setter: (v: string) => void }) {
  return (
    <label className={`flex items-start gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${current === id ? "border-foreground bg-surface" : "border-border hover:bg-surface"}`}>
      <input type="radio" value={id} checked={current === id} onChange={() => setter(id)} className="accent-foreground mt-0.5 shrink-0" />
      <div>
        <div className="text-sm">{label}</div>
        {sub && <div className="text-xs text-secondary mt-0.5">{sub}</div>}
      </div>
    </label>
  );
}

export function OnboardingForm({ friends, savedRoommateIds, hasSplitwise, initialStep, initialProfile }: Props) {
  const router = useRouter();
  const steps: Step[] = hasSplitwise ? ["rent", "groceries", "roommates"] : ["rent", "groceries"];
  const validInitial = steps.includes(initialStep as Step) ? (initialStep as Step) : "rent";
  const [step, setStep] = useState<Step>(validInitial);
  const [busy, setBusy] = useState(false);

  // Seed from saved profile so editing shows current values.
  const ip = initialProfile;
  const [totalRent, setTotalRent] = useState(ip?.totalMonthlyRent ?? "");
  const [ownShare, setOwnShare] = useState(ip?.ownRentShare ?? "");
  const [paymentMethod, setPaymentMethod] = useState(ip?.rentPaymentMethod ?? "");
  const [paybackMethods, setPaybackMethods] = useState<Set<string>>(new Set(ip?.roommatePaybackMethods ?? []));
  const [paybackPattern, setPaybackPattern] = useState(ip?.roommatePaybackPattern ?? "");
  const [groceries, setGroceries] = useState<Set<string>>(new Set(ip?.groceryChannels ?? []));
  const [roommates, setRoommates] = useState<Set<number>>(new Set(savedRoommateIds));
  const [roommateSearch, setRoommateSearch] = useState("");
  const [roommatePage, setRoommatePage] = useState(1);
  const ROOMMATE_PAGE_SIZE = 8;

  const toggle = <T,>(set: Set<T>, id: T): Set<T> => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  };

  const save = async (patch: Record<string, unknown>) => {
    await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
  };

  const nextStep = () => {
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
  };

  const submitRent = async (skip = false) => {
    setBusy(true);
    if (!skip) {
      await save({
        totalMonthlyRent: totalRent ? parseFloat(totalRent) : null,
        ownRentShare: ownShare ? parseFloat(ownShare) : null,
        monthlyRent: ownShare ? parseFloat(ownShare) : (totalRent ? parseFloat(totalRent) : null),
        rentPaidBy: "self",
        rentPaymentMethod: paymentMethod || null,
        roommatePaybackMethods: paybackMethods.size > 0 ? Array.from(paybackMethods) : null,
        roommatePaybackPattern: paybackPattern || null,
      });
    }
    setBusy(false);
    nextStep();
  };

  const submitGroceries = async (skip = false) => {
    setBusy(true);
    await save({
      groceryChannels: skip ? [] : Array.from(groceries),
      // Mark complete here only if roommates step won't follow.
      ...(!hasSplitwise && { onboardingCompletedAt: new Date().toISOString() }),
    });
    setBusy(false);
    if (!hasSplitwise) { router.push("/"); return; }
    nextStep();
  };

  const submitRoommates = async (skip = false) => {
    setBusy(true);
    await fetch("/api/roommates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ splitwiseUserIds: skip ? [] : Array.from(roommates) }),
    });
    await save({ onboardingCompletedAt: new Date().toISOString() });
    setBusy(false);
    router.push("/");
  };

  const friendName = (f: Friend) =>
    `${f.firstName ?? ""} ${f.lastName ?? ""}`.trim() || f.email || `User ${f.splitwiseUserId}`;

  const stepIdx = steps.indexOf(step);

  return (
    <main className={`${step === "roommates" ? "max-w-2xl" : "max-w-lg"} mx-auto px-4 sm:px-6 pt-10 pb-24 transition-all`}>
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? "w-6 bg-foreground" : i < stepIdx ? "w-3 bg-foreground/40" : "w-3 bg-border"}`} />
        ))}
      </div>

      {/* ── Rent ── */}
      {step === "rent" && (
        <div>
          <h1 className="text-xl font-medium tracking-tight">Tell us about your rent</h1>
          <p className="mt-1 text-sm text-secondary">Helps us identify rent payments and roommate reimbursements in your transactions.</p>

          <div className="mt-8 space-y-6">
            <div>
              <label className="block text-xs text-secondary mb-1.5">Total monthly rent <span className="text-secondary/60">(full amount paid to landlord)</span></label>
              <AmountInput value={totalRent} onChange={setTotalRent} placeholder="3,060" />
            </div>
            <div>
              <label className="block text-xs text-secondary mb-1.5">Your share <span className="text-secondary/60">(your personal portion after roommates pay you back)</span></label>
              <AmountInput value={ownShare} onChange={setOwnShare} placeholder="510" />
              {totalRent && ownShare && Number(totalRent) > 0 && Number(ownShare) > 0 && (
                <p className="mt-1.5 text-xs text-secondary">
                  {Math.round((Number(ownShare) / Number(totalRent)) * 100)}% of total
                  {Number(totalRent) > Number(ownShare) && (
                    <> · <span className="text-foreground">${(Number(totalRent) - Number(ownShare)).toLocaleString()}</span> to collect from roommates</>
                  )}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-secondary mb-2">How do you pay the landlord?</label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <label key={m.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer text-sm transition-colors ${paymentMethod === m.id ? "border-foreground bg-surface" : "border-border hover:bg-surface"}`}>
                    <input type="radio" name="paymentMethod" value={m.id} checked={paymentMethod === m.id} onChange={() => setPaymentMethod(m.id)} className="accent-foreground" />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-secondary mb-2">How do roommates pay you back? <span className="text-secondary/60">(select all that apply)</span></label>
              <div className="grid grid-cols-2 gap-2">
                {PAYBACK_METHODS.map((m) => (
                  <label key={m.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer text-sm transition-colors ${paybackMethods.has(m.id) ? "border-foreground bg-surface" : "border-border hover:bg-surface"}`}>
                    <input type="checkbox" checked={paybackMethods.has(m.id)} onChange={() => setPaybackMethods(toggle(paybackMethods, m.id))} className="accent-foreground" />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-secondary mb-2">When roommates pay you, do they ever combine rent with other shared expenses?</label>
              <div className="space-y-2">
                <RadioCard id="rent_only" label="Always separate" sub="Rent and Splitwise come in as distinct transfers" current={paybackPattern} setter={setPaybackPattern} />
                <RadioCard id="mixed" label="Sometimes combined" sub="Some roommates lump rent + Splitwise into one payment" current={paybackPattern} setter={setPaybackPattern} />
                <RadioCard id="rent_and_splitwise" label="Always combined" sub="Every rent payment also includes Splitwise balances" current={paybackPattern} setter={setPaybackPattern} />
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button type="button" onClick={() => submitRent(true)} className="text-sm text-secondary hover:text-foreground">Skip</button>
            <button type="button" disabled={busy} onClick={() => submitRent(false)} className="h-9 px-5 rounded-md bg-foreground text-background text-sm hover:opacity-90 disabled:opacity-60">
              {busy ? "Saving…" : "Continue →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Groceries ── */}
      {step === "groceries" && (
        <div>
          <h1 className="text-xl font-medium tracking-tight">Where do you shop for groceries?</h1>
          <p className="mt-1 text-sm text-secondary">We&apos;ll use this to break down spending by store even when you order through Instacart.</p>
          <div className="mt-8 grid grid-cols-2 gap-2">
            {GROCERY_OPTIONS.map((opt) => (
              <label key={opt.id} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer text-sm transition-colors ${groceries.has(opt.id) ? "border-foreground bg-surface" : "border-border hover:bg-surface"}`}>
                <input type="checkbox" checked={groceries.has(opt.id)} onChange={() => setGroceries(toggle(groceries, opt.id))} className="accent-foreground" />
                {opt.label}
              </label>
            ))}
          </div>
          <div className="mt-8 flex items-center justify-between">
            <button type="button" onClick={() => submitGroceries(true)} className="text-sm text-secondary hover:text-foreground">Skip</button>
            <button type="button" disabled={busy} onClick={() => submitGroceries(false)} className="h-9 px-5 rounded-md bg-foreground text-background text-sm hover:opacity-90 disabled:opacity-60">
              {busy ? "Saving…" : hasSplitwise ? "Continue →" : "Done →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Roommates ── */}
      {step === "roommates" && (
        <div className="w-full max-w-2xl">
          <h1 className="text-xl font-medium tracking-tight">Which of these are your roommates?</h1>
          <p className="mt-1 text-sm text-secondary">
            We&apos;ll give extra weight to shared expenses with roommates when reconciling your spending.
          </p>

          {friends.length === 0 ? (
            <div className="mt-8 text-sm text-secondary bg-surface border border-border rounded-xl p-5">
              No Splitwise friends found. Sync Splitwise from the Accounts page first.
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="mt-6 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search by name or email…"
                  value={roommateSearch}
                  onChange={(e) => { setRoommateSearch(e.target.value); setRoommatePage(1); }}
                  className="w-full h-9 pl-8 pr-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-foreground/30"
                />
              </div>

              {/* Grid */}
              {(() => {
                const q = roommateSearch.toLowerCase();
                const filtered = friends.filter((f) => {
                  const name = friendName(f).toLowerCase();
                  const email = (f.email ?? "").toLowerCase();
                  return !q || name.includes(q) || email.includes(q);
                });
                const totalPages = Math.ceil(filtered.length / ROOMMATE_PAGE_SIZE);
                const page = Math.min(roommatePage, Math.max(1, totalPages));
                const paged = filtered.slice((page - 1) * ROOMMATE_PAGE_SIZE, page * ROOMMATE_PAGE_SIZE);
                const from = (page - 1) * ROOMMATE_PAGE_SIZE + 1;
                const to = Math.min(page * ROOMMATE_PAGE_SIZE, filtered.length);

                if (filtered.length === 0) {
                  return <p className="mt-6 text-sm text-secondary text-center">No matches for &quot;{roommateSearch}&quot;</p>;
                }

                return (
                  <>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {paged.map((f) => (
                        <label
                          key={f.splitwiseUserId}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                            roommates.has(f.splitwiseUserId) ? "border-foreground bg-surface" : "border-border hover:bg-surface"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={roommates.has(f.splitwiseUserId)}
                            onChange={() => setRoommates(toggle(roommates, f.splitwiseUserId))}
                            className="accent-foreground shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{friendName(f)}</div>
                            {f.email && <div className="text-xs text-secondary truncate">{f.email}</div>}
                          </div>
                        </label>
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs font-mono text-secondary">
                          {from}–{to} of {filtered.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={page === 1}
                            onClick={() => setRoommatePage((p) => p - 1)}
                            className="h-7 w-7 flex items-center justify-center rounded text-secondary hover:text-foreground hover:bg-surface disabled:opacity-30 transition-colors"
                          >
                            ‹
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setRoommatePage(p)}
                              className={`h-7 w-7 flex items-center justify-center rounded text-xs font-mono transition-colors ${
                                p === page
                                  ? "bg-foreground text-background"
                                  : "text-secondary hover:text-foreground hover:bg-surface"
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                          <button
                            type="button"
                            disabled={page === totalPages}
                            onClick={() => setRoommatePage((p) => p + 1)}
                            className="h-7 w-7 flex items-center justify-center rounded text-secondary hover:text-foreground hover:bg-surface disabled:opacity-30 transition-colors"
                          >
                            ›
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button type="button" onClick={() => submitRoommates(true)} className="text-sm text-secondary hover:text-foreground">Skip</button>
            <button type="button" disabled={busy} onClick={() => submitRoommates(false)} className="h-9 px-5 rounded-md bg-foreground text-background text-sm hover:opacity-90 disabled:opacity-60">
              {busy ? "Saving…" : roommates.size > 0 ? `Save ${roommates.size} roommate${roommates.size !== 1 ? "s" : ""} →` : "Done →"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
