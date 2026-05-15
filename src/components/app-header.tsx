"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

const navItem =
  "text-sm text-secondary hover:text-foreground transition-colors px-2 py-1 rounded";
const navItemActive = "text-foreground";

type Variant = "app" | "marketing";

function NavLink({
  href,
  exact = false,
  children,
  testid,
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
  testid?: string;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname?.startsWith(href);
  return (
    <Link
      href={href}
      data-testid={testid}
      className={`${navItem} ${isActive ? navItemActive : ""}`}
    >
      {children}
    </Link>
  );
}

export function AppHeader({ variant = "app" }: { variant?: Variant }) {
  const router = useRouter();

  return (
    <header
      data-testid="app-header"
      className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30"
    >
      <div className="max-w-[88rem] mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          href={variant === "app" ? "/" : "/welcome"}
          data-testid="brand-link"
          className="flex items-center gap-2 text-[15px] font-medium tracking-tight"
        >
          <Logo size={22} />
          ActualSpend
        </Link>

        <nav className="flex items-center gap-1">
          {variant === "app" ? (
            <>
              <NavLink href="/" exact testid="nav-dashboard">
                Dashboard
              </NavLink>
              <NavLink href="/accounts" testid="nav-accounts">
                Accounts
              </NavLink>
              <NavLink href="/reconcile" testid="nav-review">
                Review
              </NavLink>
              <button
                type="button"
                data-testid="sign-out-btn"
                onClick={() => router.push("/welcome")}
                className={`${navItem} cursor-pointer`}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <NavLink href="/security" testid="nav-security">
                Security
              </NavLink>
              <NavLink href="/changelog" testid="nav-changelog">
                Changelog
              </NavLink>
              <Link
                href="/login"
                data-testid="nav-login"
                className="ml-2 inline-flex items-center h-9 px-4 rounded-md bg-foreground text-background text-sm hover:opacity-90 transition-opacity"
              >
                Sign in
              </Link>
            </>
          )}
          <span className="mx-2 h-5 w-px bg-border" />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
