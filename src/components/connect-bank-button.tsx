"use client";

import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function ConnectBankButton({
  variant = "default",
}: {
  variant?: "default" | "outline";
}) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/plaid/link-token", { method: "POST" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) => setLinkToken(d.link_token))
      .catch((e) => console.error("link-token fetch failed", e));
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      setBusy(true);
      try {
        const ex = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token,
            institution: metadata.institution,
          }),
        });
        if (!ex.ok) throw new Error(await ex.text());
        await fetch("/api/plaid/sync", { method: "POST" });
        router.refresh();
      } catch (e) {
        console.error("exchange/sync failed", e);
      } finally {
        setBusy(false);
      }
    },
  });

  return (
    <Button
      variant={variant}
      onClick={() => open()}
      disabled={!ready || !linkToken || busy}
    >
      {busy ? "Connecting…" : "Connect a bank"}
    </Button>
  );
}
