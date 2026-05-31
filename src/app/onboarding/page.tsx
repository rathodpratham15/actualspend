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

type Step = "rent" | "groceries" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("rent");
  const [busy, setBusy] = useState(false);

  // Rent step state
  const [rent, setRent] = useState("");
  const [rentPaidBy, setRentPaidBy] = useState<"self" | "roommate" | "split" | "">("");
  const [paymentMethod, setPaymentMethod] = useState("");

  // Grocery step state
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
        monthlyRent: rent ? parseFloat(rent) : null,
        rentPaidBy: rentPaidBy || null,
        rentPaymentMethod: rentPaidBy === "self" ? paymentMethod || null : null,
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

  const toggleGrocery = (id: string) => {
    setGroceries((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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
                s === step
                  ? "w-6 bg-foreground"
                  : step === "done" || (s === "rent" && step === "groceries")
                  ? "w-3 bg-foreground/40"
                  : "w-3 bg-border"
              }`}
            />
          ))}
        </div>

        {step === "rent" && (
          <div>
            <h1 className="text-xl font-medium tracking-tight">
              Tell us about your rent
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Helps us separate household costs from your personal spend.
            </p>

            <div className="mt-8 space-y-6">
              <div>
                <label className="block text-xs text-secondary mb-1.5">
                  Monthly rent
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={rent}
                    onChange={(e) => setRent(e.target.value)}
                    placeholder="1,500"
                    className="w-full h-10 pl-7 pr-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-foreground/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-secondary mb-2">
                  Who pays the rent?
                </label>
                <div className="space-y-2">
                  {[
                    { id: "self", label: "I pay it (directly from my bank)" },
                    { id: "roommate", label: "A roommate pays it" },
                    { id: "split", label: "We split it" },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                        rentPaidBy === opt.id
                          ? "border-foreground bg-surface"
                          : "border-border hover:bg-surface"
                      }`}
                    >
                      <input
                        type="radio"
                        name="rentPaidBy"
                        value={opt.id}
                        checked={rentPaidBy === opt.id}
                        onChange={() => setRentPaidBy(opt.id as typeof rentPaidBy)}
                        className="accent-foreground"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {rentPaidBy === "self" && (
                <div>
                  <label className="block text-xs text-secondary mb-2">
                    How do you pay rent?
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
              )}
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

        {step === "groceries" && (
          <div>
            <h1 className="text-xl font-medium tracking-tight">
              Where do you shop for groceries?
            </h1>
            <p className="mt-1 text-sm text-secondary">
              We&apos;ll use this to break down spending by store even when
              you order through Instacart.
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
                    onChange={() => toggleGrocery(opt.id)}
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
