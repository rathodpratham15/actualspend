"use client";

import { useState } from "react";
import Image from "next/image";

type Props = {
  initialName: string;
  email: string;
  image: string | null;
};

export function ProfileClient({ initialName, email, image }: Props) {
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const initials = (name || email)
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  const saveName = async () => {
    setBusy(true);
    await fetch("/api/profile/name", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex items-center gap-4">
      {/* Avatar */}
      {image ? (
        <Image
          src={image}
          alt={name || email}
          width={48}
          height={48}
          className="rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-emerald-soft text-emerald-accent flex items-center justify-center text-lg font-medium shrink-0">
          {initials}
        </div>
      )}

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveName();
                if (e.key === "Escape") setEditing(false);
              }}
              className="h-8 px-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-foreground/30 w-48"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveName()}
              className="h-8 px-3 rounded-md bg-foreground text-background text-xs hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setName(initialName); }}
              className="text-xs text-secondary hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{name || "(no name)"}</span>
            {saved && <span className="text-xs text-emerald-accent">Saved</span>}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-secondary hover:text-foreground"
            >
              Edit
            </button>
          </div>
        )}
        <div className="text-xs text-secondary mt-0.5">{email}</div>
      </div>
    </div>
  );
}
