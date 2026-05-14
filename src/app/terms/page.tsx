import Link from "next/link";

export const metadata = {
  title: "Terms · ActualSpend",
};

// Placeholder copy. NOT legal advice. Have an attorney review before
// going public.
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed">
      <div className="mb-10">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline hover:text-foreground"
        >
          ← Home
        </Link>
      </div>

      <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-muted-foreground">
        Last updated: {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
      </p>

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold">Using ActualSpend</h2>
        <p>
          ActualSpend is provided as-is. You may use it to view, reconcile,
          and categorize your own financial data. You agree not to:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Use the service for anyone&apos;s data other than your own.</li>
          <li>Attempt to access other users&apos; data.</li>
          <li>Circumvent rate limits or security measures.</li>
          <li>Resell or redistribute the service.</li>
        </ul>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">No financial advice</h2>
        <p>
          Nothing in ActualSpend constitutes financial, tax, legal, or
          investment advice. Numbers shown are derived from the data you
          connect and may contain errors. Verify before relying on them for
          decisions.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">Third-party services</h2>
        <p>
          Linking a bank goes through Plaid; linking Splitwise goes through
          Splitwise OAuth. Your use of those services is also governed by
          their respective terms.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">Account termination</h2>
        <p>
          You can stop using ActualSpend at any time. We may suspend or
          terminate accounts that violate these terms. Data deletion procedures
          are described in our{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">Limitation of liability</h2>
        <p>
          ActualSpend is not liable for any direct or indirect damages
          resulting from use of the service, including but not limited to lost
          data, missed financial obligations, or reliance on inaccurate
          reconciliation results.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">Contact</h2>
        <p>
          Questions? <a className="underline" href="mailto:hello@actualspend.app">hello@actualspend.app</a>
        </p>
      </section>
    </main>
  );
}
