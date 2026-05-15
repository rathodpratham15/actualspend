import * as Sentry from "@sentry/nextjs";

// Server + edge runtime Sentry init. The browser counterpart is in
// instrumentation-client.ts. If SENTRY_DSN isn't set we no-op so dev / preview
// environments work without a Sentry account.

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      // Sample 100% for the early days — flip down to ~0.1 once traffic shows up.
      tracesSampleRate: 1.0,
    });
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: 1.0,
    });
  }
}

// Required hook so server-rendered errors land in Sentry too.
export const onRequestError = Sentry.captureRequestError;
