import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.3-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.8 16.1 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5 0 9.6-1.9 13.1-5l-6-5.1c-2 1.5-4.5 2.4-7.1 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39 16.3 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6 5.1C40.8 35.5 43.5 30.2 43.5 24c0-1.2-.1-2.4-.3-3.5z"
      />
    </svg>
  );
}

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-[400px] bg-surface border border-border rounded-xl p-8">
        <Link
          href="/welcome"
          className="text-[15px] font-medium tracking-tight inline-block"
          data-testid="login-brand"
        >
          ActualSpend
        </Link>
        <p className="mt-3 text-secondary text-sm leading-relaxed">
          See how much you actually spent — after roommates pay you back.
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            data-testid="google-signin-btn"
            className="mt-8 w-full h-10 inline-flex items-center justify-center gap-3 rounded-md border border-border bg-surface text-sm hover:bg-secondary transition-colors"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link
            href="/security"
            className="text-xs text-secondary hover:text-foreground"
          >
            Security
          </Link>
        </div>
      </div>
    </div>
  );
}
