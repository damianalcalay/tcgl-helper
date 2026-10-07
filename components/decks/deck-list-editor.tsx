"use client";
import { useState } from "react";
import { Plus, Minus, Trash2, Undo2, Redo2 } from "lucide-react";
import type {
  AppData,
  CardOption,
  CardPrinting,
  CardType,
} from "@/types/domain";
import { CARD_TYPES } from "@/types/domain";
import { resizePrintings } from "@/lib/domain/deck-import";
import { cardNameKey } from "@/lib/domain/combat-log";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceSelect } from "@/components/shared/choice-select";
import { CardSearch } from "@/components/shared/card-search";
import { ReplayImage } from "@/components/stats/combat-log-view";

export function DeckListEditor({
  data,
  cards,
  onChange: notify,
  grid = false,
  importOnly = false,
  hideImport = false,
  onImported,
}: {
  data: AppData;
  cards: CardOption[];
  onChange: (cards: CardOption[]) => void;
  grid?: boolean;
  importOnly?: boolean;
  hideImport?: boolean;
  onImported?: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [text, setText] = useState("");
  const [history, setHistory] = useState<CardOption[][]>([cards]),
    [cursor, setCursor] = useState(0);
  function onChange(next: CardOption[]) {
    setHistory((h) => [...h.slice(0, cursor + 1), next]);
    setCursor(cursor + 1);
    notify(next);
  }
  function travel(next: number) {
    setCursor(next);
    notify(history[next]);
  }
  function quantity(id: string, n: number) {
    if (n < 0 || n > 60) return;
    onChange(
      cards.flatMap((c) =>
        c.id !== id
          ? [c]
          : n
            ? [
                {
                  ...c,
                  quantity: n,
                  printings: resizePrintings(c.printings, n),
                },
              ]
            : [],
      ),
    );
  }
  async function add(id: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/card-catalog?id=${encodeURIComponent(id)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (!j.type)
        throw new Error("This printing has no supported card type in TCGdex.");
      const existing = cards.find(
        (c) => cardNameKey(c.name) === cardNameKey(j.name),
      );
      if (existing) {
        if (existing.quantity >= 60)
          throw new Error("A card cannot have more than 60 copies.");
        const printings = existing.printings?.length
          ? existing.printings
          : [
              {
                quantity: existing.quantity,
                set_code: "CUSTOM",
                collector_number: "0",
              },
            ];
        const same = printings.find((p) => p.tcgdex_id === id);
        onChange(
          cards.map((c) =>
            c.id !== existing.id
              ? c
              : {
                  ...c,
                  quantity: c.quantity + 1,
                  printings: same
                    ? printings.map((p) =>
                        p === same ? { ...p, quantity: p.quantity + 1 } : p,
                      )
                    : [...printings, j.printing],
                },
          ),
        );
      } else {
        const saved = data.cards.find(
          (c) => cardNameKey(c.name) === cardNameKey(j.name),
        );
        onChange([
          ...cards,
          {
            id: saved?.id ?? crypto.randomUUID(),
            name: j.name,
            type: j.type,
            quantity: 1,
            printings: [j.printing],
          },
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add card.");
    } finally {
      setBusy(false);
    }
  }
  async function importList() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/deck-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      onChange(
        j.cards.map(
          (c: {
            name: string;
            quantity: number;
            category: string;
            printings: CardPrinting[];
          }) => ({
            id:
              data.cards.find(
                (a) => cardNameKey(a.name) === cardNameKey(c.name),
              )?.id ?? crypto.randomUUID(),
            name: c.name,
            quantity: c.quantity,
            type:
              c.printings.find((p) => p.resolved_type)?.resolved_type ??
              (c.category === "energy"
                ? "energy_basic"
                : c.category === "trainer"
                  ? "item"
                  : "basic"),
            printings: c.printings,
          }),
        ),
      );
      onImported?.();
      if (j.warnings?.length) setError(j.warnings.join(" "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="deck-list-editor">
      {!importOnly && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardSearch onSelect={(id) => void add(id)} disabled={busy} />
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="outline"
              aria-label="Undo deck edit"
              disabled={!cursor || busy}
              onClick={() => travel(cursor - 1)}
            >
              <Undo2 />
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="Redo deck edit"
              disabled={cursor >= history.length - 1 || busy}
              onClick={() => travel(cursor + 1)}
            >
              <Redo2 />
            </Button>
          </div>
        </div>
      )}
      {!hideImport &&
        (importOnly ? (
          <>
            <textarea
              aria-label="TCG Live deck list"
              className="deck-import-text"
              rows={26}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button disabled={busy || !text.trim()} onClick={importList}>
              {busy ? "Importing…" : "Import"}
            </Button>
          </>
        ) : (
          <details>
            <summary>Import a new TCG list</summary>
            <textarea
              aria-label="TCG Live deck list"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button disabled={busy || !text.trim()} onClick={importList}>
              {busy ? "Importing…" : "Import list"}
            </Button>
          </details>
        ))}
      {error && <p role="alert">{error}</p>}
      {!importOnly && (
        <>
          <strong>
            {cards.reduce((s, c) => s + c.quantity, 0)} / 60 cards
          </strong>
          <div
            className={
              grid ? "deck-edit-rows deck-edit-grid" : "deck-edit-rows"
            }
          >
            {cards.map((c) => (
              <div key={c.id} className="deck-edit-row">
                <div className="deck-edit-art">
                  <ReplayImage
                    name={c.name}
                    src={c.printings?.find((p) => p.image_url)?.image_url}
                  />
                  {grid && <b className="deck-copy-badge">{c.quantity}</b>}
                </div>
                <span>
                  {c.name}
                  <small>
                    {c.printings
                      ?.map((p) => `${p.set_code} ${p.collector_number}`)
                      .join(" · ")}
                  </small>
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={`Remove one ${c.name}`}
                  onClick={() => quantity(c.id, c.quantity - 1)}
                >
                  <Minus />
                </Button>
                <b>{c.quantity}</b>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={`Add one ${c.name}`}
                  disabled={c.quantity >= 60}
                  onClick={() => quantity(c.id, c.quantity + 1)}
                >
                  <Plus />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${c.name}`}
                  onClick={() => quantity(c.id, 0)}
                >
                  <Trash2 />
                </Button>
                {!c.printings?.some((p) => p.resolved_type) && (
                  <ChoiceSelect
                    label={`Type of ${c.name}`}
                    value={c.type}
                    onChange={(type) =>
                      onChange(
                        cards.map((a) =>
                          a.id === c.id ? { ...a, type: type as CardType } : a,
                        ),
                      )
                    }
                    options={Object.entries(CARD_TYPES).map(
                      ([value, label]) => ({
                        value,
                        label,
                      }),
                    )}
                  />
                )}
                {c.printings?.map((p, i) =>
                  ![
                    "item",
                    "tool",
                    "supporter",
                    "stadium",
                    "ace_spec",
                    "energy",
                    "energy_basic",
                    "energy_special",
                  ].includes(c.type) ? (
                    <label key={i} className="tera-confirm">
                      <Checkbox
                        checked={p.tera === true}
                        onCheckedChange={(checked) =>
                          onChange(
                            cards.map((a) =>
                              a.id === c.id
                                ? {
                                    ...a,
                                    printings: a.printings?.map((x, j) =>
                                      j === i
                                        ? { ...x, tera: checked === true }
                                        : x,
                                    ),
                                  }
                                : a,
                            ),
                          )
                        }
                      />
                      Tera · {p.set_code} {p.collector_number}
                    </label>
                  ) : null,
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
