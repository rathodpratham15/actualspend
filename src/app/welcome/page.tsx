"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { Shield, Zap, RefreshCw, Moon, ArrowRight, Check, Sparkles } from "lucide-react";

function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
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

export default function WelcomePage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const heroNum = useCountUp(1847.32);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) { toast.error("Enter a valid email."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      toast.success("You're on the list.", { description: "We'll be in touch when access opens." });
      setEmail("");
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader variant="marketing" />

      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 -left-24 h-[420px] w-[420px] rounded-full bg-emerald-soft blur-3xl opacity-70 dark:opacity-30" />
          <div className="absolute -top-16 right-0 h-[320px] w-[320px] rounded-full bg-amber-soft blur-3xl opacity-50 dark:opacity-20" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 pill pill-teal mb-6">
              <Sparkles className="h-3 w-3" strokeWidth={1.5} />
              Now in private beta
            </div>
            <h1 className="text-3xl sm:text-[44px] lg:text-[56px] leading-[1.05] font-medium tracking-tight">
              Your bank statement is wrong.
              <br />
              <span className="text-emerald-accent">Here&apos;s by how much.</span>
            </h1>
            <p className="mt-6 text-[17px] text-secondary max-w-xl leading-relaxed">
              ActualSpend reconciles your bank with Splitwise so the math actually adds up. One clean number — what you really spent, after splits.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register"
                className="inline-flex items-center h-11 px-5 rounded-md bg-foreground text-background text-sm hover:opacity-90 transition-opacity gap-1.5">
                Join waitlist <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </Link>
              <a href="#how"
                className="inline-flex items-center h-11 px-5 rounded-md text-foreground text-sm hover:bg-surface transition-colors">
                See how it works
              </a>
            </div>
          </div>

          {/* Hero metric preview */}
          <div className="relative mt-16 sm:mt-20">
            <div className="surface-card p-6 sm:p-8 max-w-2xl shadow-lift">
              <div className="text-[11px] uppercase tracking-wider text-secondary mb-2">Your actual spend · April</div>
              <div className="font-mono text-[44px] sm:text-[64px] leading-none text-emerald-accent tracking-tight">
                ${Math.floor(heroNum).toLocaleString()}<span className="text-emerald-accent/40">.{String(Math.round((heroNum % 1) * 100)).padStart(2, "0")}</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-4 text-sm border-t border-border pt-4">
                <div>
                  <div className="text-secondary text-xs">Bank outflow</div>
                  <div className="font-mono text-foreground mt-1">$2,447.32</div>
                </div>
                <div>
                  <div className="text-secondary text-xs">You fronted</div>
                  <div className="font-mono text-amber-accent mt-1">$600.00</div>
                </div>
                <div>
                  <div className="text-secondary text-xs">Pending</div>
                  <div className="font-mono text-emerald-accent mt-1">$418.50</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM / SOLUTION 3-UP */}
      <section className="bg-surface border-y border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
          <div className="max-w-2xl mb-12">
            <div className="text-xs uppercase tracking-widest text-secondary mb-3">The math</div>
            <h2 className="text-2xl sm:text-3xl font-medium tracking-tight">Three numbers that don&apos;t agree.</h2>
            <p className="mt-3 text-secondary max-w-xl">Your bank, your Splitwise, and what you actually spent live in different worlds. Until now.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {([
              { tag: "Your bank says", amt: "$2,447", note: "Total outflow this month.", variant: "pill-muted" },
              { tag: "You fronted", amt: "$600", note: "Paid on behalf of roommates.", variant: "pill-amber", color: "text-amber-accent" },
              { tag: "You actually spent", amt: "$1,847", note: "After Splitwise reconciliation.", variant: "pill-teal", color: "text-emerald-accent" },
            ] as const).map((c, i) => (
              <div key={i} className="surface-card p-6 hover:-translate-y-0.5 transition-transform">
                <div className={`pill ${c.variant} mb-4`}>{c.tag}</div>
                <div className={`font-mono text-3xl ${(c as {color?: string}).color ?? "text-foreground"}`}>{c.amt}</div>
                <p className="mt-3 text-sm text-secondary">{c.note}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-3 text-secondary font-mono text-[15px]">
            <span>$2,447</span>
            <span>−</span>
            <span className="text-amber-accent">$600</span>
            <span>=</span>
            <span className="text-emerald-accent text-[18px] font-medium">$1,847</span>
          </div>
        </div>
      </section>

      {/* FEATURE STRIP */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {([
            { icon: Shield, label: "Bank-grade security via Plaid" },
            { icon: Zap, label: "Splitwise sync in seconds" },
            { icon: RefreshCw, label: "Auto-reconciliation engine" },
            { icon: Moon, label: "Dark mode included" },
          ] as const).map((f, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-soft text-emerald-accent shrink-0">
                <f.icon className="h-4 w-4" strokeWidth={1.5} />
              </span>
              <div className="text-sm leading-snug pt-1.5">{f.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="bg-surface border-y border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
          <div className="max-w-2xl mb-12">
            <div className="text-xs uppercase tracking-widest text-secondary mb-3">How it works</div>
            <h2 className="text-2xl sm:text-3xl font-medium tracking-tight">Three steps. Then forget it exists.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "01", title: "Connect bank + Splitwise", body: "Plaid handles your bank. We read your Splitwise via OAuth. Read-only, always." },
              { n: "02", title: "We auto-match transactions", body: "Our heuristic engine pairs charges to splits in seconds — by amount, date and merchant." },
              { n: "03", title: "See your real spend", body: "One dashboard, one number. Plus the receipts for every reconciliation." },
            ].map((s, i) => (
              <div key={i} className="surface-card p-6">
                <div className="font-mono text-xs text-secondary tracking-wider">{s.n}</div>
                <div className="mt-3 text-[18px] font-medium tracking-tight">{s.title}</div>
                <p className="mt-2 text-sm text-secondary leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-emerald-accent text-background">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-medium tracking-tight">Get early access.</h2>
          <p className="mt-3 text-background/80 max-w-md mx-auto text-[15px]">
            We&apos;re opening invites in batches. Drop your email below.
          </p>
          <form onSubmit={submit} className="mt-7 flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
            <input
              type="email" required placeholder="you@neighborhood.nyc"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="h-11 flex-1 px-4 rounded-md bg-background/95 text-foreground border-transparent text-sm placeholder:text-foreground/40 focus:outline-none"
              data-testid="waitlist-email"
            />
            <button type="submit" disabled={submitting}
              className="h-11 px-5 rounded-md bg-background text-emerald-accent text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-1.5 whitespace-nowrap justify-center"
              data-testid="waitlist-submit">
              {submitting ? "Adding…" : <><span>Get access</span> <ArrowRight className="h-4 w-4" strokeWidth={1.5} /></>}
            </button>
          </form>
          <div className="mt-4 text-xs text-background/70 flex items-center justify-center gap-1.5">
            <Check className="h-3 w-3" strokeWidth={2} /> No spam. Unsubscribe anytime.
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-background border-t border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-secondary">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-emerald-accent text-background font-mono text-xs">$</span>
            <span>© 2026 ActualSpend</span>
          </div>
          <nav className="flex items-center gap-5">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/security" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
