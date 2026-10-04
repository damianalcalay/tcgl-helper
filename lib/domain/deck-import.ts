export interface ImportedCard {
  name: string;
  quantity: number;
  category: "pokemon" | "trainer" | "energy";
}

// Expansion and collector number identify a printing; the library tracks card names.
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
