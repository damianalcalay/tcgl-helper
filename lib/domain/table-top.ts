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
  originalOwner?: string;
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
  cloned?: boolean;
}
export interface Mark {
  id: string;
  tool: string;
  color: string;
  width: number;
  size?: number;
  points: { x: number; y: number }[];
}
export interface TableState {
  cards: TableCard[];
  marks: Mark[];
  deckLists?: Record<string, CardOption[]>;
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
  if (!card) return state;
  if (zone === "stadium" && card.type !== "stadium") return state;
  if (zone === "hand" && card.zone !== "hand") {
    const incoming = 1 + state.cards.filter((c) => c.parent === id).length;
    if (
      state.cards.filter(
        (c) => c.owner === owner && c.zone === "hand" && !c.parent,
      ).length +
        incoming >
      25
    )
      return state;
  }
  if (
    parent &&
    attachment === "energy" &&
    card.parent !== parent &&
    state.cards.filter((c) => c.parent === parent && c.attachment === "energy")
      .length >= 15
  )
    return state;
  const cards = state.cards.map((c) => ({
    ...c,
    originalOwner: c.originalOwner ?? c.owner,
  }));
  const moving = cards.find((c) => c.id === id)!;
  if (
    parent &&
    (parent === id ||
      !cards.some(
        (c) =>
          c.id === parent &&
          c.owner === owner &&
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
  for (const player of new Set(cards.map((c) => c.owner))) {
    const before = state.cards.filter(
      (c) => c.owner === player && c.zone === "hand" && !c.parent,
    ).length;
    const after = cards.filter(
      (c) => c.owner === player && c.zone === "hand" && !c.parent,
    ).length;
    if (after > 25 && after > before) return state;
  }
  return { ...state, cards };
}
/** Hypothetical attachments may clone an energy from the owner's list. */
export function addTableEnergy(
  state: TableState,
  pokemonId: string,
  name: string | null,
  source = "deck",
): TableState {
  const pokemon = state.cards.find(
    (c) => c.id === pokemonId && !c.parent && isTablePokemon(c),
  );
  if (
    !pokemon ||
    state.cards.filter(
      (c) => c.parent === pokemonId && c.attachment === "energy",
    ).length >= 15
  )
    return state;
  const available = state.cards.find(
    (c) =>
      c.owner === pokemon.owner &&
      c.name === name &&
      isTableEnergy(c) &&
      !c.parent &&
      c.zone === source,
  );
  if (available)
    return moveTableCard(
      state,
      available.id,
      pokemon.owner,
      pokemon.zone,
      undefined,
      pokemonId,
      "energy",
    );
  const template = [
    ...state.cards,
    ...fullDeckCards(state, pokemon.owner),
  ].find(
    (c) => c.owner === pokemon.owner && c.name === name && isTableEnergy(c),
  );
  if (!template) return state;
  let sequence = state.cards.length;
  while (state.cards.some((c) => c.id === `energy-clone-${sequence}`))
    sequence++;
  return {
    ...state,
    cards: [
      ...state.cards,
      {
        ...template,
        id: `energy-clone-${sequence}`,
        cloned: true,
        zone: pokemon.zone,
        slot: undefined,
        parent: pokemonId,
        attachment: "energy",
        damage: 0,
        hypothetical: true,
      },
    ],
  };
}
/** Move a selection atomically so a full hand never causes a partial transfer. */
export function moveTableCardsToHand(
  state: TableState,
  ids: string[],
  owner: string,
): TableState {
  let next = state;
  for (const id of new Set(ids)) {
    const moved = moveTableCard(next, id, owner, "hand");
    if (moved === next) return state;
    next = moved;
  }
  return next;
}
export function removeTableEnergy(state: TableState, id: string): TableState {
  const card = state.cards.find(
    (c) => c.id === id && c.parent && c.attachment === "energy",
  );
  return card
    ? { ...state, cards: state.cards.filter((c) => c.id !== id) }
    : state;
}
/** Original list stays independent of movements, removals and hypothetical copies. */
export function fullDeckCards(state: TableState, owner: string): TableCard[] {
  return (state.deckLists?.[owner] ?? []).flatMap((c, index) => {
    const printings = (c.printings ?? []).flatMap((p) =>
      Array.from({ length: p.quantity }, () => p),
    );
    return Array.from({ length: c.quantity }, (_, copy) => ({
      id: `full-${owner}-${index}-${copy}`,
      name: c.name,
      owner,
      zone: "deck" as const,
      damage: 0,
      type: c.type,
      printing: printings[copy],
      tera: printingTera(printings[copy]),
      tool: printings[copy]?.tool,
    }));
  });
}
export function cloneDeckCardsToHand(
  state: TableState,
  ids: string[],
  owner: string,
): TableState {
  const library = fullDeckCards(state, owner);
  const selected = ids.map((id) => library.find((c) => c.id === id));
  if (
    !ids.length ||
    selected.some((c) => !c) ||
    state.cards.filter(
      (c) => c.owner === owner && c.zone === "hand" && !c.parent,
    ).length +
      ids.length >
      25
  )
    return state;
  let sequence = state.cards.length;
  const copies = selected.map((c) => {
    while (state.cards.some((a) => a.id === `deck-clone-${sequence}`))
      sequence++;
    return {
      ...c!,
      id: `deck-clone-${sequence++}`,
      zone: "hand" as const,
      cloned: true,
      hypothetical: true,
    };
  });
  return { ...state, cards: [...state.cards, ...copies] };
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
    const owned = cards.filter((c) => c.owner === owner && !c.cloned);
    if (owned.length !== 60 && !state.deckLists)
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
  return errors.length
    ? { errors }
    : {
        errors,
        state: {
          ...state,
          cards,
          deckLists: Object.fromEntries(
            Object.entries(lists).map(([owner, list]) => [
              owner,
              list.map((c) => ({
                ...c,
                printings: c.printings?.map((p) => ({ ...p })),
              })),
            ]),
          ),
        },
      };
}
/** Preserve the frozen field; changed deck lists supply an editable hypothetical inventory. */
export function prepareHypotheticalTable(
  state: TableState,
  lists: Record<string, CardOption[]>,
) {
  const cards = state.cards.map((c) => ({ ...c }));
  for (const [owner, list] of Object.entries(lists)) {
    const available = new Map(
      list.map((c) => [cardNameKey(c.name), c.quantity]),
    );
    for (const c of cards.filter(
      (c) => c.owner === owner && c.name && !c.cloned,
    )) {
      if (c.zone === "deck" && c.hypothetical) {
        Object.assign(c, {
          name: null,
          type: undefined,
          printing: undefined,
          tera: undefined,
          tool: undefined,
        });
        continue;
      }
      const key = cardNameKey(c.name!);
      if ((available.get(key) ?? 0) > 0)
        available.set(key, available.get(key)! - 1);
      else {
        c.cloned = true;
        c.hypothetical = true;
      }
    }
    const owned = cards.filter((c) => c.owner === owner && !c.cloned);
    let excess = owned.length - 60;
    for (let i = cards.length - 1; i >= 0 && excess > 0; i--)
      if (
        cards[i].owner === owner &&
        cards[i].zone === "deck" &&
        !cards[i].name &&
        !cards[i].cloned
      ) {
        cards.splice(i, 1);
        excess--;
      }
    const missing =
      60 - cards.filter((c) => c.owner === owner && !c.cloned).length;
    let sequence = 0;
    for (let i = 0; i < missing; i++) {
      while (cards.some((c) => c.id === `allocation-${owner}-${sequence}`))
        sequence++;
      cards.push({
        id: `allocation-${owner}-${sequence++}`,
        owner,
        name: null,
        zone: "deck",
        damage: 0,
      });
    }
  }
  return prepareTable({ ...state, cards }, lists);
}
export function clearTable(state: TableState, side?: string): TableState {
  const returning = new Set(
    state.cards
      .filter(
        (c) =>
          !side || c.owner === side || (c.originalOwner ?? c.owner) === side,
      )
      .map((c) => c.id),
  );
  return {
    ...state,
    marks: side ? state.marks : [],
    cards: state.cards.map((c) =>
      returning.has(c.id) || (c.parent && returning.has(c.parent))
        ? {
            ...c,
            owner: c.originalOwner ?? c.owner,
            zone: "deck",
            slot: undefined,
            parent: undefined,
            attachment: undefined,
            damage: 0,
          }
        : c,
    ),
  };
}
export function deleteTableCard(state: TableState, id: string): TableState {
  return {
    ...state,
    cards: state.cards.filter((c) => c.id !== id && c.parent !== id),
  };
}
export function replaceTableDeck(
  state: TableState,
  owner: string,
  list: CardOption[],
): TableState {
  const cleared = clearTable(state, owner);
  const next = { ...cleared, deckLists: { ...state.deckLists, [owner]: list } };
  const kept = cleared.cards.filter(
    (c) => (c.originalOwner ?? c.owner) !== owner,
  );
  const copies = fullDeckCards(next, owner).map((c, i) => ({
    ...c,
    id: `replacement-${owner}-${i}`,
    originalOwner: owner,
  }));
  return { ...next, cards: [...kept, ...copies] };
}
export function handVisible(
  mode: "you" | "opponent" | "both",
  isOpponent: boolean,
) {
  return mode === "both" || (mode === "opponent" ? isOpponent : !isOpponent);
}
