import * as Sentry from "@sentry/nextjs";

// Browser-side Sentry init. NEXT_PUBLIC_SENTRY_DSN is exposed to the client;
// scope it to a dedicated frontend DSN if you don't want session replay /
// JS errors and server errors mixed in the same Sentry project.

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 1.0,
    // Replay disabled by default — opt in later when you want it.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
