"use client";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/app/actions";
export function useMutation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(
    operation: () => Promise<ActionResult>,
    onSuccess?: (result: Extract<ActionResult, { success: true }>) => void,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await operation();
      if (result.success) {
        onSuccess?.(result);
        startTransition(() => router.refresh());
      } else setError(result.error);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return { pending: pending || busy, error, setError, run };
}
