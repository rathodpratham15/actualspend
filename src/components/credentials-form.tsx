"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

type Props = { mode: "login" | "register" };

export function CredentialsForm({ mode }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, name: name || undefined }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Registration failed.");
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Incorrect email or password.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {mode === "register" && (
        <div>
          <label className="block text-xs text-secondary mb-1" htmlFor="cred-name">
            Name <span className="text-secondary/60">(optional)</span>
          </label>
          <input
            id="cred-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/30"
          />
        </div>
      )}

      <div>
        <label className="block text-xs text-secondary mb-1" htmlFor="cred-email">
          Email
        </label>
        <input
          id="cred-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@domain.com"
          className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/30"
        />
      </div>

      <div>
        <label className="block text-xs text-secondary mb-1" htmlFor="cred-password">
          Password
        </label>
        <input
          id="cred-password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "register" ? 8 : 1}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
          className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/30"
        />
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full h-10 rounded-md bg-foreground text-background text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}
