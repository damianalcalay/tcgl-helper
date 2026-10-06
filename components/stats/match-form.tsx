/* eslint-disable @next/next/no-img-element -- Cached card thumbnails in the prize picker. */
"use client";
import { useState } from "react";
import {
  AppData,
  BASIC_TYPES,
  CARD_TYPES,
  Match,
  Result,
} from "@/types/domain";
import {
  cardNameKey,
  parseCombatLog,
  ParsedCombatLog,
} from "@/lib/domain/combat-log";
import { matchRoster } from "@/lib/domain/logic";
import { saveMatch } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Modal, ErrorMessage } from "@/components/shared/modal";
import { RegexCombobox } from "@/components/shared/regex-combobox";
import { useMutation } from "@/components/shared/use-mutation";
import { ChoiceSelect } from "@/components/shared/choice-select";
import { sortedRoster } from "@/components/decks/deck-mosaic";
import { PrizeAvatar } from "./combat-log-view";
import { Loader2 } from "lucide-react";
export function MatchForm({
  data,
  match,
  onClose,
  initialValues,
  onSaved,
}: {
  data: AppData;
  match?: Match;
  onClose: () => void;
  initialValues?: { deck_id: string; result: Result | ""; prizes: string[] };
  onSaved?: (id: string) => void;
}) {
  const [mode, setMode] = useState<"log" | "manual">(
    match && !match.combat_log ? "manual" : "log",
  );
  const [combatLog, setCombatLog] = useState(match?.combat_log ?? "");
  const [logPlayer, setLogPlayer] = useState(match?.log_player ?? "");
  const [parsed, setParsed] = useState<ParsedCombatLog | null>(() => {
    try {
      return match?.combat_log ? parseCombatLog(match.combat_log) : null;
    } catch {
      return null;
    }
  });
  const [cardBack] = useState(match?.card_back ?? "classic");
  const [opponentBack] = useState(match?.opponent_card_back ?? "classic");
  const [logError, setLogError] = useState("");
  const [deckId, setDeckId] = useState(
    match?.deck_id ?? initialValues?.deck_id ?? "",
  );
  const [opponentId, setOpponentId] = useState(match?.opponent_deck_id ?? "");
  const [result, setResult] = useState<string>(
    match?.result ?? initialValues?.result ?? "",
  );
  const [myPrizes, setMyPrizes] = useState(match?.my_prizes ?? 0);
  const [theirPrizes, setTheirPrizes] = useState(match?.opponent_prizes ?? 0);
  const [starter, setStarter] = useState(match?.starter_id ?? "");
  const [theirStarter, setTheirStarter] = useState(
    match?.opponent_starter_id ?? "",
  );
  const [opponentName, setOpponentName] = useState(
    match?.opponent_deck_name ?? "",
  );
  const [pasteFallback, setPasteFallback] = useState(false);
  const [prizes, setPrizes] = useState<string[]>(() => {
    const initial = match
      ? data.prizes
          .filter((p) => p.match_id === match.id)
          .sort((a, b) => a.slot - b.slot)
          .map((p) => p.card_id)
      : (initialValues?.prizes ?? []);
    return [...initial, ...Array(6 - initial.length).fill("")];
  });
  const mutation = useMutation();
  const mine = matchRoster(data, match, deckId, "mine");
  const theirs = matchRoster(data, match, opponentId, "opponent");
  const basics = mine.filter((c) => BASIC_TYPES.includes(c.type));
  const theirBasics = theirs.filter((c) => BASIC_TYPES.includes(c.type));
  const selectedCount = prizes.filter(Boolean).length;
  const inferredResult =
    mode === "manual"
      ? myPrizes > theirPrizes
        ? "win"
        : myPrizes < theirPrizes
          ? "loss"
          : "draw"
      : result;
  function applyLog(
    log: ParsedCombatLog,
    player: string,
    ownDeck = deckId,
    otherDeck = opponentId,
  ) {
    setLogPlayer(player);
    const opponent = log.players.find((p) => p !== player)!;
    const own = matchRoster(data, match, ownDeck, "mine");
    const other = matchRoster(data, match, otherDeck, "opponent");
    setStarter(
      own.find(
        (c) => cardNameKey(c.name) === cardNameKey(log.starters[player] ?? ""),
      )?.id ?? "",
    );
    setTheirStarter(
      other.find(
        (c) =>
          cardNameKey(c.name) === cardNameKey(log.starters[opponent] ?? ""),
      )?.id ?? "",
    );
    setMyPrizes(Math.min(6, log.prizesTaken[player]));
    setTheirPrizes(Math.min(6, log.prizesTaken[opponent]));
    setResult(log.winner ? (log.winner === player ? "win" : "loss") : "");
    const used: Record<string, number> = {};
    const inferred = (log.prizeCards[player] ?? []).slice(0, 6).map((name) => {
      const card = own.find(
        (c) => name && cardNameKey(c.name) === cardNameKey(name),
      );
      if (!card || (used[card.id] ?? 0) >= card.quantity) return "";
      used[card.id] = (used[card.id] ?? 0) + 1;
      return card.id;
    });
    setPrizes([...inferred, ...Array(6 - inferred.length).fill("")]);
  }
  function importLog(raw: string) {
    setCombatLog(raw);
    setLogError("");
    if (!raw.trim()) {
      setParsed(null);
      return;
    }
    try {
      const log = parseCombatLog(raw);
      setParsed(log);
      const player = log.perspective;
      if (player) applyLog(log, player);
      else setLogPlayer("");
    } catch (error) {
      setParsed(null);
      setLogError(error instanceof Error ? error.message : "Invalid log.");
    }
  }
  function submit() {
    if (mode === "log" && (!parsed || !logPlayer))
      return mutation.setError(
        "Paste a complete combat log and confirm Your player.",
      );
    if (
      !deckId ||
      !inferredResult ||
      !starter ||
      (mode === "manual" && (!opponentId || !theirStarter)) ||
      (mode === "log" && !opponentName.trim())
    )
      return mutation.setError(
        "Select both decks, a result, and a Basic starter for each side.",
      );
    if (
      !basics.some((c) => c.id === starter) ||
      (mode === "manual" && !theirBasics.some((c) => c.id === theirStarter))
    )
      return mutation.setError(
        "Starters must be Basic Pokémon from the selected decks.",
      );
    const selected = prizes.filter(Boolean);
    if (
      selected.some(
        (id) =>
          !mine.some(
            (c) =>
              c.id === id &&
              selected.filter((x) => x === id).length <= c.quantity,
          ),
      )
    )
      return mutation.setError(
        "Prize cards must respect the copies in your deck.",
      );
    mutation.run(
      () =>
        saveMatch({
          id: match?.id,
          deck_id: deckId,
          opponent_deck_id: mode === "log" ? null : opponentId,
          opponent_deck_name: opponentName.trim(),
          result: inferredResult as Result,
          my_prizes: myPrizes,
          opponent_prizes: theirPrizes,
          starter_id: starter,
          opponent_starter_id: mode === "log" ? null : theirStarter,
          played_at: match?.played_at ?? new Date().toISOString(),
          notes: "",
          combat_log: mode === "log" ? combatLog : (match?.combat_log ?? ""),
          log_player: mode === "log" ? logPlayer : (match?.log_player ?? ""),
          card_back: cardBack,
          opponent_card_back: opponentBack,
          prizes: selected,
        }),
      (saved) => {
        if (saved.id && !match) onSaved?.(saved.id);
        onClose();
      },
    );
  }
  const deckOptions = data.decks.map((d) => ({ value: d.id, label: d.name }));
  const numberOptions = Array.from({ length: 7 }, (_, i) => ({
    value: String(i),
    label: String(i),
  }));
  return (
    <Modal
      wide
      title={match ? "Edit match" : "Add a match"}
      description="Save the result and the opening details worth remembering."
      onClose={onClose}
      busy={mutation.pending}
      closeOnBackdrop={mode === "log"}
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <fieldset disabled={mutation.pending} className="form-stack">
          <div className="flex gap-2" aria-label="Match entry mode">
            <Button
              type="button"
              variant={mode === "log" ? "default" : "outline"}
              onClick={async () => {
                setMode("log");
                try {
                  importLog(await navigator.clipboard.readText());
                  setPasteFallback(false);
                } catch {
                  setPasteFallback(true);
                  setLogError(
                    "Clipboard access is unavailable. Paste the exported log below.",
                  );
                }
              }}
            >
              Import combat log
            </Button>
            <Button
              type="button"
              variant={mode === "manual" ? "default" : "outline"}
              onClick={() => setMode("manual")}
            >
              Add manually
            </Button>
          </div>
          {mode === "log" && (
            <div className="form-stack">
              <label className="field-label opponent-title">
                Opponent deck name
                <input
                  aria-label="Opponent deck name"
                  required
                  maxLength={150}
                  placeholder="e.g. Hydrapple ex"
                  value={opponentName}
                  onChange={(e) => setOpponentName(e.target.value)}
                />
                <span className="field-hint">
                  Required: enter the deck your opponent played.
                </span>
              </label>
              {!initialValues && (
                <RegexCombobox
                  label="Your deck"
                  options={deckOptions}
                  value={deckId}
                  onChange={(v) => {
                    setDeckId(v);
                    if (parsed && logPlayer) applyLog(parsed, logPlayer, v);
                  }}
                />
              )}
              {pasteFallback && (
                <label className="field-label">
                  Paste combat log
                  <textarea
                    aria-label="Combat log"
                    rows={3}
                    maxLength={200000}
                    value={combatLog}
                    onChange={(e) => importLog(e.target.value)}
                  />
                </label>
              )}
              <ErrorMessage error={logError} />
              {parsed && (
                <>
                  <ChoiceSelect
                    label="Your player"
                    value={logPlayer}
                    options={parsed.players.map((p) => ({
                      value: p,
                      label: p,
                    }))}
                    onChange={(p) => applyLog(parsed, p)}
                  />
                  <div className="import-match-summary">
                    <strong>
                      {result ? result.toUpperCase() : "Result unknown"} ·{" "}
                      {myPrizes}–{theirPrizes} prizes taken
                    </strong>
                    {[logPlayer, parsed.players.find((p) => p !== logPlayer)]
                      .filter(Boolean)
                      .map((p) => {
                        const totals: Record<string, number> = {};
                        parsed.events
                          .filter(
                            (e) =>
                              e.actor === p && e.kind === "attack" && e.card,
                          )
                          .forEach((e) => {
                            totals[e.card!] =
                              (totals[e.card!] ?? 0) + (e.damage ?? 0);
                          });
                        const mvp = Object.entries(totals).sort(
                          (a, b) => b[1] - a[1],
                        )[0];
                        const portrait = (name: string) => {
                          const card =
                            mine.find(
                              (c) => cardNameKey(c.name) === cardNameKey(name),
                            ) ??
                            data.cards.find(
                              (c) => cardNameKey(c.name) === cardNameKey(name),
                            );
                          const printing =
                            card &&
                            data.deckCards.find((c) => c.card_id === card.id)
                              ?.printings?.[0];
                          return (
                            <PrizeAvatar name={name} printing={printing} />
                          );
                        };
                        return (
                          <div className="import-player-summary" key={p}>
                            <strong>
                              {p === logPlayer ? "You" : "Opponent"}: {p}
                            </strong>
                            <span>
                              {portrait(
                                parsed.starters[p!] ?? "Unknown starter",
                              )}{" "}
                              Starter: {parsed.starters[p!] ?? "Unknown"}
                            </span>
                            <span>
                              {mvp && portrait(mvp[0])} MVP:{" "}
                              {mvp
                                ? mvp[0] + " - " + mvp[1] + " damage"
                                : "No damage recorded"}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                  <div
                    className="prize-avatar-list"
                    aria-label="Inferred opening prize cards"
                  >
                    {prizes.map((id, i) => {
                      const c = mine.find((c) => c.id === id);
                      return (
                        <PrizeAvatar
                          key={i}
                          name={c?.name ?? "Unknown prize card"}
                          printing={c?.printings?.[0]}
                        />
                      );
                    })}
                  </div>
                  {!starter && (
                    <p className="field-hint">
                      The starter is missing from your selected deck. Choose the
                      matching deck before saving.
                    </p>
                  )}
                  {!result && (
                    <p className="field-hint">
                      This log has no final result. Import the complete log or
                      use Add manually.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {mode === "manual" && (
            <>
              <div className="form-grid">
                <RegexCombobox
                  label="Your deck"
                  options={deckOptions}
                  value={deckId}
                  onChange={(v) => {
                    setDeckId(v);
                    setStarter("");
                    setPrizes(Array(6).fill(""));
                    if (parsed && logPlayer) applyLog(parsed, logPlayer, v);
                  }}
                />
                <RegexCombobox
                  label="Opponent deck"
                  options={deckOptions}
                  value={opponentId}
                  onChange={(v) => {
                    setOpponentId(v);
                    setTheirStarter("");
                    if (parsed && logPlayer)
                      applyLog(parsed, logPlayer, deckId, v);
                  }}
                />
              </div>
              {!data.decks.length && (
                <p className="text-sm text-muted-foreground">
                  Create your deck and an opponent deck in Decks first.
                </p>
              )}
              <div className="match-scoreboard" aria-label="Match score">
                <div>
                  <strong>You</strong>
                  <div className="score-options">
                    {numberOptions.map((o) => (
                      <Button
                        type="button"
                        key={o.value}
                        aria-label={`Your prizes: ${o.value}`}
                        aria-pressed={myPrizes === Number(o.value)}
                        variant={
                          myPrizes === Number(o.value) ? "default" : "outline"
                        }
                        onClick={() => setMyPrizes(Number(o.value))}
                      >
                        {o.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <strong className="match-score">
                  {myPrizes}–{theirPrizes}
                  <small>{inferredResult.toUpperCase()}</small>
                </strong>
                <div>
                  <strong>Opponent</strong>
                  <div className="score-options">
                    {numberOptions.map((o) => (
                      <Button
                        type="button"
                        key={o.value}
                        aria-label={`Opponent prizes: ${o.value}`}
                        aria-pressed={theirPrizes === Number(o.value)}
                        variant={
                          theirPrizes === Number(o.value)
                            ? "default"
                            : "outline"
                        }
                        onClick={() => setTheirPrizes(Number(o.value))}
                      >
                        {o.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="form-grid">
                <div>
                  <RegexCombobox
                    label="Your starter Pokémon"
                    disabled={!deckId}
                    options={basics.map((c) => ({
                      value: c.id,
                      label: c.name,
                      description: CARD_TYPES[c.type],
                    }))}
                    value={starter}
                    onChange={setStarter}
                  />
                  {deckId && !basics.length && (
                    <p className="field-hint">
                      This deck has no Basic Pokémon. Add one before recording a
                      match.
                    </p>
                  )}
                </div>
                <div>
                  <RegexCombobox
                    label="Opponent starter Pokémon"
                    disabled={!opponentId}
                    options={theirBasics.map((c) => ({
                      value: c.id,
                      label: c.name,
                      description: CARD_TYPES[c.type],
                    }))}
                    value={theirStarter}
                    onChange={setTheirStarter}
                  />
                  {opponentId && !theirBasics.length && (
                    <p className="field-hint">
                      The opponent deck needs a Basic Pokémon.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <div className="form-section-heading">
                  <h3>Your opening prize cards</h3>
                  <span className="count-pill">
                    {selectedCount} / 6 selected
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Record up to six known prize cards. Unknown slots can be left
                  empty. Each selection uses one actual copy.
                </p>
                <div className="prize-avatar-list">
                  {prizes.map((id, i) => {
                    const c = mine.find((c) => c.id === id);
                    return id ? (
                      <Button
                        type="button"
                        variant="ghost"
                        key={i}
                        title={`Remove ${c?.name}`}
                        aria-label={`Remove prize ${i + 1}: ${c?.name}`}
                        onClick={() =>
                          setPrizes((ps) =>
                            ps.map((p, n) => (n === i ? "" : p)),
                          )
                        }
                      >
                        <span className="manual-prize-avatar">
                          {c?.printings?.[0]?.image_url ? (
                            <img
                              src={c.printings[0].image_url.replace(
                                "/high.webp",
                                "/low.webp",
                              )}
                              alt={c.name}
                            />
                          ) : (
                            "?"
                          )}
                        </span>
                      </Button>
                    ) : (
                      <span
                        key={i}
                        className="prize-avatar"
                        title="Unknown prize card"
                      >
                        ?
                      </span>
                    );
                  })}
                </div>
                <div className="manual-prize-deck">
                  {sortedRoster(mine).map((c) => {
                    const used = prizes.filter((p) => p === c.id).length;
                    return (
                      <Button
                        variant="ghost"
                        type="button"
                        key={c.id}
                        aria-label={`Add prize: ${c.name}`}
                        disabled={selectedCount >= 6 || used >= c.quantity}
                        onClick={() =>
                          setPrizes((ps) => {
                            const i = ps.indexOf("");
                            return ps.map((p, n) => (n === i ? c.id : p));
                          })
                        }
                      >
                        {c.printings?.[0]?.image_url ? (
                          <img
                            src={c.printings[0].image_url.replace(
                              "/high.webp",
                              "/low.webp",
                            )}
                            alt={c.name}
                          />
                        ) : (
                          <div className="printing-image-placeholder">
                            {c.name}
                          </div>
                        )}
                        <span>{c.name}</span>
                        <strong>{c.quantity - used} available</strong>
                      </Button>
                    );
                  })}
                </div>
              </div>
              {match && (
                <p className="field-hint">
                  The original card lists are used when keeping the same decks,
                  so editing this match preserves its history.
                </p>
              )}
            </>
          )}
        </fieldset>
        <ErrorMessage error={mutation.error} />
        <div className="form-actions">
          <Button
            type="button"
            variant="outline"
            disabled={mutation.pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            disabled={
              mutation.pending ||
              !basics.length ||
              (mode === "manual" && !theirBasics.length) ||
              (mode === "log" && !parsed)
            }
          >
            {mutation.pending ? (
              <>
                <Loader2 className="animate-spin" />
                Saving…
              </>
            ) : match ? (
              "Save changes"
            ) : (
              "Save match"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
