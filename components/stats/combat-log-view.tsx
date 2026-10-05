/* eslint-disable @next/next/no-img-element -- Small cached TCGdex thumbnails and a local card back. */
"use client";
import { useEffect, useMemo, useState } from "react";
import { AppData, CardPrinting, Match } from "@/types/domain";
import { cardNameKey, parseCombatLog } from "@/lib/domain/combat-log";
import { InPlay, replayBoard } from "@/lib/domain/combat-replay";
import { Modal } from "@/components/shared/modal";
import { RegexCombobox } from "@/components/shared/regex-combobox";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

export const CARD_BACKS = [
  { value: "classic", label: "Classic Pokémon" },
  { value: "teal", label: "Classic · Teal sleeve" },
  { value: "ruby", label: "Classic · Ruby sleeve" },
];
export function matchCardImage(
  data: AppData,
  match: Match,
  name: string,
): string | undefined {
  const roster = data.rosters.find(
    (r) =>
      r.match_id === match.id && cardNameKey(r.card_name) === cardNameKey(name),
  );
  const printing = roster?.printings?.[0];
  return printing?.image_url?.replace("/high.webp", "/low.webp");
}
function ReplayImage({
  name,
  src,
  back = "classic",
  hidden = false,
}: {
  name?: string;
  src?: string;
  back?: string;
  hidden?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (hidden || !name)
    return (
      <img
        className={`replay-card-image card-back-${back}`}
        src="/card-back-classic.jpg"
        alt="Hidden card"
        draggable={false}
      />
    );
  return src && !failed ? (
    <img
      className="replay-card-image"
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      draggable={false}
    />
  ) : (
    <div className="replay-image-placeholder">
      {name}
      <small>Image unavailable</small>
    </div>
  );
}
function energySymbol(name: string) {
  const types = [
    "Grass",
    "Fire",
    "Water",
    "Lightning",
    "Psychic",
    "Fighting",
    "Darkness",
    "Metal",
  ];
  return types.find((t) => name.includes(t)) ?? "Special";
}
function animateFromBoardCenter(node: HTMLDivElement | null) {
  if (!node) return;
  const board = node.closest(".replay-board");
  if (!board) return;
  node.style.animation = "none";
  const target = node.getBoundingClientRect();
  const field = board.getBoundingClientRect();
  node.style.setProperty(
    "--deploy-x",
    `${field.left + field.width / 2 - target.left - target.width / 2}px`,
  );
  node.style.setProperty(
    "--deploy-y",
    `${field.top + field.height / 2 - target.top - target.height / 2}px`,
  );
  node.style.animation = "";
}
export function CombatLogView({
  match,
  data,
  onClose,
}: {
  match: Match;
  data: AppData;
  onClose: () => void;
}) {
  const parsed = useMemo(() => {
    try {
      return parseCombatLog(match.combat_log ?? "");
    } catch {
      return null;
    }
  }, [match.combat_log]);
  const [view, setView] = useState<"timeline" | "replay">("timeline");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState("1");
  const [ownBack, setOwnBack] = useState(match.card_back ?? "classic");
  const [otherBack, setOtherBack] = useState(
    match.opponent_card_back ?? "classic",
  );
  const [reveals, setReveals] = useState<Record<number, number[]>>({});
  const events = parsed?.events ?? [];
  const event = events[step];
  const board = useMemo(
    () => (parsed ? replayBoard(parsed, step, reveals) : null),
    [parsed, step, reveals],
  );
  const before = useMemo(
    () =>
      parsed && event?.kind === "prize"
        ? replayBoard(parsed, step - 1, reveals)
        : null,
    [parsed, step, event, reveals],
  );
  useEffect(() => {
    if (
      !playing ||
      view !== "replay" ||
      !events.length ||
      step >= events.length - 1
    )
      return;
    const timer = window.setInterval(
      () => setStep((s) => Math.min(s + 1, events.length - 1)),
      1000 / Number(speed),
    );
    return () => window.clearInterval(timer);
  }, [playing, speed, view, events.length, step]);
  const own = match.log_player || parsed?.perspective || "";
  const opponent = parsed?.players.find((p) => p !== own) ?? "";
  const image = (name: string) => matchCardImage(data, match, name);
  function pokemon(card: InPlay | undefined, back: string) {
    if (!card) return <div className="replay-empty-slot">Active Spot</div>;
    return (
      <div
        className={`replay-pokemon ${card.id === event?.index || (event?.kind === "evolve" && card.name === event.card) ? "replay-entering" : ""}`}
        ref={
          card.id === event?.index ||
          (event?.kind === "evolve" && card.name === event.card)
            ? animateFromBoardCenter
            : undefined
        }
        key={card.id}
      >
        <ReplayImage
          key={card.name}
          name={card.name}
          src={image(card.name)}
          back={back}
        />
        <span className="replay-card-caption">{card.name}</span>
        {card.damage > 0 && (
          <span className="replay-damage">{card.damage}</span>
        )}
        <div className="replay-attachments">
          {card.energy.map((name, i) => (
            <span
              key={i}
              className={`energy-token energy-${energySymbol(name).toLowerCase()}`}
              title={name}
            >
              {energySymbol(name).slice(0, 1)}
            </span>
          ))}
        </div>
        <div className="replay-tools">
          {card.tools.map((name, i) => (
            <div key={i} title={name}>
              <ReplayImage name={name} src={image(name)} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  function side(player: string, isOpponent: boolean) {
    const state = board?.sides[player];
    if (!state) return null;
    const back = isOpponent ? otherBack : ownBack;
    return (
      <section
        className={`replay-side ${isOpponent ? "replay-opponent" : "replay-own"}`}
        aria-label={`${player} board`}
      >
        <div className="replay-player-label">
          <strong>
            {player}
            {isOpponent ? " · Opponent" : " · You"}
          </strong>
          <span>
            Deck {state.deck} · Hand {state.hand.length} · Discard{" "}
            {state.discard.length} · Prizes {6 - state.collected}
          </span>
        </div>
        <div className="replay-hand">
          {state.hand.slice(0, 12).map((name, i) => (
            <div key={i}>
              <ReplayImage
                name={name ?? undefined}
                src={!isOpponent && name ? image(name) : undefined}
                hidden={isOpponent || !name}
                back={back}
              />
            </div>
          ))}
          {state.hand.length > 12 && <span>+{state.hand.length - 12}</span>}
        </div>
        <div className="replay-bench">
          {state.bench.map((c) => pokemon(c, back))}
          {Array.from(
            { length: Math.max(0, 5 - state.bench.length) },
            (_, i) => (
              <div key={`empty:${i}`} className="replay-empty-slot">
                Bench
              </div>
            ),
          )}
        </div>
        <div className="replay-active-row">
          <div
            className="replay-prize-pile"
            title={`${6 - state.collected} prizes remaining`}
          >
            <ReplayImage back={back} />
            <strong>{6 - state.collected}</strong>
          </div>
          {pokemon(state.active, back)}
          <div className="replay-deck-pile">
            <ReplayImage back={back} />
            <strong>{state.deck}</strong>
          </div>
          <div
            className="replay-discard-pile"
            title={state.discard.slice(-5).join(", ")}
          >
            <ReplayImage
              name={state.discard.at(-1)}
              src={
                state.discard.at(-1) ? image(state.discard.at(-1)!) : undefined
              }
              back={back}
            />
            <strong>{state.discard.length}</strong>
          </div>
        </div>
      </section>
    );
  }
  const availableSlots = Array.from({ length: 6 }, (_, i) => i).filter(
    (i) => !before?.sides[event?.actor]?.collectedSlots[i],
  );
  const picked =
    reveals[step] ??
    (playing && event?.kind === "prize"
      ? availableSlots.slice(0, event.count ?? 1)
      : []);
  return (
    <Modal
      wide
      title="Combat log"
      description={`${match.deck_name} vs ${match.opponent_deck_name}`}
      onClose={onClose}
      closeOnBackdrop={!playing}
    >
      <div className="combat-match-summary">
        <strong>
          {match.result.toUpperCase()} · {match.my_prizes}–
          {match.opponent_prizes} prizes taken
        </strong>
        <span>
          You: {own || "Unknown"} · Opponent: {opponent || "Unknown"}
        </span>
        {parsed?.coin && (
          <span>
            Opening coin: {parsed.coin.chooser} chose {parsed.coin.choice};
            outcome {parsed.coin.outcome ?? "unknown"}. Winner:{" "}
            {parsed.coin.winner ?? "unknown"}.
          </span>
        )}
        {match.notes && <p>{match.notes}</p>}
      </div>
      <div className="combat-view-tabs">
        <Button
          variant={view === "timeline" ? "default" : "outline"}
          onClick={() => {
            setView("timeline");
            setPlaying(false);
          }}
        >
          Turn timeline
        </Button>
        <Button
          disabled={!parsed || !own}
          variant={view === "replay" ? "default" : "outline"}
          onClick={() => setView("replay")}
        >
          Board replay
        </Button>
      </div>
      {!parsed ? (
        <pre className="combat-raw-log">{match.combat_log}</pre>
      ) : view === "timeline" ? (
        <div className="combat-timeline">
          {parsed.events.map((e, i) => (
            <div key={e.index}>
              {(i === 0 || parsed.events[i - 1].turn !== e.turn) && (
                <h3>
                  {e.turn === 0 ? "Setup" : `Turn ${e.turn} · ${e.turnPlayer}`}
                </h3>
              )}
              <article className={`combat-event combat-${e.kind}`}>
                <span className="combat-event-kind">{e.kind}</span>
                <div>
                  <p>{e.text}</p>
                  {e.details.length > 0 && (
                    <ul>
                      {e.details.map((detail, n) => (
                        <li key={n}>{detail.replace(/^•\s*/, "")}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setStep(i);
                    setView("replay");
                  }}
                >
                  Replay
                </Button>
              </article>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="replay-back-options">
            <RegexCombobox
              label="Your card back"
              value={ownBack}
              options={CARD_BACKS}
              onChange={setOwnBack}
            />
            <RegexCombobox
              label="Opponent card back"
              value={otherBack}
              options={CARD_BACKS}
              onChange={setOtherBack}
            />
          </div>
          <div className="replay-board">
            {side(opponent, true)}
            {side(own, false)}
            {board?.stadium && (
              <div className="replay-stadium" title={board.stadium}>
                <ReplayImage name={board.stadium} src={image(board.stadium)} />
                <small>{board.stadium}</small>
              </div>
            )}
            {board?.played && (
              <div
                className={`replay-played ${board.playedBy === opponent ? "replay-played-opponent" : ""}`}
                key={board.played + event?.turn}
                ref={animateFromBoardCenter}
              >
                <ReplayImage name={board.played} src={image(board.played)} />
                <small>{board.played}</small>
              </div>
            )}
            <div className="replay-action-bubble" key={`bubble:${step}`}>
              <strong>
                {event?.turn === 0 ? "Setup" : `Turn ${event?.turn}`}
              </strong>
              <span>{event?.text.replace(/^-\s*/, "")}</span>
              {event?.details.length ? (
                <small>{event.details.join(" · ")}</small>
              ) : null}
            </div>
            {event?.kind === "prize" && (
              <div className="replay-prize-picker">
                <strong>
                  {event.actor} · Choose {event.count} Prize cards
                </strong>
                <p>
                  Positions are illustrative; the log records cards, not prize
                  slots.
                </p>
                <div className="replay-six-prizes">
                  {Array.from({ length: 6 }, (_, slot) => {
                    const wasTaken =
                      before?.sides[event.actor]?.collectedSlots[slot] ?? false;
                    const order = picked.indexOf(slot);
                    const name = wasTaken
                      ? before?.sides[event.actor].prizes[slot]
                      : order >= 0
                        ? event.cards?.[order]
                        : undefined;
                    const hidden = !wasTaken && order < 0;
                    return (
                      <button
                        key={slot}
                        disabled={
                          wasTaken ||
                          order >= 0 ||
                          picked.length >= (event.count ?? 1)
                        }
                        className={
                          wasTaken
                            ? "prize-already-collected"
                            : order >= 0
                              ? "prize-revealed"
                              : ""
                        }
                        onClick={() => {
                          setPlaying(false);
                          setReveals((r) => ({
                            ...r,
                            [step]: [...picked, slot],
                          }));
                        }}
                      >
                        <ReplayImage
                          hidden={hidden || event.actor !== own}
                          name={name ?? undefined}
                          src={name ? image(name) : undefined}
                          back={event.actor === own ? ownBack : otherBack}
                        />
                        <small>
                          {wasTaken
                            ? "Prize collected"
                            : order >= 0
                              ? event.actor === own
                                ? (name ?? "Unknown prize card")
                                : "Unknown prize card"
                              : `Prize ${slot + 1}`}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="replay-controls">
            <Button
              size="icon"
              variant="outline"
              aria-label="Previous action"
              disabled={step === 0}
              onClick={() => {
                setPlaying(false);
                setStep((s) => s - 1);
              }}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              disabled={step === events.length - 1}
              onClick={() => setPlaying(!playing)}
            >
              {playing && step < events.length - 1 ? <Pause /> : <Play />}
              {playing && step < events.length - 1 ? "Pause" : "Play"}
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="Next action"
              disabled={step === events.length - 1}
              onClick={() => {
                setPlaying(false);
                setStep((s) => s + 1);
              }}
            >
              <ChevronRight />
            </Button>
            <label>
              Speed
              <select
                aria-label="Replay speed"
                value={speed}
                onChange={(e) => setSpeed(e.target.value)}
              >
                {["0.5", "1", "1.5", "2", "4"].map((s) => (
                  <option key={s} value={s}>
                    ×{s}
                  </option>
                ))}
              </select>
            </label>
            <span>
              {step + 1} / {events.length}
            </span>
          </div>
          <input
            type="range"
            aria-label="Replay action"
            min={0}
            max={events.length - 1}
            value={step}
            onChange={(e) => {
              setPlaying(false);
              setStep(Number(e.target.value));
            }}
            className="w-full"
          />
          {board?.warnings.map((w) => (
            <p key={w} className="field-hint">
              {w}
            </p>
          ))}
          <p className="field-hint">
            Reconstruction of known information. Hidden opponent cards stay face
            down. Deck counters and placement cannot account for effects the log
            omits. Named copies and card art may be ambiguous.
          </p>
        </>
      )}
    </Modal>
  );
}

export function PrizeAvatar({
  name,
  printing,
}: {
  name: string;
  printing?: CardPrinting;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="prize-avatar" title={name} aria-label={name}>
      {printing?.image_url && !failed ? (
        <img
          alt={name}
          src={printing.image_url.replace("/high.webp", "/low.webp")}
          onError={() => setFailed(true)}
        />
      ) : (
        <span>?</span>
      )}
    </span>
  );
}
