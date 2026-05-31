import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Logo } from "@/components/logo";
import { CredentialsForm } from "@/components/credentials-form";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader variant="marketing" />

      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-[400px] bg-surface border border-border rounded-xl p-8 shadow-sm">
          <Link href="/welcome" className="inline-flex items-center gap-2.5 text-[15px] font-medium tracking-tight">
            <Logo size={28} />
            ActualSpend
          </Link>
          <p className="mt-3 text-secondary text-sm">
            Create an account to get started.
          </p>

          <div className="mt-6">
            <CredentialsForm mode="register" />
          </div>

          <p className="mt-4 text-center text-xs text-secondary">
            Already have an account?{" "}
            <Link href="/login" className="text-foreground hover:underline underline-offset-4">
              Sign in
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
  );
}
