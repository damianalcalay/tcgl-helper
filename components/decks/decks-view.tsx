"use client";
import { PrintingImages } from "@/components/decks/printing-images";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Layers3,
  Plus,
  Pencil,
  Trash2,
  ArrowUpRight,
  Library,
  BookOpen,
  FileText,
  GitBranch,
} from "lucide-react";
import { AppData, Card, Deck, CARD_TYPES } from "@/types/domain";
import { deckRoster } from "@/lib/domain/logic";
import { deleteEntity } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, Metric, EmptyState } from "@/components/shared/page-parts";
import { RegexCombobox } from "@/components/shared/regex-combobox";
import { ConfirmDialog } from "@/components/shared/modal";
import { useMutation } from "@/components/shared/use-mutation";
import { DeckForm } from "./deck-form";
import { CardForm } from "./card-form";
import { DeckMosaic } from "./deck-mosaic";
export function DecksView({ data }: { data: AppData }) {
  const params = useSearchParams();
  const [tab, setTab] = useState<"decks" | "cards">("decks");
  const [selectedId, setSelectedId] = useState(params.get("deck") ?? "");
  const [cardFilter, setCardFilter] = useState("");
  const [deckForm, setDeckForm] = useState<Deck | null | undefined>();
  const [cardForm, setCardForm] = useState<Card | null | undefined>();
  const [deleting, setDeleting] = useState<{
    type: "deck" | "card";
    id: string;
    name: string;
  } | null>(null);
  const mutation = useMutation();
  const selected = data.decks.find((d) => d.id === selectedId);
  const complete = data.decks.filter(
    (d) => deckRoster(data, d.id).reduce((s, c) => s + c.quantity, 0) === 60,
  ).length;
  async function remove() {
    if (!deleting) return;
    const target = deleting;
    const image = data.decks.find((d) => d.id === target.id)?.image_path;
    await mutation.run(
      () => deleteEntity(target.type, target.id),
      () => {
        setDeleting(null);
        if (target.id === selectedId) setSelectedId("");
        if (target.id === cardFilter) setCardFilter("");
        if (image) createClient().storage.from("deck-images").remove([image]);
      },
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="YOUR COLLECTION"
        title="Decks"
        description="A home for your decks. A head start for your next game."
        action={
          <Button
            onClick={() =>
              tab === "decks" ? setDeckForm(null) : setCardForm(null)
            }
          >
            <Plus />
            {tab === "decks" ? "Create deck" : "Create card"}
          </Button>
        }
      />
      <div className="metrics-grid">
        <Metric
          label="Your decks"
          value={data.decks.length}
          detail="Built around the way you play"
          icon={Layers3}
        />
        <Metric
          label="Card library"
          value={data.cards.length}
          detail="Unique cards in your collection"
          icon={Library}
        />
        <Metric
          label="Ready to play"
          value={complete}
          detail="Decks with a complete 60-card list"
          icon={BookOpen}
        />
      </div>
      <div className="section-toolbar">
        <div className="tabs" role="tablist" aria-label="Collection type">
          <button
            role="tab"
            aria-selected={tab === "decks"}
            onClick={() => setTab("decks")}
            className={tab === "decks" ? "selected" : ""}
          >
            <Layers3 size={16} />
            My decks<span>{data.decks.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === "cards"}
            onClick={() => setTab("cards")}
            className={tab === "cards" ? "selected" : ""}
          >
            <Library size={16} />
            Card library<span>{data.cards.length}</span>
          </button>
        </div>
        <div className="toolbar-search">
          <RegexCombobox
            label={tab === "decks" ? "Find a deck" : "Find a card"}
            placeholder={tab === "decks" ? "All decks" : "All cards"}
            value={tab === "decks" ? selectedId : cardFilter}
            clearable
            onChange={tab === "decks" ? setSelectedId : setCardFilter}
            options={(tab === "decks" ? data.decks : data.cards).map((x) => ({
              value: x.id,
              label: x.name,
            }))}
          />
        </div>
      </div>
      {tab === "decks" ? (
        <>
          {!data.decks.length ? (
            <section className="panel">
              <EmptyState
                icon={Layers3}
                title="Your next great deck starts here"
                description="Create a deck, build its card list, and bring your game plan into focus."
                action={() => setDeckForm(null)}
                label="Create your first deck"
              />
            </section>
          ) : (
            <div className="decks-grid">
              {data.decks
                .filter((d) => !selectedId || d.id === selectedId)
                .map((d) => {
                  const roster = deckRoster(data, d.id);
                  const count = roster.reduce((s, c) => s + c.quantity, 0);
                  const variants = data.variants.filter(
                    (v) => v.deck_id === d.id,
                  );
                  return (
                    <article className="panel deck-card" key={d.id}>
                      <div className="deck-card-top">
                        <div className="deck-emblem">
                          <Layers3 size={24} />
                        </div>
                        <div className="ml-auto flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${d.name}`}
                            onClick={() => setDeckForm(d)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${d.name}`}
                            onClick={() => {
                              mutation.setError("");
                              setDeleting({
                                type: "deck",
                                id: d.id,
                                name: d.name,
                              });
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                      <h2>{d.name}</h2>
                      <div className="deck-card-meta">
                        <span
                          className={`count-pill ${count === 60 ? "complete" : ""}`}
                        >
                          {count} / 60 cards
                        </span>
                        <span>
                          {variants.length}{" "}
                          {variants.length === 1 ? "variant" : "variants"}
                        </span>
                      </div>
                      <p className="deck-card-description">
                        {d.playstyle ||
                          "Add your game plan, key combos, and reminders."}
                      </p>
                      <div className="deck-card-preview">
                        {roster.slice(0, 3).map((c) => (
                          <span key={c.id}>
                            x{c.quantity} {c.name}
                          </span>
                        ))}
                        {roster.length > 3 && (
                          <span>+{roster.length - 3} more</span>
                        )}
                        {!roster.length && <span>No cards added yet</span>}
                      </div>
                      <div className="deck-card-bottom">
                        <Button
                          variant="outline"
                          onClick={() => setSelectedId(d.id)}
                        >
                          View deck
                          <ArrowUpRight />
                        </Button>
                        <Link
                          href={`/notebook?deck=${d.id}`}
                          className="text-link"
                        >
                          Open notebook
                          <ArrowUpRight size={14} />
                        </Link>
                      </div>
                    </article>
                  );
                })}
            </div>
          )}
          {selected && (
            <section className="panel deck-detail">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">DECK OVERVIEW</p>
                  <h2>{selected.name}</h2>
                </div>
                <Button variant="outline" onClick={() => setDeckForm(selected)}>
                  <Pencil />
                  Edit deck
                </Button>
              </div>
              <DeckMosaic cards={deckRoster(data, selected.id)} />
              <div className="detail-grid">
                <div>
                  <h3 className="subheading">
                    <Layers3 size={16} />
                    Card list
                    <span className="ml-auto count-pill">
                      {deckRoster(data, selected.id).reduce(
                        (s, c) => s + c.quantity,
                        0,
                      )}{" "}
                      / 60
                    </span>
                  </h3>
                  {deckRoster(data, selected.id).length ? (
                    <div className="deck-roster-grid">
                      {deckRoster(data, selected.id).map((c) => (
                        <div className="list-row" key={c.id}>
                          {c.printings?.length ? (
                            <PrintingImages
                              printings={c.printings}
                              name={c.name}
                            />
                          ) : null}
                          <span className="quantity-badge">x{c.quantity}</span>
                          <span className="flex-1">{c.name}</span>
                          <span className="type-label">
                            {CARD_TYPES[c.type]}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="inline-empty">This deck has no cards yet.</p>
                  )}
                  <h3 className="subheading mt-6">
                    <GitBranch size={16} />
                    Variants
                  </h3>
                  <div className="variant-links">
                    {data.variants.filter((v) => v.deck_id === selected.id)
                      .length ? (
                      data.variants
                        .filter((v) => v.deck_id === selected.id)
                        .map((v) => (
                          <button
                            className="variant-chip"
                            key={v.variant_id}
                            onClick={() => setSelectedId(v.variant_id)}
                          >
                            {
                              data.decks.find((d) => d.id === v.variant_id)
                                ?.name
                            }
                            <ArrowUpRight size={14} />
                          </button>
                        ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No related variants yet.
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="subheading">
                      <BookOpen size={16} />
                      Playstyle
                    </h3>
                    <p className="prose-text">
                      {selected.playstyle || "No playstyle added yet."}
                    </p>
                  </div>
                  <div>
                    <h3 className="subheading">
                      <FileText size={16} />
                      Notes
                    </h3>
                    <p className="prose-text">
                      {selected.notes || "No notes added yet."}
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Updated{" "}
                    {new Date(selected.updated_at).toLocaleDateString("en-GB", {
                      timeZone: "Atlantic/Canary",
                    })}
                  </p>
                </div>
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="panel">
          {!data.cards.length ? (
            <EmptyState
              icon={Library}
              title="Start your card library"
              description="Add cards with their names and types, then use them across your decks."
              action={() => setCardForm(null)}
              label="Create your first card"
            />
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Card name</th>
                    <th>Type</th>
                    <th>Used in decks</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cards
                    .filter((c) => !cardFilter || c.id === cardFilter)
                    .map((c) => (
                      <tr key={c.id}>
                        <td className="font-medium">{c.name}</td>
                        <td>
                          <span className="type-label">
                            {CARD_TYPES[c.type]}
                          </span>
                        </td>
                        <td>
                          {
                            data.deckCards.filter((d) => d.card_id === c.id)
                              .length
                          }
                        </td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${c.name}`}
                              onClick={() => setCardForm(c)}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${c.name}`}
                              onClick={() => {
                                mutation.setError("");
                                setDeleting({
                                  type: "card",
                                  id: c.id,
                                  name: c.name,
                                });
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {deckForm !== undefined && (
        <DeckForm
          data={data}
          deck={deckForm ?? undefined}
          onClose={() => setDeckForm(undefined)}
          onSaved={setSelectedId}
        />
      )}
      {cardForm !== undefined && (
        <CardForm
          card={cardForm ?? undefined}
          onClose={() => setCardForm(undefined)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.type}?`}
          description={
            deleting.type === "deck"
              ? `“${deleting.name}” and all ${data.matches.filter((m) => m.deck_id === deleting.id || m.opponent_deck_id === deleting.id).length} matches involving this deck (including as an opponent), their card records and prizes will be permanently deleted.`
              : `“${deleting.name}” will be permanently deleted. Cards used by a deck or match cannot be deleted until those references are removed.`
          }
          onClose={() => setDeleting(null)}
          onConfirm={remove}
          pending={mutation.pending}
          error={mutation.error}
        />
      )}
    </>
  );
}
