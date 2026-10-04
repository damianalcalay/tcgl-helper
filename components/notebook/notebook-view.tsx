"use client";
import { useState } from "react";
import {
  RotateCcw,
  Layers3,
  BookOpen,
  FileText,
  GitBranch,
  ArrowUpRight,
  CircleCheck,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppData, CARD_TYPES } from "@/types/domain";
import { deckRoster } from "@/lib/domain/logic";
import { Button } from "@/components/ui/button";
import { RegexCombobox } from "@/components/shared/regex-combobox";
import { ConfirmDialog } from "@/components/shared/modal";
import { PageHeader, EmptyState } from "@/components/shared/page-parts";
import { DeckImageViewer } from "@/components/decks/deck-image-viewer";
type State = 0 | 1 | 2;
const states = ["Available", "Prizes", "Discard pile"] as const;
export function NotebookView({ data }: { data: AppData }) {
  const params = useSearchParams();
  const [deckId, setDeckId] = useState(params.get("deck") ?? "");
  const [copies, setCopies] = useState<Record<string, State>>({});
  const [reset, setReset] = useState(false);
  const deck = data.decks.find((d) => d.id === deckId);
  const roster = deckRoster(data, deckId);
  const total = roster.reduce((s, c) => s + c.quantity, 0);
  const counts = [0, 0, 0];
  roster.forEach((c) => {
    for (let i = 0; i < c.quantity; i++)
      counts[copies[`${deckId}:${c.id}:${i}`] ?? 0]++;
  });
  function choose(id: string) {
    setDeckId(id);
  }
  return (
    <>
      <PageHeader
        eyebrow="YOUR GAME COMPANION"
        title="Notebook"
        description="Keep your game plan close. Track every copy at a glance."
        action={
          <Button
            variant="outline"
            disabled={!deck || !total}
            onClick={() => setReset(true)}
          >
            <RotateCcw />
            Reset game
          </Button>
        }
      />
      <div className="panel notebook-selector">
        <RegexCombobox
          label="Active deck"
          placeholder="Choose a deck for this game"
          options={data.decks.map((d) => ({ value: d.id, label: d.name }))}
          value={deckId}
          onChange={choose}
        />
        <div className="notebook-tip">
          <CircleCheck size={18} />
          <span>
            One click per copy. Everything else stays out of your way.
          </span>
        </div>
      </div>
      {!deck ? (
        <section className="panel">
          <EmptyState
            icon={BookOpen}
            title={
              data.decks.length
                ? "Bring a deck to the table"
                : "A notebook for your next game"
            }
            description={
              data.decks.length
                ? "Select a deck above to see your cards, notes, and game plan."
                : "Create your first deck to start tracking your cards during a game."
            }
          />
          {!data.decks.length && (
            <div className="pb-8 text-center">
              <Button asChild>
                <Link href="/decks">
                  Go to Decks
                  <ArrowUpRight />
                </Link>
              </Button>
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="notebook-overview">
            <div>
              <p className="eyebrow">ACTIVE DECK</p>
              <h2>{deck.name}</h2>
              <span className="text-sm text-muted-foreground">
                {total} / 60 cards · {roster.length} unique cards
              </span>
            </div>
            <div className="state-totals">
              {states.map((s, i) => (
                <div key={s}>
                  <span className={`state-dot state-${i}`} />
                  <strong>{counts[i]}</strong>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="notebook-grid">
            <section className="panel tracker-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    <Layers3 size={19} />
                    Card tracker
                  </h2>
                  <p>Click a copy to cycle its location.</p>
                </div>
                <span className="count-pill">{total} cards</span>
              </div>
              <div className="tracker-legend">
                {states.map((s, i) => (
                  <span key={s}>
                    <span className={`state-dot state-${i}`} />
                    {s}
                  </span>
                ))}
                <span className="ml-auto">
                  Available → Prizes → Discard pile
                </span>
              </div>
              {roster.length ? (
                <div className="tracker-list">
                  {roster.map((c) => (
                    <div className="tracker-row" key={c.id}>
                      <span className="quantity-badge">x{c.quantity}</span>
                      <div className="tracker-card-name">
                        <strong>{c.name}</strong>
                        <small>{CARD_TYPES[c.type]}</small>
                      </div>
                      <div className="copy-controls">
                        {Array.from({ length: c.quantity }, (_, i) => {
                          const key = `${deckId}:${c.id}:${i}`;
                          const state = copies[key] ?? 0;
                          return (
                            <button
                              key={key}
                              className={`copy-button state-${state}`}
                              onClick={() =>
                                setCopies((cs) => ({
                                  ...cs,
                                  [key]: ((state + 1) % 3) as State,
                                }))
                              }
                              title={`${c.name} · Copy ${i + 1}: ${states[state]}. Click for ${states[(state + 1) % 3]}.`}
                              aria-label={`${c.name} copy ${i + 1}: ${states[state]}. Change to ${states[(state + 1) % 3]}.`}
                            >
                              <span>{i + 1}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Layers3}
                  title="This deck needs a card list"
                  description="Add cards in Decks to track each copy here."
                />
              )}
              <div className="panel-footnote">
                Tracking is temporary for this notebook session. Save the result
                in Stats when your game ends.
              </div>
            </section>
            <div className="notebook-reference">
              <section className="panel reference-panel">
                <h3 className="subheading">
                  <BookOpen size={17} />
                  Playstyle
                </h3>
                <p className="prose-text">
                  {deck.playstyle ||
                    "No playstyle added yet. Add your game plan in the deck editor."}
                </p>
              </section>
              <section className="panel reference-panel">
                <h3 className="subheading">
                  <FileText size={17} />
                  Notes
                </h3>
                <p className="prose-text">
                  {deck.notes ||
                    "No notes added yet. Keep key reminders here for your next game."}
                </p>
              </section>
              <section className="panel reference-panel">
                <h3 className="subheading">
                  <GitBranch size={17} />
                  Variants
                </h3>
                <div className="variant-links">
                  {data.variants.filter((v) => v.deck_id === deckId).length ? (
                    data.variants
                      .filter((v) => v.deck_id === deckId)
                      .map((v) => (
                        <button
                          className="variant-chip"
                          onClick={() => choose(v.variant_id)}
                          key={v.variant_id}
                        >
                          {data.decks.find((d) => d.id === v.variant_id)?.name}
                          <ArrowUpRight size={14} />
                        </button>
                      ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No related variants.
                    </p>
                  )}
                </div>
              </section>
              <section className="panel reference-panel">
                <h3 className="subheading">Deck image</h3>
                <DeckImageViewer url={deck.image_url} name={deck.name} />
              </section>
              <Button variant="outline" asChild>
                <Link href={`/decks?deck=${deckId}`}>
                  Edit deck details
                  <ArrowUpRight />
                </Link>
              </Button>
            </div>
          </div>
        </>
      )}
      {reset && (
        <ConfirmDialog
          title="Reset this game?"
          description="All copies in this deck will return to Available. Your current tracking will be cleared."
          label="Reset game"
          onClose={() => setReset(false)}
          onConfirm={() => {
            setCopies((cs) =>
              Object.fromEntries(
                Object.entries(cs).filter(([k]) => !k.startsWith(`${deckId}:`)),
              ),
            );
            setReset(false);
          }}
        />
      )}
    </>
  );
}
