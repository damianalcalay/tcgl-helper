import { cardNameKey, CombatEvent, ParsedCombatLog } from "./combat-log";

export interface InPlay {
  id: number;
  name: string;
  energy: string[];
  tools: string[];
  damage: number;
  evolution?: string[];
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
  stadiumOwner?: string;
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
  let replacedStadium: { name: string; owner: string } | undefined;
  let knockedOut: { owner: string; name: string; cards: string[] } | undefined;
  let pendingPrize:
    | { owner: string; slots: number[]; hands: number[]; next: number }
    | undefined;
  let forceSwitch = "";
  for (const event of log.events.slice(0, through + 1)) {
    if (
      replacedStadium &&
      !(
        event.kind === "discard" &&
        event.actor === replacedStadium.owner &&
        cardNameKey(event.card ?? "") === cardNameKey(replacedStadium.name)
      )
    )
      replacedStadium = undefined;
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
    if (event.kind === "other" && /was switched with/.test(event.text)) {
      forceSwitch = event.actor;
    }
    switch (event.kind) {
      case "play":
        removeHand(side, event.card);
        if (event.zone === "active") side.active = make(event.card!);
        else if (event.zone === "bench") side.bench.push(make(event.card!));
        else if (event.zone === "stadium") {
          if (board.stadium && board.stadiumOwner) {
            replacedStadium = {
              name: board.stadium,
              owner: board.stadiumOwner,
            };
            board.sides[board.stadiumOwner].discard.push(board.stadium);
          }
          board.stadium = event.card;
          board.stadiumOwner = event.actor;
        } else {
          board.played = event.card;
          board.playedBy = event.actor;
          side.discard.push(event.card!);
        }
        break;
      case "active": {
        const pokemon = find(side, event.card, "bench");
        if (
          side.active &&
          cardNameKey(side.active.name) === cardNameKey(event.card!) &&
          forceSwitch !== event.actor
        )
          break;
        if (side.active) side.bench.push(side.active);
        side.active = pokemon ?? make(event.card!);
        side.bench = side.bench.filter((c) => c.id !== pokemon?.id);
        forceSwitch = "";
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
        if (pokemon) {
          pokemon.evolution = [...(pokemon.evolution ?? []), pokemon.name];
          pokemon.name = event.card!;
        }
        removeHand(side, event.card);
        break;
      }
      case "attach": {
        const pokemon = find(side, event.target, event.zone);
        if (pokemon)
          (/Energy/i.test(event.card!) ? pokemon.energy : pokemon.tools).push(
            event.card!,
          );
        if (event.source === "discard") {
          const i = side.discard.findIndex(
            (n) => cardNameKey(n) === cardNameKey(event.card!),
          );
          if (i >= 0) side.discard.splice(i, 1);
          else
            board.warnings.push(
              "Attachment source is not fully recorded in the log.",
            );
        } else removeHand(side, event.card);
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
          const extras = [
            ...(pokemon.evolution ?? []),
            ...pokemon.energy,
            ...pokemon.tools,
          ];
          side.discard.push(...extras);
          knockedOut = {
            owner: event.actor,
            name: pokemon.name,
            cards: [...extras],
          };
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
        if (
          event.target &&
          knockedOut?.owner === event.actor &&
          cardNameKey(knockedOut.name) === cardNameKey(event.target)
        ) {
          const extra = names.filter((name) => {
            const i = knockedOut!.cards.findIndex(
              (n) => cardNameKey(n) === cardNameKey(name),
            );
            if (i < 0) return true;
            knockedOut!.cards.splice(i, 1);
            return false;
          });
          side.discard.push(...extra);
          break;
        }
        if (
          !event.target &&
          replacedStadium?.owner === event.actor &&
          names.length === 1 &&
          cardNameKey(names[0]) === cardNameKey(replacedStadium.name)
        ) {
          replacedStadium = undefined;
          break;
        }
        if (
          !event.target &&
          board.stadiumOwner === event.actor &&
          names.some((n) => cardNameKey(n) === cardNameKey(board.stadium ?? ""))
        ) {
          board.stadium = undefined;
          board.stadiumOwner = undefined;
        } else if (event.target) {
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
        pendingPrize = { owner: event.actor, slots: [], hands: [], next: 0 };
        for (let i = 0; i < (event.count ?? 1) && side.collected < 6; i++) {
          const chosen = prizeChoices[event.index]?.[i];
          const slot =
            chosen !== undefined &&
            chosen >= 0 &&
            chosen < 6 &&
            !side.collectedSlots[chosen]
              ? chosen
              : side.collectedSlots.indexOf(false);
          side.prizes[slot] = null;
          side.collectedSlots[slot] = true;
          side.collected++;
          pendingPrize.slots.push(slot);
          pendingPrize.hands.push(side.hand.length);
          side.hand.push(null);
        }
        break;
      }
      case "prize-card": {
        if (
          pendingPrize?.owner === event.actor &&
          pendingPrize.next < pendingPrize.slots.length
        ) {
          const i = pendingPrize.next++;
          side.prizes[pendingPrize.slots[i]] = event.card ?? null;
          side.hand[pendingPrize.hands[i]] = event.card ?? null;
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
