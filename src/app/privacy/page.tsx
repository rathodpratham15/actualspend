import Link from "next/link";

export const metadata = {
  title: "Privacy · ActualSpend",
};

// Placeholder copy. NOT legal advice. Have an attorney review before
// going public — Plaid and Splitwise production reviews both verify these
// pages and check for required disclosures about financial data handling.
export default function PrivacyPage() {
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

      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-muted-foreground">
        Last updated: {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
      </p>

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold">Who we are</h2>
        <p>
          ActualSpend is a personal money-management tool that helps you see
          your real spending after shared costs and reimbursements are
          reconciled. We are not a bank, a payment processor, or a money
          transmitter.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">What we collect</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Account identity</strong> — your name, email, and profile
            image from Google when you sign in.
          </li>
          <li>
            <strong>Bank transactions</strong> — when you link a bank via
            Plaid, we receive transaction history, balances, and account
            metadata. We do <em>not</em> receive your bank credentials; those
            stay with Plaid.
          </li>
          <li>
            <strong>Splitwise data</strong> — when you connect Splitwise, we
            receive your expenses, payments, friends list, and per-friend
            balances via the Splitwise API.
          </li>
          <li>
            <strong>Derived data</strong> — reconciliation decisions,
            categorization labels, and any tags we generate from the above.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">What we don&apos;t do</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>We do not sell your data.</li>
          <li>We do not share data with advertisers.</li>
          <li>We do not move money on your behalf.</li>
          <li>
            We do not use your data to train any model that is shared outside
            this product.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">Where data is stored</h2>
        <p>
          Data is stored in Postgres hosted by Neon (US, AWS us-east-1) and in
          Plaid&apos;s and Splitwise&apos;s respective systems. All connections
          are encrypted in transit; data is encrypted at rest.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">How to delete your data</h2>
        <p>
          Email us at <a className="underline" href="mailto:privacy@actualspend.app">privacy@actualspend.app</a> to
          request deletion. We will purge your bank tokens, Splitwise tokens,
          and all stored data within 30 days.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">Third-party services</h2>
        <p>
          ActualSpend relies on:{" "}
          <a className="underline" href="https://plaid.com/legal/" target="_blank" rel="noreferrer">Plaid</a>,{" "}
          <a className="underline" href="https://www.splitwise.com/privacy" target="_blank" rel="noreferrer">Splitwise</a>,{" "}
          <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google</a> (sign-in), and{" "}
          <a className="underline" href="https://neon.com/privacy-policy" target="_blank" rel="noreferrer">Neon</a> (database).
          Their privacy policies apply to data they hold on your behalf.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">Contact</h2>
        <p>
          Questions? <a className="underline" href="mailto:privacy@actualspend.app">privacy@actualspend.app</a>
        </p>
      </section>
    </main>
  );
}
