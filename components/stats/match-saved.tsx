"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppData } from "@/types/domain";
import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { CombatLogView } from "./combat-log-view";

export function MatchSaved({
  data,
  id,
  onClose,
  onPlayAgain,
}: {
  data: AppData;
  id: string;
  onClose: () => void;
  onPlayAgain: () => void;
}) {
  const [review, setReview] = useState(false);
  const match = data.matches.find((m) => m.id === id);
  const router = useRouter();
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    if (!match) {
      const timer = setTimeout(() => {
        if (active)
          setError(
            "The saved match could not be loaded. Retry preparing the review.",
          );
      }, 15000);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
    async function prepare() {
      try {
        if (match?.combat_log) {
          const [{ parseCombatLog }, { replayBoard }] = await Promise.all([
            import("@/lib/domain/combat-log"),
            import("@/lib/domain/combat-replay"),
          ]);
          const log = parseCombatLog(match.combat_log);
          if (!log.events.length)
            throw new Error("The saved combat log has no replay actions.");
          replayBoard(log, 0);
        }
        if (active) setReady(true);
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Could not prepare review.",
          );
      }
    }
    void prepare();
    return () => {
      active = false;
    };
  }, [match, retry]);
  if (review && match)
    return <CombatLogView data={data} match={match} onClose={onClose} />;
  return (
    <Modal
      title="Match saved!"
      description={ready ? "Ready for your next battle?" : undefined}
      onClose={onClose}
    >
      {!ready && !error && (
        <p role="status">
          Preparing review
          <span className="preparing-dots" aria-hidden="true">
            ...
          </span>
        </p>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <Button
            variant="outline"
            onClick={() => {
              router.refresh();
              setRetry((r) => r + 1);
            }}
          >
            Retry
          </Button>
        </div>
      )}
      <div className="form-actions">
        <Button disabled={!ready} onClick={onPlayAgain}>
          Play again
        </Button>
        <Button
          variant="outline"
          disabled={!ready || !match?.combat_log}
          onClick={() => setReview(true)}
        >
          Review last match
        </Button>
      </div>
    </Modal>
  );
}
