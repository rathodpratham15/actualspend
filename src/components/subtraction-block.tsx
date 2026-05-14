import { usd } from "@/lib/format";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { row: string; actual: string }> = {
  sm: { row: "text-sm", actual: "text-base" },
  md: { row: "text-base", actual: "text-xl" },
  lg: { row: "text-lg", actual: "text-2xl" },
};

export function SubtractionBlock({
  bank,
  shared,
  actual,
  bankLabel = "Bank outflow",
  sharedLabel = "Shared adjustments",
  actualLabel = "Actual spend",
  decimals = 0,
  size = "md",
}: {
  bank: number;
  shared: number;
  actual: number;
  bankLabel?: string;
  sharedLabel?: string;
  actualLabel?: string;
  decimals?: number;
  size?: Size;
}) {
  const sizes = SIZES[size];

  return (
    <div data-testid="subtraction-block" className="w-full max-w-md font-mono">
      <div className={`flex items-baseline justify-between ${sizes.row}`}>
        <span className="text-secondary">{bankLabel}</span>
        <span>{usd(bank, { decimals })}</span>
      </div>
      <div className={`flex items-baseline justify-between mt-1 ${sizes.row}`}>
        <span className="text-secondary">{sharedLabel}</span>
        <span>−{usd(shared, { decimals }).replace("−", "")}</span>
      </div>
      <div className="my-2 h-px bg-border w-full" />
      <div
        className={`flex items-baseline justify-between ${sizes.actual} font-medium`}
      >
        <span className="text-foreground">{actualLabel}</span>
        <span className="text-emerald-accent">{usd(actual, { decimals })}</span>
      </div>
    </div>
  );
}
