"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Friend = {
  splitwiseUserId: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  balance: string;
};

type Props = { friends: Friend[] };

export function RoommateModal({ friends }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const isOpen = params.get("sw") === "connected";

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("sw");
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
  }, [router, pathname, params]);

  const save = async (skip = false) => {
    setBusy(true);
    await fetch("/api/roommates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        splitwiseUserIds: skip ? [] : Array.from(selected),
      }),
    });
    setBusy(false);
    close();
    router.refresh();
  };

  if (!isOpen || friends.length === 0) return null;

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const displayName = (f: Friend) =>
    `${f.firstName ?? ""} ${f.lastName ?? ""}`.trim() ||
    f.email ||
    `User ${f.splitwiseUserId}`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={() => save(true)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-sm p-6">
          <h2 className="text-base font-medium tracking-tight">
            Which of these are your roommates?
          </h2>
          <p className="mt-1 text-sm text-secondary">
            We&apos;ll give extra weight to shared expenses with roommates
            when reconciling your spending.
          </p>

          <div className="mt-5 space-y-2 max-h-64 overflow-y-auto">
            {friends.map((f) => (
              <label
                key={f.splitwiseUserId}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                  selected.has(f.splitwiseUserId)
                    ? "border-foreground bg-surface"
                    : "border-border hover:bg-surface"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(f.splitwiseUserId)}
                  onChange={() => toggle(f.splitwiseUserId)}
                  className="accent-foreground"
                />
                <div className="min-w-0">
                  <div className="text-sm">{displayName(f)}</div>
                  {f.email && (
                    <div className="text-xs text-secondary truncate">
                      {f.email}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => save(true)}
              className="text-sm text-secondary hover:text-foreground"
            >
              Skip for now
            </button>
            <button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={() => save(false)}
              className="h-9 px-5 rounded-md bg-foreground text-background text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy ? "Saving…" : `Save${selected.size > 0 ? ` (${selected.size})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
