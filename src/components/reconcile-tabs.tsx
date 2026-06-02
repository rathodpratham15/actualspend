"use client";

// Thin client wrapper that adds tab navigation + search to the reconcile page.
// The actual section content is passed as React children (server-rendered).

import { useState } from "react";
import { Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Props = {
  counts: {
    awaiting: number;
    matched: number;
    splitwiseOnly: number;
    personal: number;
  };
  awaitingContent: React.ReactNode;
  matchedContent: React.ReactNode;
  splitwiseContent: React.ReactNode;
  personalContent: React.ReactNode;
};

export function ReconcileTabs({
  counts,
  awaitingContent,
  matchedContent,
  splitwiseContent,
  personalContent,
}: Props) {
  const [query, setQuery] = useState("");

  return (
    <div className="mt-6 space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-secondary" strokeWidth={1.5} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search merchant or description…"
          className="w-full h-9 pl-8 pr-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-foreground/30"
          data-testid="recon-search"
        />
      </div>

      <Tabs defaultValue={counts.awaiting > 0 ? "awaiting" : "matched"} className="w-full" data-testid="recon-tabs">
        <TabsList className="bg-muted/50 h-10 w-full sm:w-auto">
          <TabsTrigger value="awaiting" className="text-[13px] gap-1.5" data-testid="tab-awaiting">
            <span className="dot bg-amber-accent" />
            Awaiting
            <span className="font-mono text-secondary ml-0.5">{counts.awaiting}</span>
          </TabsTrigger>
          <TabsTrigger value="matched" className="text-[13px] gap-1.5" data-testid="tab-matched">
            <span className="dot bg-success" />
            Matched
            <span className="font-mono text-secondary ml-0.5">{counts.matched}</span>
          </TabsTrigger>
          <TabsTrigger value="splitwise" className="text-[13px] gap-1.5" data-testid="tab-splitwise">
            <span className="dot bg-secondary" />
            SW-only
            <span className="font-mono text-secondary ml-0.5">{counts.splitwiseOnly}</span>
          </TabsTrigger>
          <TabsTrigger value="personal" className="text-[13px] gap-1.5" data-testid="tab-personal">
            <span className="dot bg-foreground/40" />
            Personal
            <span className="font-mono text-secondary ml-0.5">{counts.personal}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="awaiting" className="mt-4 space-y-3">{awaitingContent}</TabsContent>
        <TabsContent value="matched" className="mt-4 space-y-3">{matchedContent}</TabsContent>
        <TabsContent value="splitwise" className="mt-4 space-y-3">{splitwiseContent}</TabsContent>
        <TabsContent value="personal" className="mt-4 space-y-2">{personalContent}</TabsContent>
      </Tabs>
    </div>
  );
}
