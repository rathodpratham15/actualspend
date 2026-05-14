export function usd(
  n: number,
  { decimals = 0, sign = false }: { decimals?: number; sign?: boolean } = {},
): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const s = `$${formatted}`;
  if (sign) return n < 0 ? `−${s}` : `+${s}`;
  return n < 0 ? `−${s}` : s;
}

export const usdCents = (n: number) => usd(n, { decimals: 2 });

export function dateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}
