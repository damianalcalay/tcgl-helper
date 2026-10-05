"use client";
import { useState } from "react";
import { saveCard } from "@/app/actions";
import { Card } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardTypeSelector } from "./card-type-selector";
import { ErrorMessage, Modal } from "@/components/shared/modal";
import { useMutation } from "@/components/shared/use-mutation";
export function CardForm({
  card,
  onClose,
}: {
  card?: Card;
  onClose: () => void;
}) {
  const [name, setName] = useState(card?.name ?? "");
  const [type, setType] = useState<string>(card?.type ?? "");
  const mutation = useMutation();
  return (
    <Modal
      title={card ? "Edit card" : "Create a card"}
      description="Add only the card information you want to track."
      busy={mutation.pending}
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !type)
            return mutation.setError("Enter a name and choose a card type.");
          mutation.run(
            () => saveCard({ id: card?.id, name, type: type as Card["type"] }),
            onClose,
          );
        }}
      >
        <label className="field-label">
          Card name
          <Input
            autoFocus
            required
            maxLength={150}
            placeholder="Enter a card name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <CardTypeSelector value={type} onChange={setType} />
        <ErrorMessage error={mutation.error} />
        <div className="form-actions">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={mutation.pending}
          >
            Cancel
          </Button>
          <Button disabled={mutation.pending}>
            {mutation.pending
              ? "Saving…"
              : card
                ? "Save changes"
                : "Create card"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
