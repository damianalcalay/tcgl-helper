import type { ReplayBoard } from "./combat-replay";
import { cardNameKey } from "./combat-log";
import { printingTera } from "./card-metadata";
import type { CardOption, CardPrinting, CardType } from "../../types/domain";

export type Zone =
  | "hand"
  | "deck"
  | "discard"
  | "prizes"
  | "active"
  | "bench"
  | "stadium"
  | "played";
export interface TableCard {
  id: string;
  name: string | null;
  owner: string;
  zone: Zone;
  slot?: number;
  parent?: string;
  attachment?: "energy" | "tool" | "evolution";
  damage: number;
  type?: CardType;
  printing?: CardPrinting;
  tera?: boolean;
  tool?: boolean;
  hypothetical?: boolean;
}
export interface Mark {
  id: string;
  tool: string;
  color: string;
  width: number;
  points: { x: number; y: number }[];
}
export interface TableState {
  cards: TableCard[];
  marks: Mark[];
}
export function tableFromReplay(board: ReplayBoard): TableState {
  const cards: TableCard[] = [];
  let sequence = 0;
  const add = (
    owner: string,
    zone: Zone,
    name: string | null,
    extras: Partial<TableCard> = {},
  ) => {
    const card: TableCard = {
      id: `card-${sequence++}`,
      owner,
      zone,
      name,
      damage: 0,
      ...extras,
    };
    cards.push(card);
    return card;
  };
  for (const [owner, side] of Object.entries(board.sides)) {
    side.hand.forEach((n) => add(owner, "hand", n));
    Array.from({ length: side.deck }, () => add(owner, "deck", null));
    side.discard.forEach((n) =>
      add(owner, "discard", n === "Unknown card" ? null : n),
    );
    side.prizes.forEach((n, slot) => {
      if (!side.collectedSlots[slot]) add(owner, "prizes", n, { slot });
    });
    for (const [zone, pokemon] of [
      ["active", side.active ? [side.active] : []],
      ["bench", side.bench],
    ] as const) {
      for (const p of pokemon) {
        const root = add(owner, zone, p.name, {
          damage: p.damage,
          slot: zone === "bench" ? side.bench.indexOf(p) : undefined,
        });
        for (const [attachment, names] of [
          ["energy", p.energy],
          ["tool", p.tools],
          ["evolution", p.evolution ?? []],
        ] as const)
          names.forEach((n) =>
            add(owner, zone, n, { parent: root.id, attachment }),
          );
      }
    }
  }
  if (board.stadium)
    add(
      board.stadiumOwner ?? Object.keys(board.sides)[0],
      "stadium",
      board.stadium,
    );
  // A played trainer is a visual presentation of a card already in discard.
  if (board.played && board.playedBy) {
    const card = [...cards]
      .reverse()
      .find(
        (c) =>
          c.owner === board.playedBy &&
          c.zone === "discard" &&
          c.name === board.played,
      );
    if (card) card.zone = "played";
  }
  return { cards, marks: [] };
}
export function moveTableCard(
  state: TableState,
  id: string,
  owner: string,
  zone: Zone,
  slot?: number,
  parent?: string,
  attachment?: TableCard["attachment"],
): TableState {
  const card = state.cards.find((c) => c.id === id);
  if (!card || card.owner !== owner) return state;
  const cards = state.cards.map((c) => ({ ...c }));
  const moving = cards.find((c) => c.id === id)!;
  if (
    parent &&
    (parent === id ||
      !cards.some(
        (c) =>
          c.id === parent &&
          c.owner === card.owner &&
          !c.parent &&
          isTablePokemon(c),
      ))
  )
    return state;
  if (parent && attachment !== "energy" && attachment !== "tool") return state;
  if (
    parent &&
    ((attachment === "energy" && !isTableEnergy(card)) ||
      (attachment === "tool" && !isTableTool(card)))
  )
    return state;
  if (
    ["active", "bench"].includes(zone) &&
    !parent &&
    card.type &&
    !isTablePokemon({ ...card, zone })
  )
    return state;
  if (zone === "bench" && !parent) {
    const limit = benchCapacity(state, owner);
    slot ??= Array.from({ length: limit }, (_, i) => i).find(
      (i) =>
        !cards.some(
          (c) =>
            c.id !== id &&
            c.owner === owner &&
            c.zone === "bench" &&
            !c.parent &&
            c.slot === i,
        ),
    );
    if (
      slot === undefined ||
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot >= limit
    )
      return state;
  }
  if (zone === "prizes") {
    slot ??= Array.from({ length: 6 }, (_, i) => i).find(
      (i) =>
        !cards.some(
          (c) =>
            c.id !== id && c.owner === owner && c.zone === zone && c.slot === i,
        ),
    );
    if (slot === undefined || !Number.isInteger(slot) || slot < 0 || slot >= 6)
      return state;
  }
  // Occupied active/prize positions swap; a replaced stadium goes to its owner's discard.
  const occupied = !parent
    ? cards.find(
        (c) =>
          c.id !== id &&
          !c.parent &&
          c.zone === zone &&
          (zone === "stadium" ||
            (c.owner === owner &&
              (zone === "active" ||
                (["prizes", "bench"].includes(zone) && c.slot === slot)))),
      )
    : undefined;
  if (occupied) {
    const destination =
      zone === "stadium"
        ? { owner: occupied.owner, zone: "discard" as Zone, slot: undefined }
        : { owner: card.owner, zone: card.zone, slot: card.slot };
    for (const c of cards.filter(
      (c) => c.id === occupied.id || c.parent === occupied.id,
    ))
      Object.assign(c, destination);
  }
  if (parent) {
    const root = cards.find((c) => c.id === parent)!;
    owner = root.owner;
    zone = root.zone;
    slot = undefined;
    if (attachment === "tool") {
      for (const c of cards.filter(
        (c) => c.parent === parent && c.attachment === "tool" && c.id !== id,
      )) {
        Object.assign(c, {
          parent: undefined,
          attachment: undefined,
          zone: card.zone,
          slot: card.slot,
        });
      }
    }
  }
  Object.assign(moving, {
    owner,
    zone,
    slot,
    parent,
    attachment,
    damage: ["active", "bench"].includes(zone) ? moving.damage : 0,
  });
  for (const c of cards.filter((c) => c.parent === id)) {
    Object.assign(c, { owner, zone, slot: undefined });
    if (!["active", "bench"].includes(zone)) {
      c.parent = undefined;
      c.attachment = undefined;
    }
  }
  return { ...state, cards };
}
export function setTableDamage(
  state: TableState,
  id: string,
  damage: number,
): TableState {
  if (
    !Number.isInteger(damage) ||
    damage < 0 ||
    damage > 1000 ||
    damage % 10 !== 0
  )
    return state;
  return {
    ...state,
    cards: state.cards.map((c) =>
      c.id === id && !c.parent && isTablePokemon(c) ? { ...c, damage } : c,
    ),
  };
}
export function isTableEnergy(c: TableCard) {
  return c.type === "energy" || c.type?.startsWith("energy_") === true;
}
export function isTableTool(c: TableCard) {
  return c.tool === true || c.type === "tool" || c.type === "technical_machine";
}
export function isTablePokemon(c: TableCard) {
  return (
    ["active", "bench"].includes(c.zone) &&
    (!c.type ||
      (!isTableEnergy(c) &&
        ![
          "tool",
          "item",
          "supporter",
          "stadium",
          "ace_spec",
          "technical_machine",
          "rocket_secret_machine",
        ].includes(c.type)))
  );
}
export function benchCapacity(state: TableState, owner: string): 5 | 8 {
  return state.cards.some(
    (c) =>
      c.zone === "stadium" &&
      cardNameKey(c.name ?? "") === "area zero underdepths",
  ) &&
    state.cards.some(
      (c) => c.owner === owner && !c.parent && isTablePokemon(c) && c.tera,
    )
    ? 8
    : 5;
}
/** Fill only unknown copies. Known cards and their locations are never rewritten. */
export function prepareTable(
  state: TableState,
  lists: Record<string, CardOption[]>,
): { state?: TableState; errors: string[] } {
  const cards = state.cards.map((c) => ({ ...c }));
  const errors: string[] = [];
  for (const owner of Object.keys(lists)) {
    const list = lists[owner];
    if (
      list.reduce((s, c) => s + c.quantity, 0) !== 60 ||
      list.some(
        (c) =>
          !Number.isInteger(c.quantity) ||
          c.quantity < 1 ||
          (c.quantity > 4 && c.type !== "energy" && c.type !== "energy_basic"),
      ) ||
      new Set(list.map((c) => cardNameKey(c.name))).size !== list.length
    ) {
      errors.push(`${owner}: select a complete 60-card deck.`);
      continue;
    }
    const pool = list.flatMap((c) => {
      const copies: {
        name: string;
        type: CardType;
        printing?: CardPrinting;
        tera?: boolean;
        tool?: boolean;
      }[] = [];
      for (const p of c.printings ?? [])
        for (let i = 0; i < p.quantity; i++)
          copies.push({
            name: c.name,
            type: c.type,
            printing: p,
            tera: printingTera(p),
            tool: p.tool,
          });
      while (copies.length < c.quantity)
        copies.push({ name: c.name, type: c.type });
      return copies.slice(0, c.quantity);
    });
    const owned = cards.filter((c) => c.owner === owner);
    if (owned.length !== 60)
      errors.push(
        `${owner}: the replay reconstructs ${owned.length} copies, but the deck has 60. Correct the replay allocation before editing.`,
      );
    for (const card of owned.filter((c) => c.name)) {
      const i = pool.findIndex(
        (c) => cardNameKey(c.name) === cardNameKey(card.name!),
      );
      if (i < 0)
        errors.push(
          `${owner}: ${card.name} has more known copies than the selected list.`,
        );
      else Object.assign(card, pool.splice(i, 1)[0]);
    }
    // Alphabetical allocation is hypothetical, never a reconstruction of shuffle order.
    pool.sort((a, b) => a.name.localeCompare(b.name));
    for (const card of owned.filter((c) => !c.name)) {
      const copy = pool.shift();
      if (copy) Object.assign(card, copy, { hypothetical: true });
    }
  }
  if (!Object.keys(lists).length || cards.some((c) => !lists[c.owner]))
    errors.push("Both players need a deck.");
  return errors.length ? { errors } : { errors, state: { ...state, cards } };
}
export function handVisible(
  mode: "you" | "opponent" | "both",
  isOpponent: boolean,
) {
  return mode === "both" || (mode === "opponent" ? isOpponent : !isOpponent);
}
