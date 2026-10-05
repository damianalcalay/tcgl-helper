"use client";
import { useState } from "react";
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
  if (review && match)
    return <CombatLogView data={data} match={match} onClose={onClose} />;
  return (
    <Modal
      title="Match saved!"
      description="Ready for your next battle?"
      onClose={onClose}
    >
      <div className="form-actions">
        <Button onClick={onPlayAgain}>Play again</Button>
        <Button
          variant="outline"
          disabled={!match}
          onClick={() => setReview(true)}
        >
          Review last match
        </Button>
      </div>
    </Modal>
  );
}
