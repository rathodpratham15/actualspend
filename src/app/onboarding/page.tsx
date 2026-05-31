"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";

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

type Step = "rent" | "groceries";

function AmountInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm">$</span>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 pl-7 pr-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-foreground/30"
      />
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("rent");
  const [busy, setBusy] = useState(false);

  // Rent state — collector model (user fronts full rent, roommates pay back)
  const [totalRent, setTotalRent] = useState("");
  const [ownShare, setOwnShare] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paybackMethods, setPaybackMethods] = useState<Set<string>>(new Set());
  const [paybackPattern, setPaybackPattern] = useState("");

  // Grocery state
  const [groceries, setGroceries] = useState<Set<string>>(new Set());

  const save = async (patch: Record<string, unknown>) => {
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
  };

  const submitRent = async (skip = false) => {
    setBusy(true);
    if (!skip) {
      await save({
        totalMonthlyRent: totalRent ? parseFloat(totalRent) : null,
        ownRentShare: ownShare ? parseFloat(ownShare) : null,
        // Keep legacy field in sync for backward compat.
        monthlyRent: ownShare ? parseFloat(ownShare) : (totalRent ? parseFloat(totalRent) : null),
        rentPaidBy: "self",
        rentPaymentMethod: paymentMethod || null,
        roommatePaybackMethods: paybackMethods.size > 0 ? Array.from(paybackMethods) : null,
        roommatePaybackPattern: paybackPattern || null,
      });
    }
    setBusy(false);
    setStep("groceries");
  };

  const submitGroceries = async (skip = false) => {
    setBusy(true);
    await save({
      groceryChannels: skip ? [] : Array.from(groceries),
      onboardingCompletedAt: new Date().toISOString(),
    });
    setBusy(false);
    router.push("/");
  };

  const toggleSet = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  };

  const radioCard = (
    id: string,
    label: string,
    sub: string,
    current: string,
    setter: (v: string) => void,
  ) => (
    <label
      key={id}
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
        current === id ? "border-foreground bg-surface" : "border-border hover:bg-surface"
      }`}
    >
      <input
        type="radio"
        value={id}
        checked={current === id}
        onChange={() => setter(id)}
        className="accent-foreground mt-0.5 shrink-0"
      />
      <div>
        <div className="text-sm">{label}</div>
        {sub && <div className="text-xs text-secondary mt-0.5">{sub}</div>}
      </div>
    </label>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />
      <main className="max-w-lg mx-auto px-4 sm:px-6 pt-10 pb-24">
        {/* Progress dots */}
        <div className="flex items-center gap-2 mb-8">
          {(["rent", "groceries"] as Step[]).map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step ? "w-6 bg-foreground" : "w-3 bg-foreground/40"
              }`}
            />
          ))}
        </div>

        {/* ── Rent step ─────────────────────────────────────────────── */}
        {step === "rent" && (
          <div>
            <h1 className="text-xl font-medium tracking-tight">
              Tell us about your rent
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Helps us identify rent payments and roommate reimbursements in
              your transactions.
            </p>

            <div className="mt-8 space-y-6">
              {/* Total rent */}
              <div>
                <label className="block text-xs text-secondary mb-1.5">
                  Total monthly rent{" "}
                  <span className="text-secondary/60">
                    (full amount paid to landlord)
                  </span>
                </label>
                <AmountInput
                  value={totalRent}
                  onChange={setTotalRent}
                  placeholder="3,060"
                />
              </div>

              {/* Own share */}
              <div>
                <label className="block text-xs text-secondary mb-1.5">
                  Your share{" "}
                  <span className="text-secondary/60">
                    (your personal portion after roommates pay you back)
                  </span>
                </label>
                <AmountInput
                  value={ownShare}
                  onChange={setOwnShare}
                  placeholder="510"
                />
                {totalRent && ownShare && Number(totalRent) > 0 && Number(ownShare) > 0 && (
                  <p className="mt-1.5 text-xs text-secondary">
                    {Math.round((Number(ownShare) / Number(totalRent)) * 100)}% of total
                    {Number(totalRent) > Number(ownShare) && (
                      <> · <span className="text-foreground">${(Number(totalRent) - Number(ownShare)).toLocaleString()}</span> to collect from roommates</>
                    )}
                  </p>
                )}
              </div>

              {/* How you pay */}
              <div>
                <label className="block text-xs text-secondary mb-2">
                  How do you pay the landlord?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                        paymentMethod === m.id
                          ? "border-foreground bg-surface"
                          : "border-border hover:bg-surface"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={m.id}
                        checked={paymentMethod === m.id}
                        onChange={() => setPaymentMethod(m.id)}
                        className="accent-foreground"
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* How roommates pay back */}
              <div>
                <label className="block text-xs text-secondary mb-2">
                  How do roommates pay you back for rent?{" "}
                  <span className="text-secondary/60">(select all that apply)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYBACK_METHODS.map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                        paybackMethods.has(m.id)
                          ? "border-foreground bg-surface"
                          : "border-border hover:bg-surface"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={paybackMethods.has(m.id)}
                        onChange={() =>
                          setPaybackMethods(toggleSet(paybackMethods, m.id))
                        }
                        className="accent-foreground"
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Combined payment pattern */}
              <div>
                <label className="block text-xs text-secondary mb-2">
                  When roommates pay you, do they ever combine rent with
                  other shared expenses (Splitwise)?
                </label>
                <div className="space-y-2">
                  {radioCard(
                    "rent_only",
                    "Always separate",
                    "Rent payments and Splitwise settlements come in as distinct transfers",
                    paybackPattern,
                    setPaybackPattern,
                  )}
                  {radioCard(
                    "mixed",
                    "Sometimes combined",
                    "Some roommates lump rent + Splitwise into one payment",
                    paybackPattern,
                    setPaybackPattern,
                  )}
                  {radioCard(
                    "rent_and_splitwise",
                    "Always combined",
                    "Every rent payment also includes Splitwise balances",
                    paybackPattern,
                    setPaybackPattern,
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => submitRent(true)}
                className="text-sm text-secondary hover:text-foreground"
              >
                Skip
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => submitRent(false)}
                className="h-9 px-5 rounded-md bg-foreground text-background text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {busy ? "Saving…" : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {/* ── Groceries step ─────────────────────────────────────────── */}
        {step === "groceries" && (
          <div>
            <h1 className="text-xl font-medium tracking-tight">
              Where do you shop for groceries?
            </h1>
            <p className="mt-1 text-sm text-secondary">
              We&apos;ll use this to break down spending by store even when you
              order through Instacart.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-2">
              {GROCERY_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                    groceries.has(opt.id)
                      ? "border-foreground bg-surface"
                      : "border-border hover:bg-surface"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={groceries.has(opt.id)}
                    onChange={() => setGroceries(toggleSet(groceries, opt.id))}
                    className="accent-foreground"
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => submitGroceries(true)}
                className="text-sm text-secondary hover:text-foreground"
              >
                Skip
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => submitGroceries(false)}
                className="h-9 px-5 rounded-md bg-foreground text-background text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {busy ? "Saving…" : "Done →"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
