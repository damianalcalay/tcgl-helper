"use client";
import { useEffect, useState } from "react";
import { Plus, Minus, Trash2, RefreshCw } from "lucide-react";
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
import { RegexCombobox } from "@/components/shared/regex-combobox";
import { ReplayImage } from "@/components/stats/combat-log-view";

export function DeckListEditor({
  data,
  cards,
  onChange,
}: {
  data: AppData;
  cards: CardOption[];
  onChange: (cards: CardOption[]) => void;
}) {
  const [catalog, setCatalog] = useState<
      { id: string; name: string; localId: string }[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [text, setText] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/card-catalog", { signal: controller.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setCatalog(j.cards);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [retry]);
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
      if (j.warnings?.length) setError(j.warnings.join(" "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="deck-list-editor">
      <div className="flex items-end gap-2">
        <RegexCombobox
          label="Add a Standard card"
          value=""
          options={catalog.map((c) => ({
            value: c.id,
            label: `${c.name} · ${c.id}`,
          }))}
          onChange={(id) => void add(id)}
          disabled={busy}
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Retry Standard catalog"
          onClick={() => setRetry((v) => v + 1)}
        >
          <RefreshCw />
        </Button>
      </div>
      <small>
        TCGdex Standard legality · refreshed daily. Regex search covers the full
        current catalog.
      </small>
      <details>
        <summary>Import a TCG Live list</summary>
        <textarea
          aria-label="TCG Live deck list"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button disabled={busy || !text} onClick={importList}>
          {busy ? "Importing…" : "Import list"}
        </Button>
      </details>
      {error && <p role="alert">{error}</p>}
      <strong>{cards.reduce((s, c) => s + c.quantity, 0)} / 60 cards</strong>
      <div className="deck-edit-rows">
        {cards.map((c) => (
          <div key={c.id} className="deck-edit-row">
            <div className="deck-edit-art">
              <ReplayImage
                name={c.name}
                src={c.printings?.find((p) => p.image_url)?.image_url}
              />
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
                options={Object.entries(CARD_TYPES).map(([value, label]) => ({
                  value,
                  label,
                }))}
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
    </div>
  );
}
