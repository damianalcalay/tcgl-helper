"use client";
import { CardOption, CardType, TCGDEX_TRAINERS } from "@/types/domain";
import { resizePrintings } from "@/lib/domain/deck-import";
import { PrintingImages } from "./printing-images";

export function cardGroup(type: CardType) {
  if (type === "energy" || type.startsWith("energy_")) return "Energy";
  if (type === "ace_spec" || type in TCGDEX_TRAINERS) return "Trainer";
  return "Pokémon";
}
export function sortedRoster(cards: CardOption[]) {
  const groups = ["Pokémon", "Trainer", "Energy"];
  return [...cards].sort(
    (a, b) =>
      groups.indexOf(cardGroup(a.type)) - groups.indexOf(cardGroup(b.type)) ||
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
}
export function DeckMosaic({ cards }: { cards: CardOption[] }) {
  return (
    <div className="deck-mosaic" aria-label="Generated deck overview">
      {sortedRoster(cards).flatMap((c) => {
        const printings = resizePrintings(c.printings, c.quantity);
        return (printings.length ? printings : [undefined]).map((p, i) => (
          <div
            className="deck-mosaic-card"
            key={`${c.id}:${i}`}
            title={`${c.name}: ${p?.quantity ?? c.quantity}`}
          >
            {p ? (
              <PrintingImages name={c.name} printings={[p]} />
            ) : (
              <div className="printing-image-placeholder">
                {c.name}
                <small>Image unavailable</small>
              </div>
            )}
            <span className="mosaic-quantity">{p?.quantity ?? c.quantity}</span>
          </div>
        ));
      })}
    </div>
  );
}
