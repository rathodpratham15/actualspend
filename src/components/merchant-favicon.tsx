"use client";

import { useState } from "react";

function deriveDomain(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join("") + ".com";
}

export function MerchantFavicon({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted text-[11px] font-mono text-secondary shrink-0 select-none">
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${deriveDomain(name)}&sz=64`}
      alt=""
      width={28}
      height={28}
      className="rounded-md shrink-0"
      onError={() => setFailed(true)}
    />
  );
}
