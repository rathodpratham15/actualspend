"use client";

import { useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { Logo } from "@/components/logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader variant="marketing" />
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-[400px] bg-surface border border-border rounded-xl p-8 shadow-sm">
          <Link href="/welcome" className="inline-flex items-center gap-2.5 text-[15px] font-medium tracking-tight">
            <Logo size={28} />
            ActualSpend
          </Link>

          {submitted ? (
            <div className="mt-6">
              <p className="text-sm text-foreground font-medium">Check your inbox</p>
              <p className="mt-2 text-sm text-secondary leading-relaxed">
                If an account exists for <span className="text-foreground">{email}</span>,
                we sent a password reset link. It expires in 1 hour.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block text-sm text-secondary hover:text-foreground"
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-3 text-secondary text-sm">
                Enter your email and we&apos;ll send you a reset link.
              </p>
              <form onSubmit={submit} className="mt-6 space-y-3">
                <div>
                  <label className="block text-xs text-secondary mb-1" htmlFor="fp-email">
                    Email
                  </label>
                  <input
                    id="fp-email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/30"
                  />
                </div>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full h-10 rounded-md bg-foreground text-background text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Send reset link"}
                </button>
              </form>
              <p className="mt-4 text-center text-xs text-secondary">
                <Link href="/login" className="hover:text-foreground">
                  ← Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
