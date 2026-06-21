"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";

const PREFS = [
  {
    key: "email",
    label: "Email notifications",
    desc: "Account & security emails",
    default: true,
  },
  {
    key: "weekly",
    label: "Weekly digest",
    desc: "A summary of your spend every Monday",
    default: true,
  },
  {
    key: "recon",
    label: "Reconciliation alerts",
    desc: "Notify me when matches are ready to review",
    default: false,
  },
] as const;

export function ProfileNotifications() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(PREFS.map((p) => [p.key, p.default])),
  );

  return (
    <div className="surface-card p-5">
      <div className="text-sm font-medium mb-1">Notifications</div>
      <div className="text-xs text-secondary mb-4">Choose how we keep you in the loop.</div>
      <div className="space-y-0">
        {PREFS.map((p) => (
          <div key={p.key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
            <div>
              <div className="text-sm font-medium">{p.label}</div>
              <div className="text-xs text-secondary mt-0.5">{p.desc}</div>
            </div>
            <Switch
              checked={prefs[p.key]}
              onCheckedChange={(v) => setPrefs((prev) => ({ ...prev, [p.key]: v }))}
              data-testid={`toggle-${p.key}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
