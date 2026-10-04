import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <section className="panel setup-panel">
      <h1>Page not found</h1>
      <p>This page is not part of your workspace.</p>
      <Button asChild>
        <Link href="/decks">Back to Decks</Link>
      </Button>
    </section>
  );
}
