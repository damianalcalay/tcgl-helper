"use client";
import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, X, Loader2 } from "lucide-react";
import {
  AppData,
  CARD_TYPES,
  Deck,
  DeckInput,
  unlimitedEnergy,
  type CardType,
} from "@/types/domain";
import { deckRoster, validateQuantities } from "@/lib/domain/logic";
import {
  parseDeckList,
  resizePrintings,
  ImportedCard,
} from "@/lib/domain/deck-import";
import { CardTypeSelector } from "./card-type-selector";
import { PrintingImages } from "@/components/decks/printing-images";
import { DeckListEditor } from "./deck-list-editor";
import { saveDeck } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RegexCombobox } from "@/components/shared/regex-combobox";
import { ErrorMessage, Modal } from "@/components/shared/modal";
import { useMutation } from "@/components/shared/use-mutation";
export function DeckForm({
  data,
  deck,
  onClose,
  onSaved,
}: {
  data: AppData;
  deck?: Deck;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [name, setName] = useState(deck?.name ?? "");
  const [quickList, setQuickList] = useState(false);
  const [playstyle, setPlaystyle] = useState(deck?.playstyle ?? "");
  const [notes, setNotes] = useState(deck?.notes ?? "");
  const [cards, setCards] = useState<DeckInput["cards"]>(
    deck
      ? deckRoster(data, deck.id).map((c) => ({
          card_id: c.id,
          quantity: c.quantity,
          printings: c.printings,
        }))
      : [],
  );
  const [variants, setVariants] = useState<string[]>(
    data.variants
      .filter((v) => v.deck_id === deck?.id)
      .map((v) => v.variant_id),
  );
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const imageFiles = useRef<Record<string, { file: File; preview: string }>>(
    {},
  );
  useEffect(
    () => () => {
      Object.values(imageFiles.current).forEach(({ preview }) =>
        URL.revokeObjectURL(preview),
      );
    },
    [],
  );
  function addCardImage(cardId: string, index: number, image: File) {
    if (
      image.size > 20 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(image.type)
    )
      return mutation.setError(
        "Choose a PNG, JPEG, or WebP image up to 20 MB.",
      );
    const key = `${cardId}:${index}`;
    if (imageFiles.current[key])
      URL.revokeObjectURL(imageFiles.current[key].preview);
    const preview = URL.createObjectURL(image);
    imageFiles.current[key] = { file: image, preview };
    setCards((rows) =>
      rows.map((row) =>
        row.card_id !== cardId
          ? row
          : {
              ...row,
              printings: (row.printings?.length
                ? row.printings
                : [
                    {
                      quantity: row.quantity,
                      set_code: "CUSTOM",
                      collector_number: "0",
                    },
                  ]
              ).map((p, i) => (i === index ? { ...p, image_url: preview } : p)),
            },
      ),
    );
    mutation.setError("");
  }
  const [draftCards, setDraftCards] = useState<
    { id: string; name: string; type: string }[]
  >([]);
  const library = [...data.cards, ...draftCards];
  const energyIds = library
    .filter((c) => unlimitedEnergy(c.type))
    .map((c) => c.id);
  async function importList() {
    setImporting(true);
    setImportWarnings([]);
    try {
      parseDeckList(importText);
      const response = await fetch("/api/deck-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: importText }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Unable to import deck.");
      const parsed: ImportedCard[] = result.cards;
      const drafts: typeof draftCards = [];
      const next = parsed.map((entry) => {
        const existing = library.find(
          (c) =>
            c.name.trim().toLocaleLowerCase() ===
            entry.name.toLocaleLowerCase(),
        );
        const inferredType =
          entry.printings.find((p) => p.resolved_type)?.resolved_type ??
          (entry.category === "energy" ? "energy" : "");
        const card = existing
          ? { ...existing, type: existing.type || inferredType }
          : { id: crypto.randomUUID(), name: entry.name, type: inferredType };
        if (!data.cards.some((c) => c.id === card.id)) drafts.push(card);
        return {
          card_id: card.id,
          quantity: entry.quantity,
          printings: entry.printings.map((p) => {
            const previous = cards
              .find((row) => row.card_id === card.id)
              ?.printings?.find(
                (old) =>
                  old.set_code === p.set_code &&
                  old.collector_number.replace(/^0+(?=\d)/, "") ===
                    p.collector_number.replace(/^0+(?=\d)/, ""),
              );
            return previous?.manual_image_path
              ? {
                  ...p,
                  manual_image_path: previous.manual_image_path,
                  image_url: previous.image_url,
                }
              : p;
          }),
        };
      });
      setDraftCards(drafts);
      Object.values(imageFiles.current).forEach(({ preview }) =>
        URL.revokeObjectURL(preview),
      );
      imageFiles.current = {};
      setCards(next);
      setImportWarnings(result.warnings);
      mutation.setError("");
    } catch (error) {
      mutation.setError(
        error instanceof Error ? error.message : "Unable to import deck list.",
      );
    } finally {
      setImporting(false);
    }
  }
  const [selected, setSelected] = useState("");
  const [quantity, setQuantity] = useState(1);
  const mutation = useMutation();
  const total = cards.reduce((s, c) => s + c.quantity, 0);
  function addCard() {
    if (!selected) return mutation.setError("Select a card first.");
    const existing = cards.find((c) => c.card_id === selected);
    const next = existing
      ? cards.map((c) =>
          c.card_id === selected
            ? { ...c, quantity: c.quantity + quantity }
            : c,
        )
      : [...cards, { card_id: selected, quantity }];
    const error = validateQuantities(next, energyIds);
    if (error) return mutation.setError(error);
    setCards(next);
    setSelected("");
    setQuantity(1);
    mutation.setError("");
  }
  async function submit() {
    if (!name.trim()) return mutation.setError("Enter a deck name.");
    const usedDrafts = draftCards.filter((c) =>
      cards.some((row) => row.card_id === c.id),
    );
    const unresolved = usedDrafts.filter((c) => !c.type);
    if (unresolved.length)
      return mutation.setError(
        `Choose a type for: ${unresolved.map((c) => c.name).join(", ")}. TCGdex could not identify their types. Retry the import or choose these types below.`,
      );
    const validation = validateQuantities(cards, energyIds);
    if (validation) return mutation.setError(validation);
    await mutation.run(
      async () => {
        const uploadedCards: string[] = [];
        const preparedCards = cards.map((row) => ({
          ...row,
          printings: resizePrintings(row.printings, row.quantity).map((p) => ({
            ...p,
            image_url: p.manual_image_path ? undefined : p.image_url,
          })),
        }));
        const client = createClient();
        const { data: auth } = await client.auth.getUser();
        if (!auth.user)
          return { success: false, error: "Sign in again to upload an image." };
        for (const row of preparedCards) {
          for (const [index, printing] of row.printings.entries()) {
            const entry = imageFiles.current[`${row.card_id}:${index}`];
            if (!entry) continue;
            const extension =
              entry.file.type === "image/png"
                ? "png"
                : entry.file.type === "image/webp"
                  ? "webp"
                  : "jpg";
            const path = `${auth.user.id}/cards/${crypto.randomUUID()}.${extension}`;
            const { error } = await client.storage
              .from("deck-images")
              .upload(path, entry.file, {
                contentType: entry.file.type,
                upsert: false,
              });
            if (error) {
              if (uploadedCards.length)
                await client.storage.from("deck-images").remove(uploadedCards);
              return {
                success: false,
                error: "Unable to upload the card image. Try again.",
              };
            }
            uploadedCards.push(path);
            printing.manual_image_path = path;
            printing.image_url = undefined;
          }
        }
        const imagePath = null;
        const result = await saveDeck({
          id: deck?.id,
          name,
          playstyle,
          notes,
          image_path: imagePath,
          cards: preparedCards,
          variants,
          new_cards: usedDrafts.map((c) => ({
            ...c,
            type: c.type as keyof typeof CARD_TYPES,
          })),
        });
        if (!result.success && uploadedCards.length)
          await client.storage.from("deck-images").remove(uploadedCards);
        if (result.success && deck?.image_path && deck.image_path !== imagePath)
          await createClient()
            .storage.from("deck-images")
            .remove([deck.image_path]);
        return result;
      },
      (result) => {
        onSaved(result.id!);
        onClose();
      },
    );
  }
  return (
    <Modal
      wide
      closeOnBackdrop={false}
      title={deck ? "Edit deck" : "Create a deck"}
      description="Build your reference list, add a playstyle, and keep your notes together."
      onClose={onClose}
      busy={mutation.pending || importing}
    >
      {quickList && (
        <Modal
          title="Edit deck card list"
          wide
          onClose={() => setQuickList(false)}
        >
          <DeckListEditor
            data={{
              ...data,
              cards: library
                .filter((c) => c.type)
                .map((c) => ({
                  ...c,
                  type: c.type as CardType,
                  created_at: "",
                  updated_at: "",
                })),
            }}
            cards={cards.flatMap((row) => {
              const c = library.find((c) => c.id === row.card_id);
              return c
                ? [
                    {
                      id: c.id,
                      name: c.name,
                      type: c.type as CardType,
                      quantity: row.quantity,
                      printings: row.printings,
                    },
                  ]
                : [];
            })}
            onChange={(rows) => {
              setDraftCards((current) => [
                ...current.map((c) => {
                  const edited = rows.find((a) => a.id === c.id);
                  return edited
                    ? { id: c.id, name: edited.name, type: edited.type }
                    : c;
                }),
                ...rows
                  .filter((c) => !library.some((a) => a.id === c.id))
                  .map((c) => ({ id: c.id, name: c.name, type: c.type })),
              ]);
              setCards(
                rows.map((c) => ({
                  card_id: c.id,
                  quantity: c.quantity,
                  printings: c.printings,
                })),
              );
            }}
          />
          <Button onClick={() => setQuickList(false)}>Done</Button>
        </Modal>
      )}
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <fieldset
          disabled={mutation.pending || importing}
          className="form-stack"
        >
          <label className="field-label">
            Deck name
            <Input
              autoFocus
              required
              maxLength={150}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name your deck"
            />
          </label>
          <div className="form-section-heading">
            <h3>Deck list</h3>
            <span className={`count-pill ${total === 60 ? "complete" : ""}`}>
              {total} / 60 cards
            </span>
          </div>
          <details className="form-stack">
            <summary>Import deck from text</summary>
            <label className="field-label">
              Paste your Pokémon TCG Live deck list
              <textarea
                rows={8}
                maxLength={50000}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={
                  "Pokémon: 4\n4 Teal Mask Ogerpon ex TWM 25\n\nEnergy: 13\n13 Grass Energy MEE 9"
                }
              />
            </label>
            <p className="text-sm text-muted-foreground">
              Import replaces the current list and fetches English card images,
              expansion names, collector numbers and regulation marks from
              TCGdex. Existing library cards are reused by name. Review card
              types below.
            </p>
            <Button type="button" onClick={importList}>
              {importing ? "Fetching card images…" : "Import deck list"}
            </Button>
            {importWarnings.length > 0 && (
              <div role="status" className="field-hint">
                {importWarnings.map((warning, i) => (
                  <p key={i}>{warning}</p>
                ))}
              </div>
            )}
          </details>
          <div className="add-card-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setQuickList(true)}
            >
              Edit list with Standard catalog
            </Button>
            <RegexCombobox
              label="Card"
              placeholder="Select an existing card"
              options={library
                .filter((c) => c.type)
                .map((c) => ({
                  value: c.id,
                  label: c.name,
                  description: CARD_TYPES[c.type as keyof typeof CARD_TYPES],
                }))}
              value={selected}
              onChange={setSelected}
              disabled={total >= 60}
            />
            <RegexCombobox
              label="Copies to add"
              options={Array.from(
                { length: energyIds.includes(selected) ? 60 : 4 },
                (_, i) => i + 1,
              ).map((n) => ({
                value: String(n),
                label: `${n}`,
              }))}
              value={String(quantity)}
              onChange={(v) => setQuantity(Number(v))}
              disabled={total >= 60}
            />
            <Button
              type="button"
              onClick={addCard}
              disabled={!selected || total >= 60}
            >
              <Plus />
              Add
            </Button>
          </div>
          {!data.cards.length && (
            <p className="text-sm text-muted-foreground">
              Create cards in the Card library before adding them to a deck.
            </p>
          )}
          {total === 60 && (
            <p className="text-sm text-primary">
              Deck complete. Remove or reduce a card to make room.
            </p>
          )}
          <div className="editor-card-list">
            {cards.length ? (
              cards.map((c) => {
                const card = library.find((x) => x.id === c.card_id);
                return (
                  <div key={c.card_id}>
                    <PrintingImages
                      printings={c.printings}
                      name={card?.name ?? "Card"}
                      compact
                      onImageChange={(index, file) =>
                        addCardImage(c.card_id, index, file)
                      }
                    />
                    <div className="editor-card">
                      <span className="quantity-badge">x{c.quantity}</span>
                      <span className="flex-1">{card?.name}</span>
                      {draftCards.some((d) => d.id === c.card_id) && (
                        <CardTypeSelector
                          label={"Type for " + card?.name}
                          value={card?.type ?? ""}
                          onChange={(type) =>
                            setDraftCards((ds) =>
                              ds.map((d) =>
                                d.id === c.card_id ? { ...d, type } : d,
                              ),
                            )
                          }
                        />
                      )}
                      <div className="quantity-controls">
                        <Button
                          variant="ghost"
                          type="button"
                          aria-label={`Remove one ${card?.name}`}
                          onClick={() =>
                            setCards((cs) =>
                              c.quantity === 1
                                ? cs.filter((x) => x.card_id !== c.card_id)
                                : cs.map((x) =>
                                    x.card_id === c.card_id
                                      ? { ...x, quantity: x.quantity - 1 }
                                      : x,
                                  ),
                            )
                          }
                        >
                          −
                        </Button>
                        <span>{c.quantity}</span>
                        <Button
                          variant="ghost"
                          type="button"
                          aria-label={`Add one ${card?.name}`}
                          disabled={
                            c.quantity >=
                              (unlimitedEnergy(card?.type ?? "") ? 60 : 4) ||
                            total >= 60
                          }
                          onClick={() =>
                            setCards((cs) =>
                              cs.map((x) =>
                                x.card_id === c.card_id
                                  ? { ...x, quantity: x.quantity + 1 }
                                  : x,
                              ),
                            )
                          }
                        >
                          +
                        </Button>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        aria-label={`Remove ${card?.name}`}
                        onClick={() =>
                          setCards((cs) =>
                            cs.filter((x) => x.card_id !== c.card_id),
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="inline-empty">
                No cards yet. Add your first card above.
              </div>
            )}
          </div>
          <div className="form-grid">
            <label className="field-label">
              Playstyle
              <textarea
                maxLength={50000}
                rows={5}
                placeholder="How does this deck play?"
                value={playstyle}
                onChange={(e) => setPlaystyle(e.target.value)}
              />
            </label>
            <label className="field-label">
              Notes
              <textarea
                maxLength={50000}
                rows={5}
                placeholder="Combos, reminders, and things to try…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>
          <RegexCombobox
            label="Related variants"
            placeholder="Link another existing deck"
            options={data.decks
              .filter((d) => d.id !== deck?.id && !variants.includes(d.id))
              .map((d) => ({ value: d.id, label: d.name }))}
            value=""
            onChange={(v) => setVariants((vs) => [...vs, v])}
          />
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <span className="variant-chip" key={v}>
                {data.decks.find((d) => d.id === v)?.name}
                <Button
                  variant="ghost"
                  type="button"
                  aria-label="Remove variant"
                  onClick={() => setVariants((vs) => vs.filter((x) => x !== v))}
                >
                  <X size={13} />
                </Button>
              </span>
            ))}
          </div>
          <p className="field-hint">
            Your deck overview is generated automatically from its card images
            and quantities.
          </p>
        </fieldset>
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
            {mutation.pending ? (
              <>
                <Loader2 className="animate-spin" />
                Saving…
              </>
            ) : deck ? (
              "Save changes"
            ) : (
              "Create deck"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
