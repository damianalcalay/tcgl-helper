import type { CardPrinting } from "@/types/domain";
import { CardOption, TCGDEX_TRAINERS } from "@/types/domain";

export function exportDeckList(cards: CardOption[]): string {
  const groups: Record<string, string[]> = {
    Pokémon: [],
    Trainer: [],
    Energy: [],
  };
  for (const card of [...cards].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  )) {
    const printings = resizePrintings(card.printings, card.quantity);
    if (!printings.length || printings.some((p) => p.set_code === "CUSTOM"))
      throw new Error(
        `Missing expansion and card number for ${card.name}. Import its printing before exporting.`,
      );
    const group =
      card.type === "energy" || card.type.startsWith("energy_")
        ? "Energy"
        : card.type === "ace_spec" || card.type in TCGDEX_TRAINERS
          ? "Trainer"
          : "Pokémon";
    for (const printing of printings)
      groups[group].push(
        `${printing.quantity} ${card.name} ${printing.set_code} ${printing.collector_number.replace(/^0+(?=\d)/, "")}`,
      );
  }
  return (
    Object.entries(groups)
      .map(([group, lines]) => `${group}: ${lines.length}\n${lines.join("\n")}`)
      .join("\n\n") +
    `\n\nTotal Cards: ${cards.reduce((sum, c) => sum + c.quantity, 0)}\n`
  );
}
export interface ImportedCard {
  name: string;
  quantity: number;
  category: "pokemon" | "trainer" | "energy";
  printings: CardPrinting[];
}

export function resizePrintings(
  printings: CardPrinting[] | undefined,
  quantity: number,
): CardPrinting[] {
  if (!printings?.length) return [];
  let remaining = quantity;
  const resized = printings.flatMap((p) => {
    const count = Math.min(p.quantity, remaining);
    remaining -= count;
    return count > 0 ? [{ ...p, quantity: count }] : [];
  });
  if (remaining && resized.length) resized[0].quantity += remaining;
  return resized;
}

export function validPrintings(value: unknown, quantity: number): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 60) return false;
  if (!value.length) return true;
  return (
    value.every(
      (p) =>
        p &&
        typeof p === "object" &&
        Number.isInteger(p.quantity) &&
        p.quantity > 0 &&
        p.quantity <= 60 &&
        typeof p.set_code === "string" &&
        /^[A-Z0-9]{2,10}$/.test(p.set_code) &&
        typeof p.collector_number === "string" &&
        /^\d+[a-z]?$/i.test(p.collector_number) &&
        [
          "tcgdex_id",
          "set_id",
          "set_name",
          "series_name",
          "regulation_mark",
          "resolved_type",
          "manual_image_path",
        ].every(
          (field) =>
            p[field] === undefined ||
            (typeof p[field] === "string" && p[field].length <= 150),
        ) &&
        (p.manual_image_path === undefined ||
          (typeof p.manual_image_path === "string" &&
            /^[0-9a-f-]{36}\/cards\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(
              p.manual_image_path,
            ))) &&
        (p.image_url === undefined ||
          (typeof p.image_url === "string" &&
            /^https:\/\/assets\.tcgdex\.net\/en\/[a-zA-Z0-9./_-]+\/high\.webp$/.test(
              p.image_url,
            ))),
    ) && value.reduce((sum, p) => sum + p.quantity, 0) === quantity
  );
}

// Keep library identities by name, while preserving each printing in the deck.
export function parseDeckList(text: string): ImportedCard[] {
  if (text.length > 50000) throw new Error("Deck list is too long.");
  let category: ImportedCard["category"] | undefined;
  const cards = new Map<string, ImportedCard>();
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line) continue;
    const heading =
      /^(Pok[eé]mon|Trainer|Entrenador(?:es)?|Energy|Energ[ií]a(?:s)?)\s*:\s*\d+\s*$/i.exec(
        line,
      );
    if (heading) {
      category = /^pok/i.test(heading[1])
        ? "pokemon"
        : /^(trainer|entrenador)/i.test(heading[1])
          ? "trainer"
          : "energy";
      continue;
    }
    if (/^Total(?: Cards| de cartas)?\s*:\s*\d+$/i.test(line)) continue;
    const match = /^(\d+)\s+(.+?)\s+([A-Z0-9]{2,10})\s+(\d+[a-z]?)$/i.exec(
      line,
    );
    if (!match || !category)
      throw new Error(
        `Invalid card on line ${index + 1}. Use category headings and quantity, name, set and number.`,
      );
    const quantity = Number(match[1]);
    const name = match[2].trim().replace(/\s+/g, " ");
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 60 ||
      name.length > 150
    )
      throw new Error(`Invalid quantity or name on line ${index + 1}.`);
    const key = name.toLocaleLowerCase();
    const existing = cards.get(key);
    if (existing && existing.category !== category)
      throw new Error(`Conflicting categories for ${name}.`);
    cards.set(key, {
      name: existing?.name ?? name,
      quantity: quantity + (existing?.quantity ?? 0),
      category,
      printings: [
        ...(existing?.printings ?? []),
        {
          quantity,
          set_code: match[3].toUpperCase(),
          collector_number: match[4],
        },
      ],
    });
  }
  const result = [...cards.values()];
  if (!result.length) throw new Error("Paste a deck list first.");
  if (result.reduce((sum, card) => sum + card.quantity, 0) > 60)
    throw new Error("A deck cannot contain more than 60 cards.");
  if (
    result.some((card) => card.quantity > (card.category === "energy" ? 60 : 4))
  )
    throw new Error("Use at most four copies per non-Energy card.");
  return result;
}
