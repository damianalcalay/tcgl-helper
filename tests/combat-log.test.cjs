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
      require: (name) =>
        name === "./combat-log"
          ? load("lib/domain/combat-log.ts")
          : require(name),
    },
  );
  return exports;
}
const { parseCombatLog, cardNameKey } = load("lib/domain/combat-log.ts");
const { replayBoard } = load("lib/domain/combat-replay.ts");
const raw = fs.readFileSync("tests/fixtures/combat-log.txt", "utf8");
test("real English log fragments infer starters, hidden prizes, 6-2 result and opening coin", () => {
  const parsed = parseCombatLog(raw);
  assert.deepEqual([...parsed.players], ["Ciberbrian", "bastorz"]);
  assert.equal(parsed.perspective, "Ciberbrian");
  assert.equal(parsed.winner, "Ciberbrian");
  assert.equal(parsed.starters.Ciberbrian, "Applin");
  assert.equal(parsed.starters.bastorz, "Fezandipiti ex");
  assert.equal(parsed.prizesTaken.Ciberbrian, 6);
  assert.equal(parsed.prizesTaken.bastorz, 2);
  assert.deepEqual(
    [...parsed.prizeCards.Ciberbrian],
    [
      "Poké Pad",
      "Hydrapple ex",
      "Bug Catching Set",
      "Forest of Vitality",
      "Bug Catching Set",
      "Meganium",
    ],
  );
  assert.deepEqual([...parsed.prizeCards.bastorz], [null, null]);
  assert.equal(parsed.coin.winner, "bastorz");
  assert.equal(parsed.coin.outcome, "heads");
  assert.equal(parsed.coin.first, "bastorz");
});
test("effects and damage breakdowns preserve every original detail and curly apostrophes", () => {
  const log = parseCombatLog(raw);
  const discard = log.events.find((e) => e.kind === "discard" && e.count === 2);
  assert.deepEqual([...discard.cards], ["Unfair Stamp", "Meganium"]);
  const attack = log.events.find((e) => e.kind === "attack");
  assert.equal(attack.targetPlayer, "bastorz");
  assert.equal(attack.target, "Celebi");
  assert.equal(attack.damage, 120);
  assert.equal(attack.details.length, 4);
  assert.equal(
    cardNameKey("Basic {G} Energy"),
    cardNameKey("Basic Grass Energy"),
  );
  assert.equal(cardNameKey("Boss’s Orders"), cardNameKey("Boss's Orders"));
});
test("replay tracks evolution, retreat, discard costs, stadium, damage and hand visibility", () => {
  const log = parseCombatLog(raw);
  const evolved = log.events.find(
    (e) => e.kind === "evolve" && e.card === "Meganium",
  );
  const mid = replayBoard(log, evolved.index);
  assert.equal(mid.sides.bastorz.active.name, "Meganium");
  assert.equal(mid.stadium, "Forest of Vitality");
  assert(mid.sides.Ciberbrian.discard.includes("Unfair Stamp"));
  assert(mid.sides.Ciberbrian.discard.includes("Meganium"));
  const attack = log.events.find((e) => e.kind === "attack");
  assert.equal(replayBoard(log, attack.index).sides.bastorz.active.damage, 120);
  const end = replayBoard(log, log.events.length - 1);
  assert.equal(end.sides.Ciberbrian.collected, 6);
  assert.equal(end.sides.bastorz.collected, 2);
  assert.equal(end.sides.bastorz.prizes[0], null);
});
test("no prizes or two revealed perspectives require a player choice; incomplete logs never invent winner", () => {
  const setup = raw.split("bastorz's Turn")[0];
  const parsed = parseCombatLog(setup);
  assert.equal(parsed.perspective, undefined);
  assert.equal(parsed.winner, undefined);
  assert(parsed.warnings.length >= 2);
  const both = parseCombatLog(
    raw.replace(
      "A card was added to bastorz's hand.",
      "Celebi was added to bastorz's hand.",
    ),
  );
  assert.equal(both.perspective, undefined);
  assert.throws(
    () => parseCombatLog("Setup\nNobody drew a card."),
    /two players/,
  );
  assert.throws(() => parseCombatLog("a".repeat(200001)), /200,000/);
});
