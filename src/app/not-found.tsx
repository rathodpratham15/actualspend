import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="font-mono text-[64px] text-emerald-accent leading-none">404</div>
        <h1 className="text-[20px] font-medium tracking-tight mt-3">Page not found</h1>
        <p className="text-sm text-secondary mt-2">
          The page you&apos;re looking for doesn&apos;t exist — or you&apos;re not signed in.
        </p>
        <Link
          href="/welcome"
          className="inline-flex items-center justify-center mt-6 h-10 px-5 rounded-md bg-foreground text-background text-sm hover:opacity-90 transition-opacity"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
