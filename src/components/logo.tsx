type LogoProps = {
  size?: number;
  className?: string;
};

export function Logo({ size = 24, className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="ActualSpend"
    >
      <path d="M32 2 A30 30 0 0 0 32 62 Z" fill="#0F766E" />
      <path d="M32 2 A30 30 0 0 1 32 62 Z" fill="#5EEAD4" />
      <text
        x="32"
        y="46"
        textAnchor="middle"
        fontSize="42"
        fontWeight={700}
        fontFamily="var(--font-geist-sans), system-ui, sans-serif"
        fill="#ffffff"
      >
        $
      </text>
    </svg>
  );
}
