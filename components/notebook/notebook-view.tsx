"use client";
import { CSSProperties, Fragment, useEffect, useState } from "react";
import {
  RotateCcw,
  Layers3,
  BookOpen,
  FileText,
  GitBranch,
  ArrowUpRight,
  CircleCheck,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppData, CARD_TYPES, Result } from "@/types/domain";
import { deckRoster } from "@/lib/domain/logic";
import { Button } from "@/components/ui/button";
import { RegexCombobox } from "@/components/shared/regex-combobox";
import { ConfirmDialog } from "@/components/shared/modal";
import { PageHeader, EmptyState } from "@/components/shared/page-parts";
import { MatchForm } from "@/components/stats/match-form";
import { TrackerSearch } from "./tracker-search";
import { cardGroup, sortedRoster } from "@/components/decks/deck-mosaic";
import {
  PrintingImages,
  PrizeThumbnail,
} from "@/components/decks/printing-images";
import { resizePrintings } from "@/lib/domain/deck-import";
type State = 0 | 1 | 2;
const states = ["Available", "Discard pile", "Prizes"] as const;
export function NotebookView({ data }: { data: AppData }) {
  const [gameMode, setGameMode] = useState(false);
  useEffect(() => {
    if (!gameMode) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGameMode(false);
    };
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", escape);
    };
  }, [gameMode]);
  const params = useSearchParams();
  const [deckId, setDeckId] = useState(params.get("deck") ?? "");
  const [copies, setCopies] = useState<Record<string, State>>({});
  const [reset, setReset] = useState(false);
  const [result, setResult] = useState<Result | "">("");
  const [matchForm, setMatchForm] = useState<{
    deck_id: string;
    result: Result;
    prizes: string[];
  } | null>(null);
  const [matchMessage, setMatchMessage] = useState("");
  const [matchError, setMatchError] = useState("");
  const [visibleIds, setVisibleIds] = useState<string[] | null>(null);
  const deck = data.decks.find((d) => d.id === deckId);
  const roster = sortedRoster(deckRoster(data, deckId));
  const trackerRows = roster.flatMap((c) => {
    const printings = resizePrintings(c.printings, c.quantity);
    if (!printings.length) return [{ ...c, offset: 0 }];
    let offset = 0;
    return printings.map((printing) => {
      const row = {
        ...c,
        quantity: printing.quantity,
        printings: [printing],
        offset,
      };
      offset += printing.quantity;
      return row;
    });
  });
  const prizeCopies = trackerRows.flatMap((c) =>
    Array.from({ length: c.quantity }, (_, i) => ({
      key: `${deckId}:${c.id}:${c.offset + i}`,
      name: c.name,
      copyNumber: c.offset + i + 1,
      printing: c.printings?.[0],
    })).filter((copy) => copies[copy.key] === 2),
  );
  const total = roster.reduce((s, c) => s + c.quantity, 0);
  const counts = [0, 0, 0];
  roster.forEach((c) => {
    for (let i = 0; i < c.quantity; i++)
      counts[copies[`${deckId}:${c.id}:${i}`] ?? 0]++;
  });
  function choose(id: string) {
    setDeckId(id);
    setResult("");
    setMatchMessage("");
    setMatchError("");
    setVisibleIds(null);
  }
  function addMatch() {
    if (!deck || !result) return;
    const prizes = roster.flatMap((c) =>
      Array.from({ length: c.quantity }, (_, i) =>
        copies[`${deckId}:${c.id}:${i}`] === 2 ? c.id : "",
      ).filter(Boolean),
    );
    if (prizes.length > 6) {
      setMatchError(
        "More than six copies are marked as Prizes. Adjust the tracker before adding this match.",
      );
      return;
    }
    setMatchError("");
    setMatchMessage("");
    setMatchForm({ deck_id: deckId, result, prizes });
  }
  return (
    <div
      className={`notebook-workspace ${gameMode ? "notebook-game-mode" : ""}`}
    >
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
          <section className="panel notebook-match-panel">
            <div>
              <h3>Record this game</h3>
              <p className="field-hint">
                Choose your result and add this match directly to Stats.
              </p>
            </div>
            <RegexCombobox
              label="Game result"
              placeholder="Win, Draw, or Loss"
              options={[
                { value: "win", label: "Win" },
                { value: "draw", label: "Draw" },
                { value: "loss", label: "Loss" },
              ]}
              value={result}
              onChange={(value) => {
                setResult(value as Result);
                setMatchError("");
                setMatchMessage("");
              }}
            />
            <Button disabled={!result} onClick={addMatch}>
              <Plus />
              Add Match
            </Button>
            {matchError && (
              <p role="alert" className="error-message notebook-match-feedback">
                {matchError}
              </p>
            )}
            {matchMessage && (
              <p role="status" className="notebook-match-feedback text-primary">
                {matchMessage}{" "}
                <Link href="/stats" className="underline">
                  View Stats
                </Link>
              </p>
            )}
          </section>
          <div className="notebook-grid">
            <div className="game-mode-toolbar">
              <strong>{deck.name}</strong>
              <Button variant="outline" onClick={() => setGameMode(!gameMode)}>
                {gameMode ? "Exit full screen" : "Full screen game mode"}
              </Button>
            </div>
            <section className="panel notebook-prizes" aria-label="Prize cards">
              <div className="panel-heading">
                <div>
                  <h2>Prize cards</h2>
                  <p>Click a card to return that copy to Available.</p>
                </div>
                <span className="count-pill" aria-live="polite">
                  {prizeCopies.length} / 6 prizes
                </span>
              </div>
              {prizeCopies.length ? (
                <div className="prize-card-list">
                  {prizeCopies.map((copy) => (
                    <PrizeThumbnail
                      key={copy.key}
                      name={copy.name}
                      printing={copy.printing}
                      copyNumber={copy.copyNumber}
                      onRemove={() => {
                        setCopies((current) => ({ ...current, [copy.key]: 0 }));
                        setMatchError("");
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p className="inline-empty">No copies marked as Prizes yet.</p>
              )}
            </section>

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
                  Available → Discard pile → Prizes
                </span>
              </div>
              <TrackerSearch
                key={deckId}
                cards={roster}
                onResults={setVisibleIds}
              />
              {roster.length ? (
                <div className="tracker-list">
                  {visibleIds !== null &&
                    !roster.some((c) => visibleIds.includes(c.id)) && (
                      <div className="inline-empty">
                        No cards match your search.
                      </div>
                    )}
                  {trackerRows
                    .filter(
                      (c) => visibleIds === null || visibleIds.includes(c.id),
                    )
                    .map((c, index, rows) => (
                      <Fragment key={`${c.id}:${c.offset}`}>
                        <div
                          className={`tracker-row ${cardGroup(c.type) === "Energy" && c.quantity > 4 ? "tracker-energy" : ""}`}
                          style={
                            cardGroup(c.type) === "Energy" && c.quantity > 4
                              ? ({
                                  gridColumn: `span ${Math.min(4, 1 + Math.ceil((Math.ceil(c.quantity / 6) * 27) / 100))}`,
                                  "--energy-span": Math.min(
                                    4,
                                    1 +
                                      Math.ceil(
                                        (Math.ceil(c.quantity / 6) * 27) / 100,
                                      ),
                                  ),
                                } as CSSProperties)
                              : undefined
                          }
                          key={`${c.id}:${c.offset}`}
                        >
                          {cardGroup(c.type) !== "Energy" &&
                            (index === 0 ||
                              cardGroup(rows[index - 1].type) !==
                                cardGroup(c.type)) && (
                              <h3 className="tracker-group-heading">
                                {cardGroup(c.type)}
                              </h3>
                            )}
                          <div className="tracker-artwork">
                            <PrintingImages
                              printings={c.printings}
                              name={c.name}
                            />
                            <span className="quantity-badge">
                              x{c.quantity}
                            </span>
                          </div>
                          <div className="tracker-card-name">
                            <strong>{c.name}</strong>
                            <small>{CARD_TYPES[c.type]}</small>
                          </div>
                          <div
                            className="copy-controls"
                            style={
                              cardGroup(c.type) === "Energy" && c.quantity > 4
                                ? {
                                    gridTemplateRows: `repeat(${Math.min(6, c.quantity)}, 24px)`,
                                  }
                                : undefined
                            }
                          >
                            {Array.from({ length: c.quantity }, (_, i) => {
                              const copyNumber = c.offset + i;
                              const key = `${deckId}:${c.id}:${copyNumber}`;
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
                                  title={`${c.name} · Copy ${copyNumber + 1}: ${states[state]}. Click for ${states[(state + 1) % 3]}.`}
                                  aria-label={`${c.name} copy ${copyNumber + 1}: ${states[state]}. Change to ${states[(state + 1) % 3]}.`}
                                >
                                  <span>{copyNumber + 1}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </Fragment>
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
                using Add Match above when your game ends.
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
      {matchForm && (
        <MatchForm
          data={data}
          initialValues={matchForm}
          onClose={() => setMatchForm(null)}
          onSaved={() => setMatchMessage("Match saved to your statistics.")}
        />
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
            setResult("");
            setMatchError("");
            setMatchMessage("");
          }}
        />
      )}
    </div>
  );
}
