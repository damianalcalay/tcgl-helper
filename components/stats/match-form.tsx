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
import { CARD_BACKS, PrizeAvatar } from "./combat-log-view";
import { X, Loader2 } from "lucide-react";
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
  const [cardBack, setCardBack] = useState(match?.card_back ?? "classic");
  const [opponentBack, setOpponentBack] = useState(
    match?.opponent_card_back ?? "classic",
  );
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
      !result ||
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
          result: result as Result,
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
                  <RegexCombobox
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
                  <details>
                    <summary>
                      Opening prize cards · {selectedCount} known /{" "}
                      {6 - selectedCount} unknown
                    </summary>
                    <div className="prize-grid">
                      {prizes.map((value, index) => (
                        <RegexCombobox
                          key={index}
                          label={`Prize ${index + 1}`}
                          placeholder="Unknown prize card"
                          clearable
                          value={value}
                          options={mine.map((c) => ({
                            value: c.id,
                            label: c.name,
                            disabled:
                              prizes.filter((v, i) => i !== index && v === c.id)
                                .length >= c.quantity,
                          }))}
                          onChange={(v) =>
                            setPrizes((ps) =>
                              ps.map((p, i) => (i === index ? v : p)),
                            )
                          }
                        />
                      ))}
                    </div>
                  </details>
                  <details>
                    <summary>Card backs</summary>
                    <div className="form-grid">
                      <RegexCombobox
                        label="Your card back"
                        value={cardBack}
                        options={CARD_BACKS}
                        onChange={setCardBack}
                      />
                      <RegexCombobox
                        label="Opponent card back"
                        value={opponentBack}
                        options={CARD_BACKS}
                        onChange={setOpponentBack}
                      />
                    </div>
                  </details>
                  {!starter && (
                    <p className="field-hint">
                      The starter is missing from your selected deck. Choose the
                      matching deck before saving.
                    </p>
                  )}
                  {!result && (
                    <RegexCombobox
                      label="Result"
                      value={result}
                      options={[
                        { value: "win", label: "Win" },
                        { value: "loss", label: "Loss" },
                        { value: "draw", label: "Draw" },
                      ]}
                      onChange={setResult}
                    />
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
              <div className="form-grid">
                <RegexCombobox
                  label="Result"
                  options={[
                    { value: "win", label: "Win" },
                    { value: "loss", label: "Loss" },
                    { value: "draw", label: "Draw" },
                  ]}
                  value={result}
                  onChange={setResult}
                />
              </div>
              <div className="form-grid">
                <RegexCombobox
                  label="Your prizes taken"
                  options={numberOptions}
                  value={String(myPrizes)}
                  onChange={(v) => setMyPrizes(Number(v))}
                />
                <RegexCombobox
                  label="Opponent prizes taken"
                  options={numberOptions}
                  value={String(theirPrizes)}
                  onChange={(v) => setTheirPrizes(Number(v))}
                />
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
                <div className="prize-grid">
                  {prizes.map((value, index) => (
                    <div key={index} className="prize-slot">
                      <RegexCombobox
                        label={`Prize ${index + 1}`}
                        placeholder="Unknown prize card"
                        disabled={!deckId}
                        value={value}
                        clearable
                        options={mine.map((c) => {
                          const used = prizes.filter(
                            (p, i) => i !== index && p === c.id,
                          ).length;
                          return {
                            value: c.id,
                            label: c.name,
                            description: `${c.quantity - used} of ${c.quantity} copies available`,
                            disabled: used >= c.quantity,
                          };
                        })}
                        onChange={(v) =>
                          setPrizes((ps) =>
                            ps.map((p, i) => (i === index ? v : p)),
                          )
                        }
                      />
                      {value && (
                        <button
                          type="button"
                          aria-label={`Clear prize ${index + 1}`}
                          className="prize-clear"
                          onClick={() =>
                            setPrizes((ps) =>
                              ps.map((p, i) => (i === index ? "" : p)),
                            )
                          }
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
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
