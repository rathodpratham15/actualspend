"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  /** Pre-detected likely rent amount from transaction history — null if none found. */
  detectedRent: number | null;
};

export function OnboardingBanner({ detectedRent }: Props) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const message = detectedRent
    ? `We noticed a recurring payment of $${detectedRent.toLocaleString()} that looks like rent.`
    : "Set up your household profile to improve rent and grocery categorization.";

  return (
    <div className="mt-4 flex items-start justify-between gap-4 bg-surface border border-border rounded-xl px-5 py-3.5 text-sm">
      <div className="flex items-start gap-3 min-w-0">
        <span className="text-base mt-0.5 shrink-0">🏠</span>
        <div>
          <span className="text-foreground">{message}</span>
          <span className="text-secondary ml-1">
            Tell us a bit more to improve your spending breakdown.
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => router.push("/onboarding")}
          className="text-sm font-medium hover:underline underline-offset-4 whitespace-nowrap"
        >
          Set up →
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-secondary hover:text-foreground text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
