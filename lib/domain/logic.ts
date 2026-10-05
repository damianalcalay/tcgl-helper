import { AppData, CardOption, Match } from "@/types/domain";
export function deckRoster(data: AppData, id: string): CardOption[] {
  return data.deckCards
    .filter((x) => x.deck_id === id)
    .flatMap((x) => {
      const card = data.cards.find((c) => c.id === x.card_id);
      return card
        ? [{ ...card, quantity: x.quantity, printings: x.printings }]
        : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
export function matchRoster(
  data: AppData,
  match: Match | undefined,
  deckId: string,
  side: "mine" | "opponent",
): CardOption[] {
  if (
    match &&
    deckId === (side === "mine" ? match.deck_id : match.opponent_deck_id)
  ) {
    return data.rosters
      .filter((r) => r.match_id === match.id && r.side === side)
      .map((r) => ({
        id: r.card_id,
        name: r.card_name,
        type: r.card_type,
        quantity: r.quantity,
        printings: r.printings,
      }));
  }
  return deckRoster(data, deckId);
}
export function winRate(matches: Match[]): number {
  return matches.length
    ? (matches.filter((m) => m.result === "win").length / matches.length) * 100
    : 0;
}
export function overallStats(matches: Match[]) {
  let streak = 0,
    bestStreak = 0;
  const counts = new Map<string, { name: string; count: number }>();
  for (const match of [...matches].sort(
    (a, b) =>
      Date.parse(a.played_at) - Date.parse(b.played_at) ||
      Date.parse(a.created_at) - Date.parse(b.created_at) ||
      a.id.localeCompare(b.id),
  )) {
    streak = match.result === "win" ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
    const deck = counts.get(match.deck_id) ?? {
      name: match.deck_name,
      count: 0,
    };
    deck.count++;
    counts.set(match.deck_id, deck);
  }
  return {
    bestStreak,
    mostPlayed: [...counts.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    )[0],
  };
}
export function summarize(matches: Match[]) {
  const sorted = [...matches].sort(
    (a, b) =>
      Date.parse(b.played_at) - Date.parse(a.played_at) ||
      Date.parse(b.created_at) - Date.parse(a.created_at) ||
      b.id.localeCompare(a.id),
  );
  const groups = new Map<string, Match[]>();
  sorted.forEach((m) =>
    groups.set(m.opponent_deck_id, [
      ...(groups.get(m.opponent_deck_id) ?? []),
      m,
    ]),
  );
  const matchups = [...groups].map(([id, games]) => ({
    id,
    name: games[0].opponent_deck_name,
    count: games.length,
    rate: winRate(games),
  }));
  return {
    sorted,
    total: sorted.length,
    wins: sorted.filter((m) => m.result === "win").length,
    losses: sorted.filter((m) => m.result === "loss").length,
    draws: sorted.filter((m) => m.result === "draw").length,
    rate: winRate(sorted),
    recent: winRate(sorted.slice(0, 20)),
    best: [...matchups]
      .sort(
        (a, b) =>
          b.rate - a.rate || b.count - a.count || a.name.localeCompare(b.name),
      )
      .slice(0, 3),
    worst: [...matchups]
      .sort(
        (a, b) =>
          a.rate - b.rate || b.count - a.count || a.name.localeCompare(b.name),
      )
      .slice(0, 3),
  };
}
export function validateQuantities(
  cards: { card_id: string; quantity: number }[],
  energyIds: string[] = [],
): string | null {
  if (new Set(cards.map((c) => c.card_id)).size !== cards.length)
    return "Each card must appear only once.";
  if (
    cards.some(
      (c) =>
        !Number.isInteger(c.quantity) ||
        c.quantity < 1 ||
        c.quantity > (energyIds.includes(c.card_id) ? 60 : 4),
    )
  )
    return "Use 1-4 copies per card (up to 60 for Energy).";
  if (cards.reduce((s, c) => s + c.quantity, 0) > 60)
    return "A deck cannot contain more than 60 cards.";
  return null;
}
