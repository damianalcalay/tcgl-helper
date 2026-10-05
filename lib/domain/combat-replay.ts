import { cardNameKey, CombatEvent, ParsedCombatLog } from "./combat-log";

export interface InPlay {
  id: number;
  name: string;
  energy: string[];
  tools: string[];
  damage: number;
}
export interface ReplaySide {
  active?: InPlay;
  bench: InPlay[];
  hand: (string | null)[];
  deck: number;
  discard: string[];
  prizes: (string | null)[];
  collected: number;
  collectedSlots: boolean[];
}
export interface ReplayBoard {
  sides: Record<string, ReplaySide>;
  stadium?: string;
  played?: string;
  playedBy?: string;
  warnings: string[];
}
export function replayBoard(
  log: ParsedCombatLog,
  through: number,
  prizeChoices: Record<number, number[]> = {},
): ReplayBoard {
  const board: ReplayBoard = {
    sides: Object.fromEntries(
      log.players.map((p) => [
        p,
        {
          bench: [],
          hand: [],
          deck: 60,
          discard: [],
          prizes: Array(6).fill(null),
          collected: 0,
          collectedSlots: Array(6).fill(false),
        },
      ]),
    ),
    warnings: [],
  };
  const removeHand = (side: ReplaySide, name?: string) => {
    const index = name
      ? side.hand.findIndex((c) => c && cardNameKey(c) === cardNameKey(name))
      : -1;
    if (index >= 0) side.hand.splice(index, 1);
    else {
      const unknown = side.hand.indexOf(null);
      if (unknown >= 0) side.hand.splice(unknown, 1);
    }
  };
  const find = (
    side: ReplaySide,
    name?: string,
    zone?: string,
  ): InPlay | undefined => {
    const candidates = (
      zone === "active"
        ? [side.active]
        : zone === "bench"
          ? side.bench
          : [side.active, ...side.bench]
    ).filter(
      (c): c is InPlay =>
        !!c && cardNameKey(c.name) === cardNameKey(name ?? ""),
    );
    if (
      candidates.length > 1 &&
      !board.warnings.includes(
        "Repeated Pokémon names: the log does not identify every physical copy. Placement is illustrative.",
      )
    )
      board.warnings.push(
        "Repeated Pokémon names: the log does not identify every physical copy. Placement is illustrative.",
      );
    return candidates[0];
  };
  let prizesPlaced = false;
  for (const event of log.events.slice(0, through + 1)) {
    if (event.turn > 0 && !prizesPlaced) {
      for (const side of Object.values(board.sides))
        side.deck = Math.max(0, side.deck - 6);
      prizesPlaced = true;
    }
    const side = board.sides[event.actor];
    if (!event.text.startsWith("-") && event.kind !== "draw")
      board.played = undefined;
    if (!side) continue;
    const make = (name: string): InPlay => ({
      id: event.index,
      name,
      energy: [],
      tools: [],
      damage: 0,
    });
    const cards = event.cards ?? [];
    switch (event.kind) {
      case "play":
        removeHand(side, event.card);
        if (event.zone === "active") side.active = make(event.card!);
        else if (event.zone === "bench") side.bench.push(make(event.card!));
        else if (event.zone === "stadium") board.stadium = event.card;
        else {
          board.played = event.card;
          board.playedBy = event.actor;
          side.discard.push(event.card!);
        }
        break;
      case "active": {
        const pokemon = find(side, event.card, "bench");
        if (
          side.active &&
          cardNameKey(side.active.name) === cardNameKey(event.card!)
        )
          break;
        if (side.active) side.bench.push(side.active);
        side.active = pokemon ?? make(event.card!);
        side.bench = side.bench.filter((c) => c.id !== pokemon?.id);
        break;
      }
      case "retreat":
        if (side.active) {
          side.bench.push(side.active);
          side.active = undefined;
        }
        break;
      case "evolve": {
        const pokemon = find(side, event.target, event.zone);
        if (pokemon) pokemon.name = event.card!;
        removeHand(side, event.card);
        break;
      }
      case "attach": {
        const pokemon = find(side, event.target, event.zone);
        if (pokemon)
          (/Energy/i.test(event.card!) ? pokemon.energy : pokemon.tools).push(
            event.card!,
          );
        removeHand(side, event.card);
        break;
      }
      case "attack": {
        const defender = board.sides[event.targetPlayer ?? ""];
        if (defender) {
          const target = find(defender, event.target);
          if (target) target.damage += event.damage ?? 0;
        }
        break;
      }
      case "knockout": {
        const pokemon = find(side, event.card);
        if (pokemon) {
          side.discard.push(pokemon.name);
          if (side.active?.id === pokemon.id) side.active = undefined;
          side.bench = side.bench.filter((c) => c.id !== pokemon.id);
        }
        break;
      }
      case "draw": {
        const count = event.count ?? 1;
        side.hand.push(
          ...Array.from({ length: count }, (_, i) => cards[i] ?? null),
        );
        side.deck = Math.max(0, side.deck - count);
        break;
      }
      case "discard": {
        const names = cards.length
          ? cards
          : event.card
            ? [event.card]
            : Array(event.count ?? 0).fill("Unknown card");
        if (event.target) {
          const pokemon = find(side, event.target);
          if (pokemon)
            for (const name of names) {
              const energy = pokemon.energy.findIndex(
                (n) => cardNameKey(n) === cardNameKey(name),
              );
              if (energy >= 0) pokemon.energy.splice(energy, 1);
              else {
                const tool = pokemon.tools.indexOf(name);
                if (tool >= 0) pokemon.tools.splice(tool, 1);
              }
            }
        } else for (const name of names) removeHand(side, name);
        side.discard.push(...names);
        break;
      }
      case "shuffle":
        if (event.count) {
          for (let i = 0; i < event.count; i++) removeHand(side, cards[i]);
          side.deck += event.count;
        }
        break;
      case "move": {
        const index = side.discard.findIndex(
          (n) => cardNameKey(n) === cardNameKey(event.card!),
        );
        if (index >= 0) side.discard.splice(index, 1);
        side.hand.push(event.card!);
        break;
      }
      case "prize": {
        for (let i = 0; i < (event.count ?? 1) && side.collected < 6; i++) {
          const name =
            cards[i] && cards[i] !== "Unknown prize card" ? cards[i] : null;
          const chosen = prizeChoices[event.index]?.[i];
          const slot =
            chosen !== undefined &&
            chosen >= 0 &&
            chosen < 6 &&
            !side.collectedSlots[chosen]
              ? chosen
              : side.collectedSlots.indexOf(false);
          side.prizes[slot] = name;
          side.collectedSlots[slot] = true;
          side.collected++;
          side.hand.push(name);
        }
        break;
      }
    }
  }
  return board;
}
export function eventLabel(event: CombatEvent) {
  return event.text.replace(/^-\s*/, "");
}
