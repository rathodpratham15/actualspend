import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function ConnectSplitwiseButton({
  variant = "default",
}: {
  variant?: "default" | "outline";
}) {
  return (
    <Link href="/api/splitwise/auth" className={buttonVariants({ variant })}>
      Connect Splitwise
    </Link>
  );
}
