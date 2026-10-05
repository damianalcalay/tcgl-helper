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
import { CARD_BACKS } from "./combat-log-view";
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
  onSaved?: () => void;
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
  const [notes, setNotes] = useState(match?.notes ?? "");
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
    if (!otherDeck) {
      const candidates = data.decks.filter((d) =>
        matchRoster(data, undefined, d.id, "opponent").some(
          (c) =>
            cardNameKey(c.name) === cardNameKey(log.starters[opponent] ?? ""),
        ),
      );
      if (candidates.length === 1) {
        otherDeck = candidates[0].id;
        setOpponentId(otherDeck);
      }
    }
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
    if (!deckId || !opponentId || !result || !starter || !theirStarter)
      return mutation.setError(
        "Select both decks, a result, and a Basic starter for each side.",
      );
    if (
      !basics.some((c) => c.id === starter) ||
      !theirBasics.some((c) => c.id === theirStarter)
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
          opponent_deck_id: opponentId,
          result: result as Result,
          my_prizes: myPrizes,
          opponent_prizes: theirPrizes,
          starter_id: starter,
          opponent_starter_id: theirStarter,
          played_at: match?.played_at ?? new Date().toISOString(),
          notes,
          combat_log: mode === "log" ? combatLog : (match?.combat_log ?? ""),
          log_player: mode === "log" ? logPlayer : (match?.log_player ?? ""),
          card_back: cardBack,
          opponent_card_back: opponentBack,
          prizes: selected,
        }),
      () => {
        onSaved?.();
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
              onClick={() => setMode("log")}
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
              <label className="field-label">
                Combat log
                <textarea
                  aria-label="Combat log"
                  rows={7}
                  maxLength={200000}
                  placeholder="Paste the complete English battle log, starting with Setup?"
                  value={combatLog}
                  onChange={(e) => importLog(e.target.value)}
                />
              </label>
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
                  <p className="field-hint">
                    Named prize reveals suggest{" "}
                    {parsed.perspective ?? "no unique player"}. Confirm your
                    identity; you can correct every inferred field below.
                  </p>
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
                  {parsed.coin && (
                    <p className="field-hint">
                      Opening coin: {parsed.coin.chooser} chose{" "}
                      {parsed.coin.choice}.{" "}
                      {parsed.coin.outcome ?? "Unknown outcome"}; winner:{" "}
                      {parsed.coin.winner ?? "Unknown"}. First:{" "}
                      {parsed.coin.first ?? "Unknown"}.
                    </p>
                  )}
                  {parsed.warnings.map((w) => (
                    <p className="field-hint" key={w}>
                      {w}
                    </p>
                  ))}
                </>
              )}
            </div>
          )}
          <div className="form-grid">
            <RegexCombobox
              label="Your deck"
              options={deckOptions}
              value={deckId}
              onChange={(v) => {
                setDeckId(v);
                setStarter("");
                setPrizes(Array(6).fill(""));
                if (parsed && logPlayer && mode === "log")
                  applyLog(parsed, logPlayer, v);
              }}
            />
            <RegexCombobox
              label="Opponent deck"
              options={deckOptions}
              value={opponentId}
              onChange={(v) => {
                setOpponentId(v);
                setTheirStarter("");
                if (parsed && logPlayer && mode === "log")
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
              <span className="count-pill">{selectedCount} / 6 selected</span>
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
                      setPrizes((ps) => ps.map((p, i) => (i === index ? v : p)))
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
          <label className="field-label">
            Match notes ({notes.length}/200)
            <textarea
              maxLength={200}
              rows={3}
              placeholder="What worked? What would you change?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {match && (
            <p className="field-hint">
              The original card lists are used when keeping the same decks, so
              editing this match preserves its history.
            </p>
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
            disabled={mutation.pending || !basics.length || !theirBasics.length}
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
