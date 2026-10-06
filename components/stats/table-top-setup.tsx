"use client";
import { useEffect, useState } from "react";
import type { AppData, CardOption, Match } from "@/types/domain";
import { deckRoster, matchRoster } from "@/lib/domain/logic";
import { persistedPrintings } from "@/lib/domain/deck-import";
import { prepareTable, type TableState } from "@/lib/domain/table-top";
import { saveDeck, saveDeckVariant } from "@/app/actions";
import { Modal } from "@/components/shared/modal";
import { ChoiceSelect } from "@/components/shared/choice-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DeckListEditor } from "@/components/decks/deck-list-editor";
import { ReplayImage } from "./combat-log-view";

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
  onReady: (state: TableState) => void;
}) {
  const [owner, setOwner] = useState(players[0]),
    [base, setBase] = useState(board),
    [lists, setLists] = useState<Record<string, CardOption[]>>(() =>
      Object.fromEntries(
        players.map((p, i) => [
          p,
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
    [allocation, setAllocation] = useState<TableState | null>(null),
    [confirmed, setConfirmed] = useState(false);
  function change(rows: CardOption[]) {
    setLists({ ...lists, [owner]: rows });
    setAllocation(null);
    setConfirmed(false);
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
      name: name.trim() || `${owner} deck`,
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
  const result = prepareTable(base, lists),
    total = lists[owner]?.reduce((s, c) => s + c.quantity, 0) ?? 0;
  const unknown = base.cards.filter(
    (c) => !c.name && ["hand", "prizes"].includes(c.zone),
  );
  return (
    <Modal
      title="Prepare Table Top"
      description="Both players need a complete deck. Known replay cards keep their positions."
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
            {p}
          </Button>
        ))}
      </div>
      {!allocation ? (
        <>
          <ChoiceSelect
            label={`Deck for ${owner}`}
            value={ids[owner] ?? ""}
            placeholder="Select a saved deck or import below"
            options={savedDecks.map((d) => ({
              value: d.id,
              label:
                d.name +
                (data.variants.some((v) => v.variant_id === d.id)
                  ? " · variant"
                  : ""),
            }))}
            onChange={(id) => {
              setIds({ ...ids, [owner]: id });
              change(savedLists[id] ?? deckRoster(data, id));
            }}
          />
          <DeckListEditor
            key={owner}
            data={data}
            cards={lists[owner] ?? []}
            onChange={change}
          />
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="Save deck name"
              placeholder="Deck / variant name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={busy || total !== 60}
              onClick={() => persist(false)}
            >
              Save as deck
            </Button>
            <Button
              variant="outline"
              disabled={busy || total !== 60 || !ids[owner]}
              onClick={() => persist(true)}
            >
              Save variant
            </Button>
          </div>
          {players.map((p) => {
            const count = base.cards.filter((c) => c.owner === p).length;
            return count !== 60 ? (
              <div key={p} role="alert">
                <p>
                  {p}: replay has {count} copies. Keep all known cards and
                  reconcile only the unknown deck counter to 60.
                </p>
                <Button
                  variant="outline"
                  disabled={
                    count > 60 &&
                    base.cards.filter(
                      (c) => c.owner === p && !c.name && c.zone === "deck",
                    ).length <
                      count - 60
                  }
                  onClick={() => {
                    const cards = base.cards.map((c) => ({ ...c }));
                    if (count > 60) {
                      let remove = count - 60;
                      for (let i = cards.length - 1; i >= 0 && remove; i--)
                        if (
                          cards[i].owner === p &&
                          !cards[i].name &&
                          cards[i].zone === "deck"
                        ) {
                          cards.splice(i, 1);
                          remove--;
                        }
                    } else
                      for (let i = count; i < 60; i++)
                        cards.push({
                          id: crypto.randomUUID(),
                          owner: p,
                          name: null,
                          zone: "deck",
                          damage: 0,
                        });
                    setBase({ ...base, cards });
                  }}
                >
                  Reconcile {p} deck counter
                </Button>
              </div>
            ) : null;
          })}
          {result.errors.map((e, i) => (
            <p role="alert" key={i}>
              {e}
            </p>
          ))}
          {result.errors.length > 0 &&
            base.cards.some((c) => c.zone === "deck" && c.hypothetical) && (
              <Button
                variant="outline"
                onClick={() =>
                  setBase({
                    ...base,
                    cards: base.cards.map((c) =>
                      c.zone === "deck" && c.hypothetical
                        ? {
                            ...c,
                            name: null,
                            type: undefined,
                            printing: undefined,
                            tera: undefined,
                            tool: undefined,
                          }
                        : c,
                    ),
                  })
                }
              >
                Reallocate hypothetical deck copies from these lists
              </Button>
            )}
          <Button
            disabled={busy || !result.state}
            onClick={() => {
              setAllocation(result.state!);
              setConfirmed(false);
            }}
          >
            Review card allocation
          </Button>
        </>
      ) : (
        <>
          <p>
            Unknown cards below have a hypothetical allocation. Change each hand
            / prize card as needed; copies swap with the deck. The remaining
            deck is an unordered inventory, never the original draw order.
          </p>
          <div className="allocation-grid">
            {unknown.map((original) => {
              const c = allocation.cards.find((a) => a.id === original.id)!;
              const available = allocation.cards.filter(
                (a) => a.owner === c.owner && a.zone === "deck" && !a.parent,
              );
              const names = [
                ...new Set([c.name, ...available.map((a) => a.name)]),
              ].filter((n): n is string => !!n);
              return (
                <div key={c.id}>
                  <small>
                    {c.owner} · {c.zone}
                    {c.slot !== undefined ? ` ${c.slot + 1}` : ""}
                  </small>
                  <ReplayImage
                    name={c.name ?? undefined}
                    src={c.printing?.image_url}
                  />
                  <ChoiceSelect
                    label={`Allocate ${c.owner} ${c.zone} ${c.id}`}
                    hideLabel
                    value={c.name ?? ""}
                    options={names.map((n) => ({ value: n, label: n }))}
                    onChange={(name) => {
                      const copy = available.find((a) => a.name === name);
                      if (!copy) return;
                      const metadata = (a: typeof c) => ({
                        name: a.name,
                        type: a.type,
                        printing: a.printing,
                        tera: a.tera,
                        tool: a.tool,
                      });
                      setAllocation({
                        ...allocation,
                        cards: allocation.cards.map((a) =>
                          a.id === c.id
                            ? { ...a, ...metadata(copy) }
                            : a.id === copy.id
                              ? { ...a, ...metadata(c) }
                              : a,
                        ),
                      });
                      setConfirmed(false);
                    }}
                  />
                </div>
              );
            })}
          </div>
          <label className="flex gap-2 items-center">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(v === true)}
            />
            Use this allocation for the hypothetical scenario
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAllocation(null)}>
              Back to lists
            </Button>
            <Button disabled={!confirmed} onClick={() => onReady(allocation)}>
              Enter Table Top
            </Button>
          </div>
        </>
      )}
      {error && <p role="status">{error}</p>}
    </Modal>
  );
}
