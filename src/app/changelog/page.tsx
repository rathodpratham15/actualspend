import { AppHeader } from "@/components/app-header";
import { changelogEntries } from "@/lib/seed";

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="marketing" />
      <main className="max-w-2xl mx-auto px-6 pt-16 pb-24">
        <h1 className="text-3xl tracking-tight font-medium">Changelog</h1>
        <div className="mt-12 space-y-12">
          {changelogEntries.map((e) => (
            <div key={e.date} data-testid={`changelog-${e.date}`}>
              <div className="font-mono text-sm text-secondary">{e.date}</div>
              <ul className="mt-3 space-y-2 text-foreground leading-relaxed">
                {e.items.map((it) => (
                  <li key={it} className="flex gap-3">
                    <span className="text-secondary mt-2">·</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
