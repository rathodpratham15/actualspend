import { AppHeader } from "@/components/app-header";

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="marketing" />

      <main className="max-w-2xl mx-auto px-6 pt-16 pb-24">
        <h1 className="text-3xl tracking-tight font-medium">Privacy</h1>
        <p className="mt-6 text-secondary leading-relaxed">
          ActualSpend stores the minimum amount of data required to reconcile
          transactions against shared expenses.
        </p>

        <h2 className="mt-12 text-base font-medium">What we store</h2>
        <div className="mt-4 border border-border rounded-xl divide-y divide-border">
          {(
            [
              ["Plaid access token", "Sync transactions"],
              ["Splitwise OAuth token", "Sync shared expenses"],
              ["Transaction metadata", "Reconciliation"],
              ["User-created rules", "Matching accuracy"],
              ["Aggregated monthly summaries", "Dashboard performance"],
            ] as const
          ).map(([k, v]) => (
            <div
              key={k}
              className="px-5 py-3 flex items-center justify-between"
            >
              <span className="text-sm">{k}</span>
              <span className="text-sm text-secondary">{v}</span>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-base font-medium">What we do not store</h2>
        <ul className="mt-4 space-y-2 text-secondary">
          <li>· Bank credentials</li>
          <li>· Full card numbers</li>
          <li>· MFA answers</li>
          <li>· Ability to move money</li>
        </ul>

        <h2 className="mt-12 text-base font-medium">Infrastructure</h2>
        <ul className="mt-4 space-y-2 text-secondary">
          <li>· Postgres hosted on Neon</li>
          <li>· Encrypted at rest</li>
          <li>· TLS in transit</li>
          <li>· Row-level access controls</li>
          <li>· Deletable on request</li>
        </ul>

        <h2 className="mt-12 text-base font-medium">Deletion</h2>
        <p className="mt-4 text-secondary leading-relaxed">
          Deleting your account revokes connected integrations and schedules
          transactional data for permanent deletion.
        </p>
      </main>
    </div>
  );
}
