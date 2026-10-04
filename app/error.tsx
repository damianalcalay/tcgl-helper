"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="panel setup-panel">
      <h1>Something went wrong</h1>
      <p>We could not open this page. Please try again.</p>
      <Button onClick={reset}>Try again</Button>
    </section>
  );
}
