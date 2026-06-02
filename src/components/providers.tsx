"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  // refetchInterval=0 disables the default 5-minute polling that causes
  // repeated GET /api/auth/session calls throughout the app lifetime.
  return <SessionProvider refetchInterval={0}>{children}</SessionProvider>;
}
