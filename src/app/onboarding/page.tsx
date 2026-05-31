import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { splitwiseFriends, splitwiseCredentials, userRoommates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { OnboardingForm } from "@/components/onboarding-form";
import { AppHeader } from "@/components/app-header";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Fetch Splitwise friends if connected so the roommate step can show them.
  const [swCred] = await db
    .select()
    .from(splitwiseCredentials)
    .where(eq(splitwiseCredentials.userId, session.user.id));

  const friends = swCred
    ? await db
        .select({
          splitwiseUserId: splitwiseFriends.splitwiseUserId,
          firstName: splitwiseFriends.firstName,
          lastName: splitwiseFriends.lastName,
          email: splitwiseFriends.email,
        })
        .from(splitwiseFriends)
        .where(eq(splitwiseFriends.userId, session.user.id))
    : [];

  // Pre-select already-saved roommates.
  const savedRoommates = await db
    .select({ splitwiseUserId: userRoommates.splitwiseUserId })
    .from(userRoommates)
    .where(eq(userRoommates.userId, session.user.id));

  const savedRoommateIds = savedRoommates.map((r) => r.splitwiseUserId);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="app" />
      <OnboardingForm
        friends={friends}
        savedRoommateIds={savedRoommateIds}
        hasSplitwise={!!swCred}
      />
    </div>
  );
}
