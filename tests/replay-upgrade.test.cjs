const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function load(file) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require: (n) =>
        n.startsWith("./")
          ? load("lib/domain/" + n.slice(2) + ".ts")
          : require(n),
    },
  );
  return exports;
}
const { parseCombatLog, combineCombatLogs } = load("lib/domain/combat-log.ts");
const { replayBoard } = load("lib/domain/combat-replay.ts");
const { tableFromReplay, moveTableCard, setTableDamage, handVisible } = load(
  "lib/domain/table-top.ts",
);
const own = fs.readFileSync("tests/fixtures/paired-own.txt", "utf8"),
  other = fs.readFileSync("tests/fixtures/paired-opponent.txt", "utf8");
test("paired real logs merge once and reveal both opening hands without future draws", () => {
  const pair = combineCombatLogs(own, other);
  assert.equal(pair.status, "matched", pair.message);
  const a = parseCombatLog(own);
  assert.equal(pair.log.events.length, a.events.length);
  const firstTurn = pair.log.events.find((e) => e.turn === 1);
  const board = replayBoard(pair.log, firstTurn.index - 1);
  assert(board.sides.Ciberbrian.hand.every(Boolean));
  assert(board.sides.bastorz.hand.every(Boolean));
  assert(!board.sides.bastorz.hand.includes("Lana's Aid"));
  const prize = pair.log.events.find((e) => e.kind === "prize");
  assert.equal(
    replayBoard(pair.log, prize.index).sides.bastorz.hand.at(-1),
    null,
  );
  assert.equal(
    replayBoard(pair.log, prize.index + 1).sides.bastorz.hand.at(-1),
    "Teal Mask Ogerpon ex",
  );
});
test("pairing rejects public contradictions, ordering, private conflicts and same perspective", () => {
  for (const [from, to] of [
    ["for 240 damage", "for 250 damage"],
    ["took 3 Prize cards", "took 2 Prize cards"],
    ["bastorz wins.", "Ciberbrian wins."],
    ["decided to go first", "decided to go second"],
    ["played Chikorita to the Bench", "played Shaymin to the Bench"],
  ])
    assert.equal(
      combineCombatLogs(own, other.replace(from, to)).status,
      "incompatible",
      from,
    );
  assert.equal(combineCombatLogs(own, own).status, "incompatible");
  const changed = other.replace(
    "Basic Grass Energy, Teal Mask Ogerpon ex, Bug Catching Set",
    "Solrock, Teal Mask Ogerpon ex, Bug Catching Set",
  );
  assert.equal(combineCombatLogs(other, changed).status, "incompatible");
  assert.equal(
    combineCombatLogs(own, other.split("bastorz's Turn")[0]).status,
    "unverifiable",
  );
});
test("stadium ownership and explicit replacement discard are accounted exactly once", () => {
  const pair = combineCombatLogs(own, other);
  assert.equal(pair.status, "matched", pair.message);
  const e = pair.log.events.find(
    (e) => e.kind === "play" && e.card === "Forest of Vitality",
  );
  const board = replayBoard(pair.log, e.index + 1);
  assert.equal(board.stadiumOwner, "bastorz");
  assert.equal(board.stadium, "Forest of Vitality");
  assert.equal(
    board.sides.Ciberbrian.discard.filter((c) => c === "Gravity Mountain")
      .length,
    1,
  );
  assert(!board.sides.bastorz.discard.includes("Gravity Mountain"));
  const noDiscard = {
    ...pair.log,
    events: pair.log.events.filter(
      (ev) => !(ev.kind === "discard" && ev.card === "Gravity Mountain"),
    ),
  };
  const index = noDiscard.events.findIndex((ev) => ev === e);
  assert(
    replayBoard(noDiscard, index).sides.Ciberbrian.discard.includes(
      "Gravity Mountain",
    ),
  );
});
test("prize choices stay stable across seeking and KO retains evolution/attachments without duplicates", () => {
  const log = combineCombatLogs(own, other).log,
    prize = log.events.find((e) => e.kind === "prize");
  const choices = { [prize.index]: [5] };
  const board = replayBoard(log, prize.index + 1, choices);
  assert.equal(board.sides.bastorz.collectedSlots[5], true);
  assert.equal(board.sides.bastorz.collectedSlots[0], false);
  assert.equal(
    JSON.stringify(board),
    JSON.stringify(replayBoard(log, prize.index + 1, choices)),
  );
  const end = replayBoard(log, log.events.length - 1);
  assert.equal(
    end.sides.Ciberbrian.discard.filter((c) => c === "Riolu").length,
    1,
  );
});
test("Table Top conserves identities, moves bundles, swaps prizes, edits damage and isolates source", () => {
  const log = combineCombatLogs(own, other).log;
  const at = log.events.find((e) => e.kind === "evolve" && e.zone === "active");
  const board = replayBoard(log, at.index);
  const source = JSON.stringify(board);
  let state = tableFromReplay(board);
  const count = state.cards.length,
    ids = state.cards
      .map((c) => c.id)
      .sort()
      .join(",");
  const active = state.cards.find(
    (c) => c.owner === "Ciberbrian" && c.zone === "active",
  );
  const attached = state.cards.filter((c) => c.parent === active.id);
  assert(attached.length >= 2);
  state = setTableDamage(state, active.id, 990);
  assert.equal(state.cards.find((c) => c.id === active.id).damage, 990);
  state = setTableDamage(state, active.id, -10);
  assert.equal(state.cards.find((c) => c.id === active.id).damage, 990);
  state = moveTableCard(state, active.id, "Ciberbrian", "bench");
  assert(
    state.cards
      .filter((c) => c.parent === active.id)
      .every((c) => c.zone === "bench"),
  );
  state = moveTableCard(state, active.id, "Ciberbrian", "discard");
  assert(
    state.cards
      .filter((c) => attached.some((a) => a.id === c.id))
      .every((c) => c.zone === "discard" && !c.parent),
  );
  const card = state.cards.find((c) => c.zone === "hand");
  state = moveTableCard(state, card.id, card.owner, "prizes", 0);
  assert.equal(state.cards.find((c) => c.id === card.id).slot, 0);
  assert.equal(state.cards.length, count);
  assert.equal(
    state.cards
      .map((c) => c.id)
      .sort()
      .join(","),
    ids,
  );
  assert.equal(JSON.stringify(board), source);
});
test("hand visibility changes only which hand is shown", () => {
  assert(handVisible("you", false));
  assert(!handVisible("you", true));
  assert(handVisible("opponent", true));
  assert(!handVisible("opponent", false));
  assert(handVisible("both", true) && handVisible("both", false));
});
test("Aura Jab attaches from discard without consuming hand cards", () => {
  const pair = combineCombatLogs(own, other);
  assert.equal(pair.status, "matched", pair.message);
  const log = pair.log;
  const attack = log.events.find(
    (e) => e.kind === "attack" && e.action === "Aura Jab",
  );
  const before = replayBoard(log, attack.index),
    after = replayBoard(log, attack.index + 2);
  assert.equal(
    after.sides.Ciberbrian.hand.length,
    before.sides.Ciberbrian.hand.length,
  );
  assert.equal(
    after.sides.Ciberbrian.discard.length,
    before.sides.Ciberbrian.discard.length - 2,
  );
});
