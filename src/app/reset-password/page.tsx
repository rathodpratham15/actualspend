"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AppHeader } from "@/components/app-header";
import { Logo } from "@/components/logo";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <p className="mt-6 text-sm text-secondary">
        Invalid reset link.{" "}
        <Link href="/forgot-password" className="text-foreground hover:underline underline-offset-4">
          Request a new one
        </Link>
      </p>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to reset password.");
        return;
      }
      setDone(true);
      // Auto sign-in with new password not possible without email — redirect to login.
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mt-6">
        <p className="text-sm font-medium">Password updated.</p>
        <p className="mt-2 text-sm text-secondary">
          Your password has been reset. You can now sign in.
        </p>
        <button
          onClick={() => router.push("/login")}
          className="mt-6 w-full h-10 rounded-md bg-foreground text-background text-sm hover:opacity-90 transition-opacity"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <div>
        <label className="block text-xs text-secondary mb-1" htmlFor="rp-password">
          New password
        </label>
        <input
          id="rp-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm placeholder:text-secondary focus:outline-none focus:ring-1 focus:ring-foreground/30"
        />
      </div>
      <div>
        <label className="block text-xs text-secondary mb-1" htmlFor="rp-confirm">
          Confirm password
        </label>
        <input
          id="rp-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Same password again"
          className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm placeholder:text-secondary focus:outline-none focus:ring-1 focus:ring-foreground/30"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full h-10 rounded-md bg-foreground text-background text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {busy ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader variant="marketing" />
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-[400px] bg-surface border border-border rounded-xl p-8 shadow-sm">
          <Link href="/welcome" className="inline-flex items-center gap-2.5 text-[15px] font-medium tracking-tight">
            <Logo size={28} />
            ActualSpend
          </Link>
          <p className="mt-3 text-secondary text-sm">Choose a new password.</p>
          <Suspense>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
