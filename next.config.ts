import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Google profile pictures from OAuth sign-in.
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

// Wrap with Sentry. The plugin is a no-op when SENTRY_AUTH_TOKEN isn't set —
// keeps local builds quiet. In production set:
//   SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN
// The auth token gates source-map upload; without it errors still arrive,
// they're just unminified.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  // Upload source maps in production builds only.
  widenClientFileUpload: true,
  disableLogger: true,
  // Tunnel client requests through this Next route to avoid ad-blockers
  // eating Sentry traffic.
  tunnelRoute: "/monitoring",
});
