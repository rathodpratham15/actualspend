import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userProfiles, userRoommates, splitwiseFriends, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AppHeader } from "@/components/app-header";
import { ProfileClient } from "@/components/profile-client";

const PAYMENT_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer / ACH",
  check: "Check",
  zelle: "Zelle",
  venmo: "Venmo",
  credit_card: "Credit card",
  other: "Other",
};

const RENT_PAID_BY_LABELS: Record<string, string> = {
  self: "I pay it",
  roommate: "Roommate pays",
  split: "We split it",
};

const GROCERY_LABELS: Record<string, string> = {
  instacart: "Instacart",
  costco: "Costco",
  aldi: "Aldi",
  trader_joes: "Trader Joe's",
  whole_foods: "Whole Foods",
  amazon_fresh: "Amazon Fresh",
  walmart: "Walmart",
  target: "Target",
  local: "Local grocery stores",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [userRow, profile, roommates] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.user.id)).limit(1).then(r => r[0]),
    db.select().from(userProfiles).where(eq(userProfiles.userId, session.user.id)).limit(1).then(r => r[0] ?? null),
    db
      .select({
        splitwiseUserId: userRoommates.splitwiseUserId,
        firstName: splitwiseFriends.firstName,
        lastName: splitwiseFriends.lastName,
        email: splitwiseFriends.email,
      })
      .from(userRoommates)
      .leftJoin(splitwiseFriends, eq(splitwiseFriends.splitwiseUserId, userRoommates.splitwiseUserId))
      .where(eq(userRoommates.userId, session.user.id)),
  ]);

  const hasRent = !!profile?.monthlyRent;
  const hasGroceries = (profile?.groceryChannels?.length ?? 0) > 0;
  const hasRoommates = roommates.length > 0;

  const setupSteps = [
    {
      id: "rent",
      label: "Rent details",
      done: hasRent,
      description: hasRent
        ? `$${Number(profile!.monthlyRent).toLocaleString()}/mo · ${RENT_PAID_BY_LABELS[profile!.rentPaidBy ?? ""] ?? profile?.rentPaidBy ?? ""}${profile?.rentPaymentMethod ? ` · ${PAYMENT_LABELS[profile.rentPaymentMethod] ?? profile.rentPaymentMethod}` : ""}`
        : "Not set",
    },
    {
      id: "groceries",
      label: "Grocery preferences",
      done: hasGroceries,
      description: hasGroceries
        ? profile!.groceryChannels!.map(c => GROCERY_LABELS[c] ?? c).join(", ")
        : "Not set",
    },
    {
      id: "roommates",
      label: "Roommates",
      done: hasRoommates,
      description: hasRoommates
        ? roommates
            .map(r => `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || r.email || `User ${r.splitwiseUserId}`)
            .join(", ")
        : "Not set",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-24">
        <h1 className="text-xl font-medium tracking-tight">Profile</h1>

        {/* Identity */}
        <section className="mt-6 bg-surface border border-border rounded-xl p-5">
          <ProfileClient
            initialName={userRow?.name ?? ""}
            email={session.user.email ?? ""}
            image={session.user.image ?? null}
          />
        </section>

        {/* Household setup */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium">Household setup</h2>
            <a
              href="/onboarding"
              className="text-xs text-secondary hover:text-foreground"
            >
              Edit →
            </a>
          </div>
          <div className="bg-surface border border-border rounded-xl divide-y divide-border">
            {setupSteps.map((step) => (
              <div key={step.id} className="px-5 py-3.5 flex items-start gap-3">
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  step.done ? "border-emerald-accent bg-emerald-soft" : "border-border"
                }`}>
                  {step.done && (
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="var(--emerald-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{step.label}</div>
                  <div className={`text-xs mt-0.5 truncate ${step.done ? "text-secondary" : "text-secondary/60"}`}>
                    {step.description}
                  </div>
                </div>
                {!step.done && (
                  <a href="/onboarding" className="ml-auto text-xs text-secondary hover:text-foreground shrink-0">
                    Set up →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
