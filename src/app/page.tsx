import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const session = await auth();
  const user = session?.user;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">ActualSpend</h1>
        {user && (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        )}
      </header>

      <section className="mt-16">
        <p className="text-sm uppercase tracking-wider text-muted-foreground">
          Signed in as
        </p>
        <p className="mt-1 text-lg font-medium">{user?.email}</p>
        <p className="mt-12 text-muted-foreground">
          Next steps: connect a bank, link Splitwise, see the truth.
        </p>
      </section>
    </main>
  );
}
