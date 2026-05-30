import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Logo } from "@/components/logo";
import { auth, signIn } from "@/lib/auth";
import { CredentialsForm } from "@/components/credentials-form";

const LOGIN_ILLUSTRATION_LIGHT = "/login-illustration-light.svg";
const LOGIN_ILLUSTRATION_DARK = "/login-illustration.svg";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.3-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.8 16.1 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c5 0 9.6-1.9 13.1-5l-6-5.1c-2 1.5-4.5 2.4-7.1 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39 16.3 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6 5.1C40.8 35.5 43.5 30.2 43.5 24c0-1.2-.1-2.4-.3-3.5z" />
    </svg>
  );
}

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader variant="marketing" />

      <div className="flex flex-1 flex-col lg:flex-row min-h-0">
        {/* Left illustration panel */}
        <div className="relative flex flex-col items-center justify-center bg-emerald-soft px-6 pt-10 pb-6 lg:flex-1 lg:px-12 lg:py-16">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-accent/10 blur-3xl" />
            <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-emerald-accent/8 blur-3xl" />
          </div>
          <div className="relative w-full max-w-[320px] sm:max-w-[380px] fade-up">
            <Image src={LOGIN_ILLUSTRATION_LIGHT} alt="" width={500} height={500} priority unoptimized className="w-full h-auto drop-shadow-sm dark:hidden" />
            <Image src={LOGIN_ILLUSTRATION_DARK} alt="" width={500} height={500} priority unoptimized className="w-full h-auto drop-shadow-sm hidden dark:block" />
          </div>
          <p className="relative mt-6 max-w-xs text-center text-sm text-secondary leading-relaxed hidden sm:block fade-up delay-1">
            Connect once. We reconcile your bank with Splitwise so the number that matters is yours — not what roommates owed you.
          </p>
          <p className="relative mt-8 text-[10px] text-secondary/80">
            Illustration by{" "}
            <a href="https://storyset.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
              Storyset
            </a>
          </p>
        </div>

        {/* Right auth panel */}
        <div className="flex flex-1 items-center justify-center px-6 py-10 lg:py-16">
          <div className="w-full max-w-[400px] bg-surface border border-border rounded-xl p-8 shadow-sm fade-up delay-2">
            <Link href="/welcome" className="inline-flex items-center gap-2.5 text-[15px] font-medium tracking-tight" data-testid="login-brand">
              <Logo size={28} />
              ActualSpend
            </Link>
            <p className="mt-3 text-secondary text-sm leading-relaxed">
              See how much you actually spent — after roommates pay you back.
            </p>

            {/* Google */}
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                data-testid="google-signin-btn"
                className="mt-6 w-full h-10 inline-flex items-center justify-center gap-3 rounded-md border border-border bg-surface text-sm hover:bg-secondary transition-colors"
              >
                <GoogleIcon />
                Continue with Google
              </button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-secondary">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Email + password — client component handles submission */}
            <CredentialsForm mode="login" />

            <p className="mt-4 text-center text-xs text-secondary">
              No account?{" "}
              <Link href="/register" className="text-foreground hover:underline underline-offset-4">
                Sign up
              </Link>
            </p>

            <div className="mt-6 text-center">
              <Link href="/security" className="text-xs text-secondary hover:text-foreground">
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
