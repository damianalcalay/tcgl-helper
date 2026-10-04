"use client";
import { useState } from "react";
import { Plus, Trash2, Upload, X, Loader2 } from "lucide-react";
import { AppData, CARD_TYPES, Deck, DeckInput } from "@/types/domain";
import { deckRoster, validateQuantities } from "@/lib/domain/logic";
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
        }))
      : [],
  );
  const [variants, setVariants] = useState<string[]>(
    data.variants
      .filter((v) => v.deck_id === deck?.id)
      .map((v) => v.variant_id),
  );
  const [selected, setSelected] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
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
    const error = validateQuantities(next);
    if (error) return mutation.setError(error);
    setCards(next);
    setSelected("");
    setQuantity(1);
    mutation.setError("");
  }
  async function submit() {
    if (!name.trim()) return mutation.setError("Enter a deck name.");
    const validation = validateQuantities(cards);
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
          cards,
          variants,
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
      title={deck ? "Edit deck" : "Create a deck"}
      description="Build your reference list, add a playstyle, and keep your notes together."
      onClose={onClose}
      busy={mutation.pending}
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <fieldset disabled={mutation.pending} className="form-stack">
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
          <div className="add-card-row">
            <RegexCombobox
              label="Card"
              placeholder="Select an existing card"
              options={data.cards.map((c) => ({
                value: c.id,
                label: c.name,
                description: CARD_TYPES[c.type],
              }))}
              value={selected}
              onChange={setSelected}
              disabled={total >= 60}
            />
            <RegexCombobox
              label="Copies to add"
              options={[1, 2, 3, 4].map((n) => ({
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
                const card = data.cards.find((x) => x.id === c.card_id);
                return (
                  <div className="editor-card" key={c.card_id}>
                    <span className="quantity-badge">x{c.quantity}</span>
                    <span className="flex-1">{card?.name}</span>
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
                        disabled={c.quantity >= 4 || total >= 60}
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
            <div className="upload-zone">
              <Upload size={22} />
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (
                    f.size > 20 * 1024 * 1024 ||
                    !["image/png", "image/jpeg", "image/webp"].includes(f.type)
                  ) {
                    e.target.value = "";
                    mutation.setError(
                      "Choose a PNG, JPEG, or WebP image up to 20 MB.",
                    );
                    return;
                  }
                  setFile(f);
                  setRemoveImage(false);
                  mutation.setError("");
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
