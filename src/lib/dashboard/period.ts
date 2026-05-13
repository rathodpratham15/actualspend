// Period parsing for the dashboard. URL drives state via ?from=&to= (ISO
// date strings, yyyy-mm-dd). Defaults to the current calendar month so the
// dashboard always lands on a meaningful window even without query params.

export type Period = {
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getCurrentMonthPeriod(): Period {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toIsoDate(first), to: toIsoDate(now) };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parsePeriod(
  searchParams: Record<string, string | string[] | undefined>,
): Period {
  const fromRaw = Array.isArray(searchParams.from)
    ? searchParams.from[0]
    : searchParams.from;
  const toRaw = Array.isArray(searchParams.to)
    ? searchParams.to[0]
    : searchParams.to;
  if (fromRaw && toRaw && ISO_DATE.test(fromRaw) && ISO_DATE.test(toRaw)) {
    return { from: fromRaw, to: toRaw };
  }
  return getCurrentMonthPeriod();
}

export function formatPeriod(p: Period): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  return `${fmt(p.from)} – ${fmt(p.to)}`;
}
