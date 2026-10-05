"use client";
import { useState } from "react";
import { Plus, Trash2, Upload, X, Loader2 } from "lucide-react";
import { AppData, CARD_TYPES, Deck, DeckInput } from "@/types/domain";
import { deckRoster, validateQuantities } from "@/lib/domain/logic";
import {
  parseDeckList,
  resizePrintings,
  ImportedCard,
} from "@/lib/domain/deck-import";
import { PrintingImages } from "@/components/decks/printing-images";
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
  const [draftCards, setDraftCards] = useState<
    { id: string; name: string; type: string }[]
  >([]);
  const library = [...data.cards, ...draftCards];
  const energyIds = library.filter((c) => c.type === "energy").map((c) => c.id);
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
        const card = existing ?? {
          id: crypto.randomUUID(),
          name: entry.name,
          type:
            entry.printings.find((p) => p.resolved_type)?.resolved_type ??
            (entry.category === "energy" ? "energy" : ""),
        };
        if (!data.cards.some((c) => c.id === card.id)) drafts.push(card);
        return {
          card_id: card.id,
          quantity: entry.quantity,
          printings: entry.printings,
        };
      });
      setDraftCards(drafts);
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
  const [file, setFile] = useState<File | null>(null);
  const [draggingImage, setDraggingImage] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);
  const mutation = useMutation();
  const total = cards.reduce((s, c) => s + c.quantity, 0);
  function selectImage(image: File) {
    if (mutation.pending) return;
    if (
      image.size > 20 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(image.type)
    ) {
      mutation.setError("Choose a PNG, JPEG, or WebP image up to 20 MB.");
      return;
    }
    setFile(image);
    setRemoveImage(false);
    mutation.setError("");
  }
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
    if (usedDrafts.some((c) => !c.type))
      return mutation.setError(
        "Choose a type for each new card before saving.",
      );
    const validation = validateQuantities(cards, energyIds);
    if (validation) return mutation.setError(validation);
    await mutation.run(
      async () => {
        let imagePath = removeImage ? null : (deck?.image_path ?? null);
        let uploaded: string | null = null;
        if (file) {
          const client = createClient();
          const { data: auth } = await client.auth.getUser();
          if (!auth.user)
            return {
              success: false,
              error: "Sign in again to upload an image.",
            };
          const extension =
            file.type === "image/png"
              ? "png"
              : file.type === "image/webp"
                ? "webp"
                : "jpg";
          uploaded = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;
          const { error } = await client.storage
            .from("deck-images")
            .upload(uploaded, file, { contentType: file.type, upsert: false });
          if (error) {
            console.error("Image upload failed", error);
            return {
              success: false,
              error:
                "Unable to upload the image. Check the Storage bucket setup and try again.",
            };
          }
          imagePath = uploaded;
        }
        const result = await saveDeck({
          id: deck?.id,
          name,
          playstyle,
          notes,
          image_path: imagePath,
          cards: cards.map((c) => ({
            ...c,
            printings: resizePrintings(c.printings, c.quantity),
          })),
          variants,
          new_cards: usedDrafts.map((c) => ({
            ...c,
            type: c.type as keyof typeof CARD_TYPES,
          })),
        });
        if (!result.success && uploaded)
          await createClient().storage.from("deck-images").remove([uploaded]);
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
                    />
                    <div className="editor-card">
                      <span className="quantity-badge">x{c.quantity}</span>
                      <span className="flex-1">{card?.name}</span>
                      {draftCards.some((d) => d.id === c.card_id) && (
                        <label className="field-label">
                          New card type
                          <select
                            aria-label={"Type for " + card?.name}
                            value={card?.type ?? ""}
                            onChange={(e) =>
                              setDraftCards((ds) =>
                                ds.map((d) =>
                                  d.id === c.card_id
                                    ? { ...d, type: e.target.value }
                                    : d,
                                ),
                              )
                            }
                          >
                            <option value="">Choose type</option>
                            {Object.entries(CARD_TYPES).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      )}
                      <div className="quantity-controls">
                        <button
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
                        </button>
                        <span>{c.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Add one ${card?.name}`}
                          disabled={
                            c.quantity >= (card?.type === "energy" ? 60 : 4) ||
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
                        </button>
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
                <button
                  type="button"
                  aria-label="Remove variant"
                  onClick={() => setVariants((vs) => vs.filter((x) => x !== v))}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
          <label className="field-label">
            Deck image{" "}
            <span className="font-normal text-muted-foreground">
              PNG, JPEG or WebP · up to 20 MB
            </span>
            <div
              className={`upload-zone ${draggingImage ? "upload-zone-active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (!mutation.pending) setDraggingImage(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                  setDraggingImage(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDraggingImage(false);
                if (e.dataTransfer.files.length !== 1) {
                  mutation.setError("Drop one deck image at a time.");
                  return;
                }
                selectImage(e.dataTransfer.files[0]);
              }}
            >
              <Upload size={22} />
              <span>Drag and drop an image here, or choose a file.</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  selectImage(f);
                  e.target.value = "";
                }}
              />
              <span>
                {file?.name ??
                  (deck?.image_path && !removeImage
                    ? "Existing image will be kept."
                    : "Upload a full-resolution deck screenshot.")}
              </span>
            </div>
          </label>
          {(file || (deck?.image_path && !removeImage)) && (
            <Button
              type="button"
              variant="ghost"
              className="self-start"
              onClick={() => {
                setFile(null);
                setRemoveImage(true);
              }}
            >
              Remove image
            </Button>
          )}
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
