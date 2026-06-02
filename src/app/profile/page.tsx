import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userProfiles, userRoommates, splitwiseFriends, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ProfileClient } from "@/components/profile-client";
import { Users, ShieldCheck } from "lucide-react";

const PAYMENT_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer / ACH", check: "Check", zelle: "Zelle",
  venmo: "Venmo", credit_card: "Credit card", other: "Other",
};
const GROCERY_LABELS: Record<string, string> = {
  instacart: "Instacart", costco: "Costco", aldi: "Aldi",
  trader_joes: "Trader Joe's", whole_foods: "Whole Foods",
  amazon_fresh: "Amazon Fresh", walmart: "Walmart", target: "Target",
  local: "Local grocery stores",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [userRow, profile, roommates] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.user.id)).limit(1).then(r => r[0]),
    db.select().from(userProfiles).where(eq(userProfiles.userId, session.user.id)).limit(1).then(r => r[0] ?? null),
    db.select({
      splitwiseUserId: userRoommates.splitwiseUserId,
      firstName: splitwiseFriends.firstName,
      lastName: splitwiseFriends.lastName,
      email: splitwiseFriends.email,
    })
    .from(userRoommates)
    .leftJoin(splitwiseFriends, eq(splitwiseFriends.splitwiseUserId, userRoommates.splitwiseUserId))
    .where(eq(userRoommates.userId, session.user.id)),
  ]);

  const hasRent = !!(profile?.totalMonthlyRent || profile?.monthlyRent);
  const hasGroceries = (profile?.groceryChannels?.length ?? 0) > 0;
  const hasRoommates = roommates.length > 0;

  const setupSteps = [
    {
      id: "rent", label: "Rent details", done: hasRent,
      description: hasRent ? (() => {
        const total = profile!.totalMonthlyRent ?? profile!.monthlyRent;
        const own = profile!.ownRentShare;
        const base = own
          ? `$${Number(own).toLocaleString()} your share · $${Number(total).toLocaleString()} total`
          : `$${Number(total).toLocaleString()}/mo`;
        return base + (profile?.rentPaymentMethod ? ` · ${PAYMENT_LABELS[profile.rentPaymentMethod] ?? profile.rentPaymentMethod}` : "");
      })() : "Not set",
    },
    {
      id: "groceries", label: "Grocery preferences", done: hasGroceries,
      description: hasGroceries ? profile!.groceryChannels!.map(c => GROCERY_LABELS[c] ?? c).join(", ") : "Not set",
    },
    {
      id: "roommates", label: "Roommates", done: hasRoommates,
      description: hasRoommates
        ? roommates.map(r => `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || r.email || `User ${r.splitwiseUserId}`).join(", ")
        : "Not set",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-24 space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-secondary">Settings</div>
          <h1 className="text-[22px] font-medium tracking-tight mt-1">Profile</h1>
        </div>

        {/* Identity */}
        <div className="surface-card p-6">
          <ProfileClient
            initialName={userRow?.name ?? ""}
            email={session.user.email ?? ""}
            image={session.user.image ?? null}
          />
        </div>

        {/* Household setup */}
        <div className="surface-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <div className="text-sm font-medium">Household setup</div>
            <Link href="/onboarding" className="text-xs text-secondary hover:text-foreground">Edit →</Link>
          </div>
          <div className="divide-y divide-border">
            {setupSteps.map((step) => (
              <div key={step.id} className="px-5 py-3.5 flex items-start gap-3">
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${step.done ? "border-emerald-accent bg-emerald-soft" : "border-border"}`}>
                  {step.done && (
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="var(--emerald)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{step.label}</div>
                  <div className={`text-xs mt-0.5 truncate ${step.done ? "text-secondary" : "text-secondary/60"}`}>{step.description}</div>
                </div>
                <a href={`/onboarding?step=${step.id}`} className="ml-auto text-xs text-secondary hover:text-foreground shrink-0">
                  {step.done ? "Edit →" : "Set up →"}
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Friends shortcut */}
        <div className="surface-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-secondary" strokeWidth={1.5} />
            <div className="text-sm font-medium">Friends</div>
          </div>
          <div className="text-xs text-secondary mb-3">Review balances with your roommates and friends.</div>
          <Link href="/friends" className="inline-flex items-center h-9 px-4 rounded-md border border-border text-sm hover:bg-surface transition-colors">
            View friends
          </Link>
        </div>

        {/* Security */}
        <div className="surface-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-secondary" strokeWidth={1.5} />
            <div className="text-sm font-medium">Security</div>
          </div>
          <div className="text-xs text-secondary mb-3">Change your password regularly to keep your account safe.</div>
          <Link href="/forgot-password" className="inline-flex items-center h-9 px-4 rounded-md border border-border text-sm hover:bg-surface transition-colors">
            Change password
          </Link>
        </div>

        {/* Danger zone */}
        <div className="surface-card p-5 border-destructive/30" style={{ background: "color-mix(in srgb, var(--destructive-soft) 40%, var(--surface))" }}>
          <div className="text-sm font-medium text-destructive mb-1">Danger zone</div>
          <div className="text-xs text-secondary mb-3">Permanently delete your account and all associated data. This cannot be undone.</div>
          <button className="inline-flex items-center h-9 px-4 rounded-md bg-destructive text-white text-sm hover:opacity-90 transition-opacity">
            Delete account
          </button>
        </div>
      </main>
    </div>
  );
}
