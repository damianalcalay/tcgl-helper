"use client";
import { useTransition, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/app/actions";
export function useMutation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);
  async function run(
    operation: () => Promise<ActionResult>,
    onSuccess?: (result: Extract<ActionResult, { success: true }>) => void,
  ) {
    if (running.current) return;
    running.current = true;
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
      running.current = false;
      setBusy(false);
    }
  }
  return { pending: pending || busy, error, setError, run };
}
