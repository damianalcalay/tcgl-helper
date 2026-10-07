"use client";
import { useEffect, useRef, useState } from "react";
import type { AppData, CardOption, Match } from "@/types/domain";
import { deckRoster, matchRoster } from "@/lib/domain/logic";
import { persistedPrintings } from "@/lib/domain/deck-import";
import {
  prepareHypotheticalTable,
  replaceTableDeck,
  type TableState,
} from "@/lib/domain/table-top";
import { saveDeck, saveDeckVariant } from "@/app/actions";
import { Modal } from "@/components/shared/modal";
import { ChoiceSelect } from "@/components/shared/choice-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deckChangeRatio } from "@/lib/domain/deck-changes";
import { DeckListEditor } from "@/components/decks/deck-list-editor";

export function TableTopSetup({
  data,
  match,
  board,
  players,
  onClose,
  onReady,
}: {
  data: AppData;
  match: Match;
  board: TableState;
  players: string[];
  onClose: () => void;
  onReady: (state: TableState, previous?: TableState) => void;
}) {
  const [base, setBase] = useState(board);
  const [replacement, setReplacement] = useState<{
    id: string;
    rows: CardOption[];
  } | null>(null);
  const [owner, setOwner] = useState(players[0]),
    [lists, setLists] = useState<Record<string, CardOption[]>>(() =>
      Object.fromEntries(
        players.map((p, i) => [
          p,
          board.deckLists?.[p] ??
            matchRoster(
              data,
              match,
              i === 0 ? match.deck_id : (match.opponent_deck_id ?? ""),
              i === 0 ? "mine" : "opponent",
            ),
        ]),
      ),
    ),
    [ids, setIds] = useState<Record<string, string>>(() => ({
      [players[0]]: match.deck_id,
      [players[1]]: match.opponent_deck_id ?? "",
    })),
    [savedDecks, setSavedDecks] = useState(data.decks),
    [savedLists, setSavedLists] = useState<Record<string, CardOption[]>>({}),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editor, setEditor] = useState<"edit" | "import" | null>(null);
  const initialLists = useRef(lists);
  const [changedDeck, setChangedDeck] = useState(false);
  function change(rows: CardOption[]) {
    setLists({ ...lists, [owner]: rows });
    setError("");
  }
  const printingKey = JSON.stringify([
    ...new Set(
      Object.entries(lists).flatMap(([player, rows]) =>
        rows.flatMap((c) =>
          (c.printings ?? []).flatMap((p) =>
            p.tcgdex_id ? [`${player}\t${p.tcgdex_id}`] : [],
          ),
        ),
      ),
    ),
  ]);
  useEffect(() => {
    const controller = new AbortController();
    async function hydrate() {
      for (const entry of JSON.parse(printingKey) as string[]) {
        const [player, id] = entry.split("\t");
        try {
          const response = await fetch(
            `/api/card-catalog?id=${encodeURIComponent(id)}`,
            { signal: controller.signal },
          );
          if (!response.ok) continue;
          const result = await response.json();
          if (controller.signal.aborted) return;
          setLists((current) => ({
            ...current,
            [player]: (current[player] ?? []).map((c) => ({
              ...c,
              printings: c.printings?.map((p) =>
                p.tcgdex_id === id
                  ? {
                      ...result.printing,
                      ...p,
                      tera: p.tera ?? result.printing.tera,
                      tool: p.tool ?? result.printing.tool,
                    }
                  : p,
              ),
            })),
          }));
        } catch {
          if (controller.signal.aborted) return;
        }
      }
    }
    void hydrate();
    return () => controller.abort();
  }, [printingKey]);
  async function persist(variant: boolean) {
    setBusy(true);
    setError("");
    const rows = lists[owner];
    const payload = {
      name: name.trim() || `${owner === players[0] ? "You" : "Opponent"} deck`,
      playstyle: "",
      notes: "",
      image_path: null,
      variants: [],
      cards: rows.map((c) => ({
        card_id: c.id,
        quantity: c.quantity,
        printings: persistedPrintings(c.printings),
      })),
      new_cards: rows
        .filter((c) => !data.cards.some((a) => a.id === c.id))
        .map((c) => ({ id: c.id, name: c.name, type: c.type })),
    };
    const result = await (
      variant ? saveDeckVariant(payload, ids[owner]) : saveDeck(payload)
    ).catch(() => ({
      success: false as const,
      error: "Could not save the deck. Check your connection and retry.",
    }));
    setBusy(false);
    if (!result.success) setError(result.error);
    else {
      setSavedLists((current) => ({ ...current, [result.id!]: rows }));
      setSavedDecks((d) => [
        ...d,
        {
          id: result.id!,
          name: payload.name,
          playstyle: "",
          notes: "",
          image_path: null,
          created_at: "",
          updated_at: "",
        },
      ]);
      setIds({ ...ids, [owner]: result.id! });
      setError("Deck saved. It is now available in Decks.");
    }
  }
  const original = savedLists[ids[owner]] ?? deckRoster(data, ids[owner] ?? "");
  const ratio = deckChangeRatio(original, lists[owner] ?? []);
  const total = (lists[owner] ?? []).reduce((sum, c) => sum + c.quantity, 0);
  const prepared = prepareHypotheticalTable(base, lists);
  return (
    <Modal
      title="Prepare Table Top"
      description="Choose both decks. Exit Table Top anytime to return to your paused replay."
      wide
      onClose={onClose}
      busy={busy}
      className="table-setup-modal"
    >
      <div className="flex gap-2">
        {players.map((p) => (
          <Button
            key={p}
            variant={owner === p ? "default" : "outline"}
            onClick={() => setOwner(p)}
          >
            {p === players[0] ? "You" : "Opponent"}
          </Button>
        ))}
      </div>
      <div className="table-setup-content">
        <ChoiceSelect
          label={owner === players[0] ? "Deck for You" : "Deck for Opponent"}
          value={ids[owner] ?? ""}
          placeholder="Select a deck or import a new list"
          options={savedDecks.map((d) => ({
            value: d.id,
            label:
              d.name +
              (data.variants.some((v) => v.variant_id === d.id)
                ? " · variant"
                : ""),
          }))}
          onChange={(id) => {
            if (id === ids[owner]) return;
            setReplacement({
              id,
              rows: savedLists[id] ?? deckRoster(data, id),
            });
          }}
        />
        <div className="flex gap-3 flex-wrap">
          <Button variant="outline" onClick={() => setEditor("edit")}>
            Edit current deck
          </Button>
          <Button variant="outline" onClick={() => setEditor("import")}>
            Import a new TCG list
          </Button>
        </div>
        <div className="flex gap-4 text-sm">
          {players.map((p, i) => (
            <span key={p}>
              {i === 0 ? "You" : "Opponent"}:{" "}
              {(lists[p] ?? []).reduce((sum, c) => sum + c.quantity, 0)} / 60
            </span>
          ))}
        </div>
        {!prepared.state && (
          <p role="alert" className="table-setup-warning">
            {prepared.errors
              .map((e) =>
                e
                  .replaceAll(players[0], "You")
                  .replaceAll(players[1], "Opponent"),
              )
              .join(" ")}
          </p>
        )}
        <Button
          disabled={busy || !prepared.state}
          onClick={() =>
            onReady(
              prepared.state!,
              changedDeck
                ? (prepareHypotheticalTable(board, initialLists.current)
                    .state ?? { ...board, deckLists: initialLists.current })
                : undefined,
            )
          }
        >
          Enter Table Top
        </Button>
      </div>
      {editor && (
        <Modal
          title={
            editor === "edit"
              ? "Edit deck for Table Top"
              : "Import a new TCG list"
          }
          wide
          busy={busy}
          onClose={() => setEditor(null)}
          className="table-deck-editor-modal"
        >
          <DeckListEditor
            key={owner + editor}
            data={data}
            cards={lists[owner] ?? []}
            onChange={(rows) =>
              editor === "import"
                ? setReplacement({ id: ids[owner], rows })
                : change(rows)
            }
            grid
            hideImport={editor === "edit"}
            importOnly={editor === "import"}
            onImported={() => setEditor(null)}
          />
          {editor === "edit" && (
            <div className="table-deck-save">
              <Input
                aria-label="Save deck name"
                placeholder="Deck / variant name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="flex gap-3 flex-wrap">
                {ratio >= 0.7 || !ids[owner] ? (
                  <Button
                    disabled={busy || total !== 60}
                    onClick={() => persist(false)}
                  >
                    Save as deck
                  </Button>
                ) : (
                  <Button
                    disabled={busy || total !== 60 || !ids[owner]}
                    onClick={() => persist(true)}
                  >
                    Save variant
                  </Button>
                )}
                <Button variant="outline" onClick={() => setEditor(null)}>
                  Done
                </Button>
              </div>
              <small>
                {Math.round(ratio * 100)}% of copies changed · new deck from 70%
              </small>
              {error && <p role="status">{error}</p>}
            </div>
          )}
        </Modal>
      )}
      {replacement && (
        <Modal
          title="Change Table Top deck"
          description="Keep the current cards or clear this player's field for the new deck. The replay stays unchanged."
          onClose={() => setReplacement(null)}
        >
          <div className="flex flex-wrap gap-3 mt-4">
            <Button
              onClick={() => {
                setBase(replaceTableDeck(base, owner, replacement.rows));
                setChangedDeck(true);
                setIds({ ...ids, [owner]: replacement.id });
                change(replacement.rows);
                setReplacement(null);
              }}
            >
              Clear field and use deck
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setChangedDeck(true);
                setIds({ ...ids, [owner]: replacement.id });
                change(replacement.rows);
                setReplacement(null);
              }}
            >
              Keep current field
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            You can undo this change after entering Table Top.
          </p>
        </Modal>
      )}
      {error && <p role="status">{error}</p>}
    </Modal>
  );
}
