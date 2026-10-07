import type { CardOption } from "@/types/domain";
import { cardNameKey } from "./combat-log";

/** Compare physical copies, independent of printing or list order. */
export function deckChangeRatio(original: CardOption[], current: CardOption[]) {
  const total = original.reduce((sum, card) => sum + card.quantity, 0);
  if (!total) return 1;
  const remaining = new Map(
    original.map((c) => [cardNameKey(c.name), c.quantity]),
  );
  let shared = 0;
  for (const c of current) {
    const key = cardNameKey(c.name),
      same = Math.min(remaining.get(key) ?? 0, c.quantity);
    shared += same;
    remaining.set(key, (remaining.get(key) ?? 0) - same);
  }
  return 1 - shared / total;
}
