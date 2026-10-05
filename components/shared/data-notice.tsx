"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Database, RefreshCw } from "lucide-react";
export function DataNotice({
  setup,
  error,
}: {
  setup?: boolean;
  error?: string;
}) {
  const router = useRouter();
  return (
    <section className="panel setup-panel">
      <Database size={36} className="text-primary" />
      <h1>
        {setup ? "Connect your workspace" : "Unable to load your workspace"}
      </h1>
      <p>
        {setup
          ? "TCG Helper is ready for your Supabase project. Add your public project URL and publishable key to .env.local, then run supabase/schema.sql in the Supabase SQL Editor."
          : error}
      </p>
      {setup ? (
        <div className="setup-steps">
          <span>1. Install the SQL schema</span>
          <span>2. Set your environment variables</span>
          <span>3. Restart the development server</span>
        </div>
      ) : (
        <Button onClick={() => router.refresh()}>
          <RefreshCw />
          Try again
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Setup instructions are included in README.md. Your data stays in
        Supabase.
      </p>
    </section>
  );
}
