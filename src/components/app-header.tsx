"use client";

import { useState } from "react";
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
  onClick,
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
  testid?: string;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname?.startsWith(href);
  return (
    <Link
      href={href}
      data-testid={testid}
      onClick={onClick}
      className={`${navItem} ${isActive ? navItemActive : ""}`}
    >
      {children}
    </Link>
  );
}

export function AppHeader({ variant = "app" }: { variant?: Variant }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const onLoginPage = pathname === "/login";

  const appLinks = (
    <>
      <NavLink href="/" exact testid="nav-dashboard" onClick={close}>
        Dashboard
      </NavLink>
      <NavLink href="/accounts" testid="nav-accounts" onClick={close}>
        Accounts
      </NavLink>
      <NavLink href="/reconcile" testid="nav-review" onClick={close}>
        Review
      </NavLink>
      <NavLink href="/merchants" testid="nav-merchants" onClick={close}>
        Merchants
      </NavLink>
      <button
        type="button"
        data-testid="sign-out-btn"
        onClick={() => {
          close();
          router.push("/welcome");
        }}
        className={`${navItem} cursor-pointer text-left`}
      >
        Sign out
      </button>
    </>
  );

  // Desktop marketing nav — Sign in is the primary CTA, inverse-colored
  // for emphasis.
  const marketingLinksDesktop = (
    <>
      <NavLink href="/security" testid="nav-privacy" onClick={close}>
        Privacy
      </NavLink>
      {!onLoginPage && (
        <Link
          href="/login"
          data-testid="nav-login"
          onClick={close}
          className="inline-flex items-center h-9 px-4 rounded-md bg-foreground text-background text-sm hover:opacity-90 transition-opacity"
        >
          Sign in
        </Link>
      )}
    </>
  );

  // Mobile drawer marketing nav — Sign in is rendered as a plain text link
  // matching the other items in the drawer. The desktop nav keeps the
  // boxed inverse CTA; in the drawer that styling reads as an "active
  // page" indicator and misleads users into thinking they're on the
  // Sign-in page.
  const marketingLinksMobile = (
    <>
      <NavLink href="/security" testid="nav-privacy" onClick={close}>
        Privacy
      </NavLink>
      {!onLoginPage && (
        <Link
          href="/login"
          data-testid="nav-login"
          onClick={close}
          className={`${navItem} text-foreground`}
        >
          Sign in
        </Link>
      )}
    </>
  );

  return (
    <header
      data-testid="app-header"
      className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30"
    >
      <div className="max-w-352 mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <Link
          href={variant === "app" ? "/" : "/welcome"}
          data-testid="brand-link"
          onClick={close}
          className="flex items-center gap-2 text-[15px] font-medium tracking-tight shrink-0"
        >
          <Logo size={22} />
          ActualSpend
        </Link>

        {/* Desktop nav — full width >= sm */}
        <nav className="hidden sm:flex items-center gap-1">
          {variant === "app" ? appLinks : marketingLinksDesktop}
          <span className="mx-2 h-5 w-px bg-border" />
          <ThemeToggle />
        </nav>

        {/* Mobile: theme toggle stays visible, everything else folds into a hamburger */}
        <div className="flex items-center gap-1 sm:hidden">
          <ThemeToggle />
          <button
            type="button"
            data-testid="mobile-menu-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label="Toggle menu"
            className="inline-flex items-center justify-center h-9 w-9 rounded text-secondary hover:text-foreground"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              {open ? (
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              ) : (
                <g
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                >
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </g>
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div
          id="mobile-nav"
          className="sm:hidden border-t border-border bg-background"
        >
          <nav className="flex flex-col px-4 py-3 gap-1">
            {variant === "app" ? appLinks : marketingLinksMobile}
          </nav>
        </div>
      )}
    </header>
  );
}
