"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Props = {
  page: number;
  totalPages: number;
  totalRows: number;
  pageSize: number;
};

export function PaginationControls({ page, totalPages, totalRows, pageSize }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (totalPages <= 1) return null;

  function go(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}`);
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalRows);

  // Show at most 5 page numbers centred on current page.
  const delta = 2;
  const start = Math.max(1, page - delta);
  const end = Math.min(totalPages, page + delta);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <span className="text-xs font-mono text-secondary">
        {from}–{to} of {totalRows}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => go(page - 1)}
          className="h-7 w-7 flex items-center justify-center rounded text-secondary hover:text-foreground hover:bg-surface transition-colors disabled:opacity-30"
          aria-label="Previous page"
        >
          ‹
        </button>
        {start > 1 && (
          <>
            <PageBtn p={1} current={page} go={go} />
            {start > 2 && <span className="text-xs text-secondary px-1">…</span>}
          </>
        )}
        {pages.map((p) => (
          <PageBtn key={p} p={p} current={page} go={go} />
        ))}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="text-xs text-secondary px-1">…</span>}
            <PageBtn p={totalPages} current={page} go={go} />
          </>
        )}
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => go(page + 1)}
          className="h-7 w-7 flex items-center justify-center rounded text-secondary hover:text-foreground hover:bg-surface transition-colors disabled:opacity-30"
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}

function PageBtn({ p, current, go }: { p: number; current: number; go: (p: number) => void }) {
  const active = p === current;
  return (
    <button
      type="button"
      onClick={() => go(p)}
      className={`h-7 w-7 flex items-center justify-center rounded text-xs font-mono transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-secondary hover:text-foreground hover:bg-surface"
      }`}
    >
      {p}
    </button>
  );
}
