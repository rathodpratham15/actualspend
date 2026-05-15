"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { SubtractionBlock } from "@/components/subtraction-block";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { faqs } from "@/lib/seed";

function useCountUp(target: number, duration = 1100) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function HeroNumber() {
  const v = useCountUp(2890);
  return (
    <span className="font-mono tabular-nums">
      ${Math.round(v).toLocaleString()}
    </span>
  );
}

export default function WelcomePage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("waitlist failed");
      toast.success("You're on the list.");
      setEmail("");
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader variant="marketing" />

      <section className="max-w-3xl mx-auto px-6 pt-24 pb-24">
        <div className="text-[12px] tracking-widest uppercase text-secondary fade-up">
          ActualSpend
        </div>
        <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05] font-medium fade-up delay-1">
          Your bank says you spent{" "}
          <span className="num-strike text-secondary font-mono">$4,217</span>.
          <br />
          You actually spent{" "}
          <span className="font-mono text-emerald-accent">
            <HeroNumber />
          </span>
          .
        </h1>
        <p className="mt-6 text-base sm:text-lg text-secondary max-w-2xl fade-up delay-2">
          ActualSpend reconciles your bank transactions against Splitwise so you
          can see what you personally spent — not what temporarily passed
          through your account.
        </p>

        <form
          onSubmit={submit}
          data-testid="waitlist-form"
          noValidate
          className="mt-10 flex flex-col sm:flex-row gap-2 max-w-md fade-up delay-3"
        >
          <Input
            data-testid="waitlist-email"
            type="email"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 bg-surface"
          />
          <button
            type="submit"
            disabled={submitting}
            data-testid="waitlist-submit"
            className="h-10 px-5 rounded-md bg-foreground text-background text-sm whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Get an invite"}
          </button>
        </form>
        <div className="mt-3 text-xs text-secondary fade-up delay-4">
          Read-only. Plaid + Splitwise.
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="bg-surface border border-border rounded-xl p-8">
          <div className="text-[11px] uppercase tracking-widest text-secondary">
            Actual personal spend · Oct 2025
          </div>
          <div className="mt-4 font-mono text-5xl sm:text-6xl text-emerald-accent tracking-tight">
            $2,890
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-border">
            <Metric label="Bank outflow" value="$4,218" />
            <Metric label="Shared expenses fronted" value="−$1,840" />
            <Metric
              label="Reimbursements pending"
              value="+$560"
              sub="Owed to you · heuristic"
            />
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <div className="text-[11px] uppercase tracking-widest text-secondary mb-4">
              Where it went
            </div>
            {(
              [
                ["Rent", 950, 950],
                ["Groceries", 482, 950],
                ["Eating out", 244, 950],
                ["Social", 203, 950],
                ["Utilities", 121, 950],
              ] as const
            ).map(([name, amt, max]) => (
              <div key={name} className="mb-3">
                <div className="flex items-baseline justify-between text-sm">
                  <span>{name}</span>
                  <span className="font-mono">${amt}</span>
                </div>
                <div className="mt-1.5 h-px bg-border w-full relative">
                  <div
                    className="absolute left-0 top-0 h-px bg-foreground"
                    style={{ width: `${(amt / max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-24">
        <div className="text-[11px] uppercase tracking-widest text-secondary mb-8">
          How it works
        </div>

        <Step
          n="01"
          title="Connect your bank accounts with Plaid."
          mini={
            <div className="font-mono text-xs space-y-1.5 text-secondary">
              <div className="flex justify-between">
                <span>Oct 12 COSTCO SF</span>
                <span className="text-foreground">−$240.00</span>
              </div>
              <div className="flex justify-between">
                <span>Oct 13 AIRBNB</span>
                <span className="text-foreground">−$680.00</span>
              </div>
              <div className="flex justify-between">
                <span>Oct 14 WHOLE FOODS</span>
                <span className="text-foreground">−$74.18</span>
              </div>
              <div className="pt-2 mt-2 border-t border-border">
                Connected via Plaid
              </div>
            </div>
          }
        />
        <div className="ml-[44px] h-10 w-px bg-border" />
        <Step
          n="02"
          title="Link your Splitwise account."
          mini={
            <div className="font-mono text-xs space-y-3 text-secondary">
              <div>
                <div className="text-foreground">Tahoe Airbnb</div>
                <div>Total: $680.00 · Your share: $170.00</div>
              </div>
              <div>
                <div className="text-foreground">Costco</div>
                <div>Total: $240.00 · Your share: $80.00</div>
              </div>
            </div>
          }
        />
        <div className="ml-[44px] h-10 w-px bg-border" />
        <Step
          n="03"
          title="We reconcile the overlap and calculate what you actually spent."
          mini={
            <SubtractionBlock bank={4217} shared={1327} actual={2890} size="sm" />
          }
        />
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div className="space-y-6">
            <div className="text-[11px] uppercase tracking-widest text-secondary">
              Raw inputs
            </div>
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="text-[11px] uppercase tracking-wider text-secondary">
                Bank transaction
              </div>
              <div className="font-mono text-xs text-secondary mt-2">
                CHASE CHECKING · Oct 12
              </div>
              <div className="mt-1 text-[15px]">COSTCO WHOLESALE #412</div>
              <div className="mt-3 font-mono text-xl">−$240.00</div>
            </div>
            <div className="ml-4 h-6 w-px bg-border" />
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="text-[11px] uppercase tracking-wider text-secondary">
                Splitwise entry
              </div>
              <div className="mt-2 text-[15px]">Costco run</div>
              <div className="mt-2 font-mono text-xs text-secondary space-y-0.5">
                <div>Total expense: $240.00</div>
                <div>Your share: $80.00</div>
                <div>3 people · Settled via Venmo</div>
              </div>
            </div>
          </div>

          <div className="lg:pl-10 lg:border-l lg:border-border">
            <div className="text-[11px] uppercase tracking-widest text-secondary">
              Resolved
            </div>
            <div className="mt-4 text-[11px] uppercase tracking-wider text-secondary">
              Actual spend
            </div>
            <div className="mt-2 font-mono text-6xl text-emerald-accent">
              $80
            </div>
            <div className="mt-3 text-secondary text-sm">
              $160 attributed to roommates.
            </div>
            <div className="mt-8 max-w-sm">
              <SubtractionBlock
                bank={240}
                shared={160}
                actual={80}
                bankLabel="Bank charge"
                sharedLabel="Roommates' share"
                actualLabel="Your share"
                decimals={0}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-24">
        <h2 className="text-2xl tracking-tight font-medium">
          Your data stays yours.
        </h2>
        <ul className="mt-6 space-y-2 text-secondary">
          {[
            "Plaid handles bank authentication.",
            "Read-only transaction access.",
            "Splitwise connected through OAuth.",
            "No ads.",
            "No selling transaction data.",
            "Tokens encrypted at rest.",
            "Delete your account at any time.",
          ].map((t) => (
            <li key={t} className="flex gap-3">
              <span className="text-secondary mt-2">·</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex gap-8 text-secondary font-mono text-sm">
          <span>plaid</span>
          <span>splitwise</span>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-24">
        <div className="text-[11px] uppercase tracking-widest text-secondary mb-4">
          FAQ
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem
              key={f.q}
              value={`q-${i}`}
              className="border-border"
            >
              <AccordionTrigger
                data-testid={`faq-trigger-${i}`}
                className="text-left text-[15px] hover:no-underline"
              >
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-secondary text-[15px] leading-relaxed">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-10 text-sm text-secondary flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="flex gap-5">
            <Link href="/security" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/security" className="hover:text-foreground">
              Security
            </Link>
          </div>
          <div className="font-mono">rathod.pr@northeastern.edu</div>
        </div>
        <div className="max-w-3xl mx-auto px-6 pb-10 text-xs text-secondary">
          Built by an indie developer.
        </div>
      </footer>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-secondary">
        {label}
      </div>
      <div className="mt-2 font-mono text-2xl">{value}</div>
      {sub && <div className="mt-1 text-xs text-secondary">{sub}</div>}
    </div>
  );
}

function Step({
  n,
  title,
  mini,
}: {
  n: string;
  title: string;
  mini: React.ReactNode;
}) {
  return (
    <div className="flex gap-6">
      <div className="font-mono text-sm text-secondary w-7 pt-1">{n}</div>
      <div className="flex-1">
        <div className="text-[17px] leading-snug">{title}</div>
        <div className="mt-4 bg-surface border border-border rounded-xl p-4">
          {mini}
        </div>
      </div>
    </div>
  );
}
