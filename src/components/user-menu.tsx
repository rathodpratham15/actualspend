"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";

type Profile = {
  monthlyRent: string | null;
  rentPaidBy: string | null;
  rentPaymentMethod: string | null;
  groceryChannels: string[] | null;
  onboardingCompletedAt: string | null;
} | null;

function Avatar({
  name,
  email,
  image,
  size = 32,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size?: number;
}) {
  const initials = (name || email || "?")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  if (image) {
    return (
      <Image
        src={image}
        alt={name ?? email ?? "avatar"}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-emerald-soft text-emerald-accent flex items-center justify-center font-medium shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

const PAYMENT_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  check: "Check",
  zelle: "Zelle",
  venmo: "Venmo",
  credit_card: "Credit card",
  other: "Other",
};

const RENT_PAID_BY_LABELS: Record<string, string> = {
  self: "You pay",
  roommate: "Roommate pays",
  split: "Split",
};

export function UserMenu({ onClose }: { onClose?: () => void }) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile>(undefined as unknown as Profile);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch profile once on mount.
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  // Close on click outside.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const user = session?.user;
  if (!user) return null;

  const hasRent = !!profile?.monthlyRent;
  const hasGroceries = (profile?.groceryChannels?.length ?? 0) > 0;
  const skippedAny = profile !== undefined && (!hasRent || !hasGroceries);

  const toggle = () => setOpen((v) => !v);
  const close = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-testid="user-menu-btn"
        onClick={toggle}
        className="flex items-center rounded-full ring-2 ring-transparent hover:ring-border transition-all"
        aria-label="User menu"
      >
        <Avatar name={user.name} email={user.email} image={user.image} size={30} />
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-72 bg-background border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {/* User identity */}
          <div className="px-4 py-3 flex items-center gap-3 border-b border-border">
            <Avatar name={user.name} email={user.email} image={user.image} size={36} />
            <div className="min-w-0">
              {user.name && (
                <div className="text-sm font-medium truncate">{user.name}</div>
              )}
              <div className="text-xs text-secondary truncate">{user.email}</div>
            </div>
          </div>

          {/* Household details (from profile) */}
          {profile && (hasRent || hasGroceries) && (
            <div className="px-4 py-3 border-b border-border space-y-1.5">
              <div className="text-[10px] uppercase tracking-widest text-secondary mb-2">
                Household
              </div>
              {hasRent && (
                <div className="flex justify-between text-xs">
                  <span className="text-secondary">Monthly rent</span>
                  <span className="font-mono">
                    ${Number(profile.monthlyRent).toLocaleString()}
                    {profile.rentPaidBy && (
                      <span className="text-secondary ml-1">
                        · {RENT_PAID_BY_LABELS[profile.rentPaidBy] ?? profile.rentPaidBy}
                      </span>
                    )}
                  </span>
                </div>
              )}
              {hasRent && profile.rentPaymentMethod && (
                <div className="flex justify-between text-xs">
                  <span className="text-secondary">Paid via</span>
                  <span>{PAYMENT_LABELS[profile.rentPaymentMethod] ?? profile.rentPaymentMethod}</span>
                </div>
              )}
              {hasGroceries && (
                <div className="flex justify-between text-xs gap-4">
                  <span className="text-secondary shrink-0">Grocery stores</span>
                  <span className="text-right capitalize">
                    {profile.groceryChannels!
                      .slice(0, 3)
                      .map((c) => c.replace(/_/g, " "))
                      .join(", ")}
                    {(profile.groceryChannels!.length ?? 0) > 3 &&
                      ` +${profile.groceryChannels!.length - 3}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Incomplete onboarding steps */}
          {skippedAny && (
            <div className="px-4 py-3 border-b border-border">
              <div className="text-[10px] uppercase tracking-widest text-secondary mb-2">
                Setup incomplete
              </div>
              <div className="space-y-1.5">
                {!hasRent && (
                  <Link
                    href="/onboarding"
                    onClick={close}
                    className="flex items-center gap-2 text-xs text-secondary hover:text-foreground group"
                  >
                    <span className="w-4 h-4 rounded-full border border-border flex items-center justify-center shrink-0 group-hover:border-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-border group-hover:bg-foreground" />
                    </span>
                    Add rent details →
                  </Link>
                )}
                {!hasGroceries && (
                  <Link
                    href="/onboarding"
                    onClick={close}
                    className="flex items-center gap-2 text-xs text-secondary hover:text-foreground group"
                  >
                    <span className="w-4 h-4 rounded-full border border-border flex items-center justify-center shrink-0 group-hover:border-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-border group-hover:bg-foreground" />
                    </span>
                    Add grocery preferences →
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-2 py-2">
            <button
              type="button"
              data-testid="sign-out-btn"
              onClick={() => {
                close();
                signOut({ callbackUrl: "/welcome" });
              }}
              className="w-full text-left px-3 py-2 text-sm text-secondary hover:text-foreground hover:bg-surface rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
