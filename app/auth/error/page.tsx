import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function AuthError() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <section className="panel setup-panel">
        <h1>This link could not be verified</h1>
        <p>
          The confirmation or recovery link may have expired. Request a new link
          and try again.
        </p>
        <Button asChild>
          <Link href="/auth/login">Back to sign in</Link>
        </Button>
      </section>
    </div>
  );
}
