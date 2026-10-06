import type { Result } from "@/types/domain";

export type EventKind =
  | "play"
  | "draw"
  | "attach"
  | "evolve"
  | "retreat"
  | "active"
  | "attack"
  | "use"
  | "ability"
  | "knockout"
  | "prize"
  | "prize-card"
  | "discard"
  | "shuffle"
  | "move"
  | "coin"
  | "end"
  | "other";
export interface CombatEvent {
  index: number;
  turn: number;
  turnPlayer: string;
  actor: string;
  text: string;
  details: string[];
  kind: EventKind;
  card?: string;
  target?: string;
  targetPlayer?: string;
  zone?: "active" | "bench" | "stadium";
  count?: number;
  cards?: string[];
  damage?: number;
  action?: string;
  source?: "hand" | "discard";
}
export interface ParsedCombatLog {
  players: string[];
  events: CombatEvent[];
  starters: Record<string, string>;
  prizesTaken: Record<string, number>;
  prizeCards: Record<string, (string | null)[]>;
  winner?: string;
  result?: Result;
  coin?: {
    chooser: string;
    choice: "heads" | "tails";
    winner?: string;
    outcome?: "heads" | "tails";
    first?: string;
  };
  warnings: string[];
  perspective?: string;
}
const clean = (s: string) => s.replace(/[’‘]/g, "'").trim();
export const cardNameKey = (s: string) =>
  clean(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Basic \{G\} Energy/gi, "Basic Grass Energy")
    .replace(/Basic \{D\} Energy/gi, "Basic Darkness Energy")
    .replace(/Basic \{P\} Energy/gi, "Basic Psychic Energy")
    .replace(/Basic \{R\} Energy/gi, "Basic Fire Energy")
    .replace(/Basic \{W\} Energy/gi, "Basic Water Energy")
    .replace(/Basic \{L\} Energy/gi, "Basic Lightning Energy")
    .replace(/Basic \{F\} Energy/gi, "Basic Fighting Energy")
    .replace(/Basic \{M\} Energy/gi, "Basic Metal Energy")
    .replace(/\s+/g, " ")
    .toLowerCase();
export function parseCombatLog(raw: string): ParsedCombatLog {
  if (raw.length > 200000)
    throw new Error("Combat log exceeds 200,000 characters.");
  const lines = raw.split(/\r?\n/);
  const players = [
    ...new Set(
      lines.flatMap((l) => {
        const m = clean(l).match(
          /^(.+?)(?: drew 7 cards for the opening hand\.|'s Turn$| chose (?:heads|tails) for the opening coin flip\.)/,
        );
        return m ? [m[1]] : [];
      }),
    ),
  ];
  if (players.length !== 2)
    throw new Error(
      "The log must identify exactly two players. Paste the complete English battle log, including Setup.",
    );
  const parsed: ParsedCombatLog = {
    players,
    events: [],
    starters: {},
    prizesTaken: Object.fromEntries(players.map((p) => [p, 0])),
    prizeCards: Object.fromEntries(players.map((p) => [p, []])),
    warnings: [],
  };
  let turn = 0,
    turnPlayer = "",
    previousActor = "";
  let pendingPrize: { player: string; remaining: number } | undefined;
  for (const original of lines) {
    const text = clean(original).replace(/^-\s*/, "");
    if (!text || text === "Setup") continue;
    const turnMatch = text.match(/^(.+)'s Turn$/);
    if (turnMatch && players.includes(turnMatch[1])) {
      turn++;
      turnPlayer = turnMatch[1];
      continue;
    }
    if (/^[•]|^\d+ drawn cards\.|^Damage breakdown:/.test(text)) {
      const last = parsed.events.at(-1);
      if (last) {
        last.details.push(original.trim());
        if (
          text.startsWith("•") &&
          !/(?:damage|Weakness|Resistance|\(Item\)|\(Ability\))/i.test(text) &&
          ["draw", "discard", "shuffle"].includes(last.kind)
        )
          last.cards = text.slice(1).trim().split(/,\s*/);
      }
      continue;
    }
    const actor =
      players.find(
        (p) => text.startsWith(p + " ") || text.startsWith(p + "'s "),
      ) ??
      previousActor ??
      turnPlayer;
    if (actor) previousActor = actor;
    const rest = actor
      ? text.slice(text.startsWith(actor) ? actor.length : 0).trim()
      : text;
    const event: CombatEvent = {
      index: parsed.events.length,
      turn,
      turnPlayer,
      actor,
      text: original.trim(),
      details: [],
      kind: "other",
    };
    let m: RegExpMatchArray | null;
    if (
      (m = text.match(/^(.+) chose (heads|tails) for the opening coin flip\./))
    ) {
      event.kind = "coin";
      parsed.coin = { chooser: m[1], choice: m[2] as "heads" | "tails" };
    } else if ((m = text.match(/^(.+) won the coin toss\./))) {
      event.kind = "coin";
      if (parsed.coin) {
        parsed.coin.winner = m[1];
        parsed.coin.outcome =
          m[1] === parsed.coin.chooser
            ? parsed.coin.choice
            : parsed.coin.choice === "heads"
              ? "tails"
              : "heads";
      }
    } else if ((m = text.match(/^(.+) decided to go (first|second)\./))) {
      event.kind = "coin";
      if (parsed.coin)
        parsed.coin.first =
          m[2] === "first" ? m[1] : players.find((p) => p !== m![1]);
    } else if (
      (m = rest.match(
        /^played (.+?)(?: to the (Active Spot|Bench|Stadium spot))?\.$/,
      ))
    ) {
      event.kind = "play";
      event.card = m[1];
      event.zone =
        m[2] === "Active Spot"
          ? "active"
          : m[2] === "Bench"
            ? "bench"
            : m[2]
              ? "stadium"
              : undefined;
      if (turn === 0 && event.zone === "active" && !parsed.starters[actor])
        parsed.starters[actor] = m[1];
    } else if (
      (m = rest.match(
        /^attached (.+) to (.+) (?:in the Active Spot|on the Bench)\.$/,
      ))
    ) {
      event.kind = "attach";
      event.card = m[1];
      event.target = m[2];
      event.zone = /on the Bench/.test(rest) ? "bench" : "active";
      // Aura Jab attaches from discard; the exported sub-action omits its source.
      const precedingAction = [...parsed.events]
        .reverse()
        .find((e) => !e.text.startsWith("-"));
      event.source =
        original.trim().startsWith("-") &&
        precedingAction?.kind === "attack" &&
        precedingAction.action === "Aura Jab"
          ? "discard"
          : "hand";
    } else if (
      (m = rest.match(
        /^evolved (.+) to (.+) (?:in the Active Spot|on the Bench)\.$/,
      ))
    ) {
      event.kind = "evolve";
      event.card = m[2];
      event.target = m[1];
      event.zone = /on the Bench/.test(rest) ? "bench" : "active";
    } else if ((m = rest.match(/^retreated (.+) to the Bench\.$/))) {
      event.kind = "retreat";
      event.card = m[1];
    } else if ((m = rest.match(/^'s (.+) is now in the Active Spot\.$/))) {
      event.kind = "active";
      event.card = m[1];
    } else if (
      (m = rest.match(
        /^'s (.+?) used (.+?)(?: on (.+)'s (.+) for (\d+) damage)?\.(?: .*damage\.)?$/,
      ))
    ) {
      event.kind = m[3] ? "attack" : "use";
      event.card = m[1];
      event.action = m[2];
      event.targetPlayer = m[3];
      event.target = m[4];
      event.damage = m[5] ? Number(m[5]) : undefined;
    } else if ((m = rest.match(/^'s (.+) was Knocked Out!$/))) {
      event.kind = "knockout";
      event.card = m[1];
    } else if ((m = rest.match(/^took (a|\d+) Prize cards?\.$/))) {
      event.kind = "prize";
      event.count = m[1] === "a" ? 1 : Number(m[1]);
      parsed.prizesTaken[actor] += event.count;
      const start = parsed.prizeCards[actor].length;
      parsed.prizeCards[actor].push(
        ...Array(Math.min(6, event.count)).fill(null),
      );
      pendingPrize = { player: actor, remaining: event.count };
      event.cards = [];
      event.action = String(start);
    } else if ((m = text.match(/^(.+) was added to (.+)'s hand\.$/))) {
      event.kind = "prize-card";
      event.actor = m[2];
      event.card = m[1] === "A card" ? undefined : m[1];
      if (pendingPrize?.player === m[2] && pendingPrize.remaining > 0) {
        const list = parsed.prizeCards[m[2]];
        const slot = list.length - pendingPrize.remaining;
        list[slot] = event.card ?? null;
        pendingPrize.remaining--;
        const batch = [...parsed.events]
          .reverse()
          .find((e) => e.kind === "prize" && e.actor === m![2]);
        batch?.cards?.push(event.card ?? "Unknown prize card");
      }
    } else if ((m = rest.match(/^drew (.+)\.$/))) {
      event.kind = "draw";
      event.count = /^(\d+) cards/.test(m[1])
        ? Number(m[1].match(/^\d+/)![0])
        : 1;
      if (!/^(?:a card|\d+ cards)/.test(m[1])) event.cards = [m[1]];
    } else if ((m = rest.match(/^discarded (\d+) cards?\.$/))) {
      event.kind = "discard";
      event.count = Number(m[1]);
    } else if ((m = rest.match(/^discarded (.+)\.$/))) {
      event.kind = "discard";
      event.card = m[1];
      event.count = 1;
    } else if ((m = text.match(/^(.+) was discarded from (.+)'s (.+)\.$/))) {
      event.kind = "discard";
      event.actor = m[2];
      event.card = m[1];
      event.target = m[3];
      event.count = 1;
    } else if (
      (m = text.match(/^(\d+) cards were discarded from (.+)'s (.+)\.$/))
    ) {
      event.kind = "discard";
      event.actor = m[2];
      event.target = m[3];
      event.count = Number(m[1]);
    } else if (/shuffled/.test(rest)) {
      event.kind = "shuffle";
      event.count = Number(rest.match(/shuffled (\d+) cards/)?.[1] ?? 0);
    } else if ((m = rest.match(/^moved (.+)'s (.+) to their hand\.$/))) {
      event.kind = "move";
      event.card = m[2];
    } else if (/ended their turn/.test(rest)) event.kind = "end";
    const winner = players.find(
      (p) => text === `${p} wins.` || text.endsWith(`. ${p} wins.`),
    );
    if (winner) parsed.winner = winner;
    if (
      event.kind !== "prize-card" &&
      event.kind !== "prize" &&
      pendingPrize?.remaining === 0
    )
      pendingPrize = undefined;
    parsed.events.push(event);
  }
  for (const player of players) {
    if (!parsed.starters[player])
      parsed.warnings.push(
        `Opening Active Pokémon not recorded for ${player}.`,
      );
    if (parsed.prizesTaken[player] > 6)
      parsed.warnings.push(
        `${player} took more than six prizes; check prize-changing effects manually.`,
      );
  }
  if (!parsed.winner)
    parsed.warnings.push(
      "The winner is not recorded. Confirm the result manually.",
    );
  const revealed = players.filter((p) => parsed.prizeCards[p].some(Boolean));
  if (revealed.length === 1) parsed.perspective = revealed[0];
  else
    parsed.warnings.push(
      "Prize reveals do not identify a unique perspective. Choose Your player.",
    );
  return parsed;
}

export type PairResult =
  | { status: "matched"; log: ParsedCombatLog }
  | { status: "incompatible" | "unverifiable"; message: string };

/** Compare observable histories, allowing anonymous private information. */
export function combineCombatLogs(first: string, second: string): PairResult {
  let a: ParsedCombatLog, b: ParsedCombatLog;
  try {
    a = parseCombatLog(first);
    b = parseCombatLog(second);
  } catch {
    return {
      status: "unverifiable",
      message:
        "Paste both complete English combat logs, including Setup and the result.",
    };
  }
  const fail = (message: string): PairResult => ({
    status: "incompatible",
    message: `This log does not complement the first match. ${message}`,
  });
  if ([...a.players].sort().join("\0") !== [...b.players].sort().join("\0"))
    return fail("The players differ.");
  if (!a.winner || !b.winner)
    return {
      status: "unverifiable",
      message:
        "The complete result is required to verify the complementary history.",
    };
  if (
    a.winner !== b.winner ||
    JSON.stringify(a.coin) !== JSON.stringify(b.coin)
  )
    return fail("The opening or result differs.");
  if (a.events.length !== b.events.length)
    return fail("The action sequences have different lengths.");
  const known = (s: string | undefined) => s && !/^Unknown|^A card$/i.test(s);
  const equal = (x: string, y: string) => cardNameKey(x) === cardNameKey(y);
  const events: CombatEvent[] = [];
  for (let i = 0; i < a.events.length; i++) {
    const x = a.events[i],
      y = b.events[i];
    for (const key of [
      "kind",
      "actor",
      "turn",
      "turnPlayer",
      "zone",
      "count",
      "damage",
      "targetPlayer",
      "target",
      "action",
      "source",
    ] as const)
      if (x[key] !== y[key]) return fail(`Action ${i + 1} differs (${key}).`);
    if (known(x.card) && known(y.card) && !equal(x.card!, y.card!))
      return fail(`Action ${i + 1} has different cards.`);
    const count = Math.max(x.cards?.length ?? 0, y.cards?.length ?? 0);
    const cards: string[] = [];
    for (let j = 0; j < count; j++) {
      const left = x.cards?.[j],
        right = y.cards?.[j];
      if (known(left) && known(right) && !equal(left!, right!))
        return fail(`Action ${i + 1} reveals conflicting cards.`);
      cards.push(known(left) ? left! : (right ?? left ?? "Unknown card"));
    }
    if (
      x.kind === "other" &&
      i !== a.events.length - 1 &&
      !equal(x.text, y.text)
    )
      return fail(`Action ${i + 1} contains different unrecognized effects.`);
    const richer =
      (y.cards?.filter(known).length ?? 0) >
        (x.cards?.filter(known).length ?? 0) ||
      (!x.card && y.card)
        ? y
        : x;
    events.push({ ...richer, index: i, cards: count ? cards : undefined });
  }
  const perspectives = [a, b].map((log) => {
    const opening = log.events.filter(
      (e) => e.kind === "draw" && e.turn === 0 && e.cards?.length,
    );
    return opening.length === 1 ? opening[0].actor : log.perspective;
  });
  if (perspectives[0] && perspectives[0] === perspectives[1])
    return fail("Both logs show the same player's perspective.");
  if (!perspectives[0] || !perspectives[1])
    return {
      status: "unverifiable",
      message:
        "The private information does not identify two complementary perspectives.",
    };
  const prizeCards = Object.fromEntries(
    a.players.map((p) => [
      p,
      a.prizeCards[p].map((c, i) => c ?? b.prizeCards[p][i] ?? null),
    ]),
  );
  return { status: "matched", log: { ...a, events, prizeCards } };
}
