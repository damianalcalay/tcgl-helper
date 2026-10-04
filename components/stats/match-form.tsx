"use client";
import { useState } from "react";
import {
  AppData,
  BASIC_TYPES,
  CARD_TYPES,
  Match,
  Result,
} from "@/types/domain";
import { matchRoster } from "@/lib/domain/logic";
import { saveMatch } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Modal, ErrorMessage } from "@/components/shared/modal";
import { RegexCombobox } from "@/components/shared/regex-combobox";
import { useMutation } from "@/components/shared/use-mutation";
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
  initialValues?: { deck_id: string; result: Result; prizes: string[] };
  onSaved?: () => void;
}) {
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
  function submit() {
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
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <fieldset disabled={mutation.pending} className="form-stack">
          <div className="form-grid">
            <RegexCombobox
              label="Your deck"
              options={deckOptions}
              value={deckId}
              onChange={(v) => {
                setDeckId(v);
                setStarter("");
                setPrizes(Array(6).fill(""));
              }}
            />
            <RegexCombobox
              label="Opponent deck"
              options={deckOptions}
              value={opponentId}
              onChange={(v) => {
                setOpponentId(v);
                setTheirStarter("");
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
                    placeholder="Unknown / not recorded"
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
            Match notes
            <textarea
              maxLength={50000}
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
