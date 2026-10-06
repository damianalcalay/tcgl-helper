"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AppData, CardOption } from "@/types/domain";
import { saveDeckVariant } from "@/app/actions";
import { deckRoster } from "@/lib/domain/logic";
import { persistedPrintings } from "@/lib/domain/deck-import";
import { Modal } from "@/components/shared/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DeckListEditor } from "./deck-list-editor";
export function DeckVariantForm({
  data,
  baseId,
  onClose,
}: {
  data: AppData;
  baseId: string;
  onClose: () => void;
}) {
  const [cards, setCards] = useState<CardOption[]>(deckRoster(data, baseId)),
    [name, setName] = useState(
      `${data.decks.find((d) => d.id === baseId)?.name} variant`,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <Modal title="Create deck variant" wide onClose={onClose} busy={busy}>
      <Input
        aria-label="Variant name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <DeckListEditor data={data} cards={cards} onChange={setCards} />
      {error && <p role="alert">{error}</p>}
      <Button
        disabled={busy || cards.reduce((s, c) => s + c.quantity, 0) !== 60}
        onClick={async () => {
          setBusy(true);
          const result = await saveDeckVariant(
            {
              name,
              playstyle: "",
              notes: "",
              image_path: null,
              variants: [],
              cards: cards.map((c) => ({
                card_id: c.id,
                quantity: c.quantity,
                printings: persistedPrintings(c.printings),
              })),
              new_cards: cards
                .filter((c) => !data.cards.some((a) => a.id === c.id))
                .map((c) => ({ id: c.id, name: c.name, type: c.type })),
            },
            baseId,
          ).catch(() => ({
            success: false as const,
            error:
              "Could not save this variant. Check your connection and retry.",
          }));
          setBusy(false);
          if (!result.success) setError(result.error);
          else {
            router.refresh();
            onClose();
          }
        }}
      >
        {busy ? "Saving…" : "Save variant"}
      </Button>
    </Modal>
  );
}
