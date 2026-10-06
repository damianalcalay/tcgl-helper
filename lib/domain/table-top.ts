import type { ReplayBoard } from "./combat-replay";

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
        const root = add(owner, zone, p.name, { damage: p.damage });
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
  const cards = state.cards.map((c) => ({ ...c }));
  const moving = cards.find((c) => c.id === id)!;
  if (
    parent &&
    (parent === id ||
      !cards.some(
        (c) =>
          c.id === parent && !c.parent && ["active", "bench"].includes(c.zone),
      ))
  )
    return state;
  if (zone === "prizes") {
    slot ??= Array.from({ length: 6 }, (_, i) => i).find(
      (i) =>
        !cards.some(
          (c) =>
            c.id !== id && c.owner === owner && c.zone === zone && c.slot === i,
        ),
    );
    if (slot === undefined) return state;
  }
  // Occupied active/prize positions swap; a replaced stadium goes to its owner's discard.
  const occupied = cards.find(
    (c) =>
      c.id !== id &&
      !c.parent &&
      c.zone === zone &&
      (zone === "stadium" ||
        (c.owner === owner &&
          (zone === "active" || (zone === "prizes" && c.slot === slot)))),
  );
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
  if (!Number.isFinite(damage)) return state;
  return {
    ...state,
    cards: state.cards.map((c) =>
      c.id === id ? { ...c, damage: Math.max(0, Math.trunc(damage)) } : c,
    ),
  };
}
export function handVisible(
  mode: "you" | "opponent" | "both",
  isOpponent: boolean,
) {
  return mode === "both" || (mode === "opponent" ? isOpponent : !isOpponent);
}
