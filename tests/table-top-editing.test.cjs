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
const {
  moveTableCard,
  setTableDamage,
  prepareTable,
  benchCapacity,
  addTableEnergy,
  moveTableCardsToHand,
  removeTableEnergy,
  fullDeckCards,
  cloneDeckCardsToHand,
} = load("lib/domain/table-top.ts");
const { teraMetadata, printingTera } = load("lib/domain/card-metadata.ts");
const c = (id, owner, zone, name, type, extra = {}) => ({
  id,
  owner,
  zone,
  name,
  type,
  damage: 0,
  ...extra,
});
test("panel energy removal deletes the attachment without moving it to another zone; original deck stays available", () => {
  const state = {
    marks: [],
    cards: [
      c("p", "you", "active", "P", "basic"),
      c("e", "you", "active", "Energy", "energy_basic", {
        parent: "p",
        attachment: "energy",
      }),
    ],
    deckLists: {
      you: [
        { id: "energy", name: "Energy", type: "energy_basic", quantity: 1 },
      ],
    },
  };
  const next = removeTableEnergy(state, "e");
  assert.equal(next.cards.length, 1);
  assert.equal(next.cards.filter((c) => c.zone === "hand").length, 0);
  assert.equal(fullDeckCards(next, "you").length, 1);
  assert.equal(
    addTableEnergy(next, "p", "Energy").cards.filter((c) => c.parent === "p")
      .length,
    1,
  );
  assert.equal(removeTableEnergy(state, "p"), state);
});
test("Full deck copies cards independently of their current location and respects owner and hand capacity", () => {
  const state = {
    marks: [],
    cards: [c("p", "you", "active", "P", "basic")],
    deckLists: { you: [{ id: "p", name: "P", type: "basic", quantity: 1 }] },
  };
  const template = fullDeckCards(state, "you")[0];
  const next = cloneDeckCardsToHand(state, [template.id], "you");
  assert.equal(next.cards.find((c) => c.id === "p").zone, "active");
  assert.equal(next.cards.filter((c) => c.zone === "hand").length, 1);
  assert.equal(next.cards[1].cloned, true);
  assert.equal(cloneDeckCardsToHand(state, [template.id], "opponent"), state);
  assert.equal(
    cloneDeckCardsToHand(state, Array(26).fill(template.id), "you"),
    state,
  );
});
test("stadium zone rejects every non-stadium card and still replaces the previous owner's stadium", () => {
  const state = {
    marks: [],
    cards: [
      c("p", "you", "hand", "P", "basic"),
      c("s", "you", "hand", "New stadium", "stadium"),
      c("old", "opponent", "stadium", "Old stadium", "stadium"),
    ],
  };
  assert.equal(moveTableCard(state, "p", "you", "stadium"), state);
  const next = moveTableCard(state, "s", "you", "stadium");
  assert.equal(next.cards.find((c) => c.id === "old").zone, "discard");
  assert.equal(next.cards.find((c) => c.id === "old").owner, "opponent");
});
test("hypothetical energies use the deck then clone only owned energy types up to fifteen", () => {
  const original = {
    marks: [],
    cards: [
      c("p", "you", "active", "Pokemon", "basic"),
      c("e", "you", "deck", "Energy", "energy_basic"),
      c("r", "opponent", "deck", "Rival energy", "energy_basic"),
    ],
  };
  let next = addTableEnergy(original, "p", "Energy");
  assert.equal(next.cards.length, original.cards.length);
  assert.equal(next.cards.find((c) => c.id === "e").parent, "p");
  for (let i = 1; i < 15; i++) next = addTableEnergy(next, "p", "Energy");
  assert.equal(next.cards.filter((c) => c.parent === "p").length, 15);
  assert.equal(addTableEnergy(next, "p", "Energy"), next);
  assert.equal(addTableEnergy(original, "p", "Rival energy"), original);
  assert.equal(original.cards.find((c) => c.id === "e").zone, "deck");
  const fullDeck = {
    ...original,
    cards: [
      original.cards[0],
      original.cards[1],
      ...Array.from({ length: 58 }, (_, i) =>
        c(`copy-${i}`, "you", "deck", "Energy", "energy_basic"),
      ),
    ],
  };
  let cloned = fullDeck;
  // A different source deliberately clones once exhausted without changing the deck list.
  cloned = addTableEnergy(cloned, "p", "Energy", "discard");
  const prepared = prepareTable(cloned, {
    you: [
      { id: "pokemon", name: "Pokemon", type: "basic", quantity: 1 },
      { id: "energy", name: "Energy", type: "energy_basic", quantity: 59 },
    ],
  });
  assert.equal(prepared.errors.length, 0);
  assert.equal(prepared.state.cards.length, 61);
});
test("batch transfers enforce twenty five hand cards atomically and preserve ownership", () => {
  const original = {
    marks: [],
    cards: [
      ...Array.from({ length: 23 }, (_, i) =>
        c(`h${i}`, "you", "hand", "Card", "basic"),
      ),
      c("d1", "you", "deck", "One", "basic"),
      c("d2", "you", "deck", "Two", "basic"),
      c("d3", "you", "deck", "Three", "basic"),
      c("r", "opponent", "deck", "Rival", "basic"),
    ],
  };
  assert.equal(
    moveTableCardsToHand(original, ["d1", "d2", "d3"], "you"),
    original,
  );
  assert.equal(moveTableCardsToHand(original, ["d1", "r"], "you"), original);
  const next = moveTableCardsToHand(original, ["d1", "d2"], "you");
  assert.equal(
    next.cards.filter((c) => c.owner === "you" && c.zone === "hand").length,
    25,
  );
  assert.equal(moveTableCard(next, "d3", "you", "hand"), next);
});
test("current expansion pool excludes old sets, promos and unreleased tournament sets", () => {
  const { currentExpansionId, releasedExpansion } = load(
    "lib/domain/current-expansions.ts",
  );
  for (const id of ["sv05", "sv06.5", "sv10.5b", "me04", "me02.5"])
    assert.equal(currentExpansionId(id), true);
  for (const id of ["sv01", "sv04.5", "swsh12", "svp", "mep"])
    assert.equal(currentExpansionId(id), false);
  assert.equal(releasedExpansion("2026-07-17", Date.parse("2026-10-07")), true);
  assert.equal(
    releasedExpansion("2026-11-06", Date.parse("2026-10-07")),
    false,
  );
  assert.equal(
    releasedExpansion("2026-10-01", Date.parse("2026-10-07")),
    false,
  );
});
test("ownership restrictions reject moving and attaching across both sides without mutating state", () => {
  const state = {
    marks: [],
    cards: [
      c("a", "you", "active", "A", "basic"),
      c("b", "opponent", "active", "B", "basic"),
      c("e", "you", "hand", "Energy", "energy_basic"),
      c("i", "you", "hand", "Item", "item"),
    ],
  };
  const snapshot = JSON.stringify(state);
  for (const zone of ["hand", "bench", "active", "deck", "prizes", "discard"])
    assert.equal(moveTableCard(state, "a", "opponent", zone), state);
  assert.equal(
    moveTableCard(state, "e", "you", "active", undefined, "b", "energy"),
    state,
  );
  assert.equal(
    moveTableCard(state, "i", "you", "active", undefined, "a", "tool"),
    state,
  );
  assert.equal(JSON.stringify(state), snapshot);
});
test("tool replacement and energy attachment conserve actual copy identities", () => {
  const state = {
    marks: [],
    cards: [
      c("a", "you", "active", "A", "basic"),
      c("t1", "you", "active", "Tool 1", "tool", {
        parent: "a",
        attachment: "tool",
      }),
      c("t2", "you", "deck", "ACE Tool", "ace_spec", { tool: true }),
      c("e", "you", "hand", "Energy", "energy_basic"),
    ],
  };
  const next = moveTableCard(
    state,
    "t2",
    "you",
    "active",
    undefined,
    "a",
    "tool",
  );
  assert.equal(next.cards.find((c) => c.id === "t1").zone, "deck");
  assert.equal(
    next.cards.filter((c) => c.parent === "a" && c.attachment === "tool")
      .length,
    1,
  );
  const energy = moveTableCard(
    next,
    "e",
    "you",
    "active",
    undefined,
    "a",
    "energy",
  );
  assert.equal(energy.cards.find((c) => c.id === "e").parent, "a");
  assert.deepEqual(
    [...energy.cards.map((c) => c.id)].sort(),
    [...state.cards.map((c) => c.id)].sort(),
  );
  assert.equal(state.cards.find((c) => c.id === "e").zone, "hand");
});
test("damage validates ten-point increments and bounds in the state model", () => {
  const state = {
    marks: [],
    cards: [
      c("a", "you", "active", "A", "basic"),
      c("e", "you", "hand", "Energy", "energy_basic"),
    ],
  };
  for (const n of [-10, 1, 15, 1001, NaN, Infinity])
    assert.equal(setTableDamage(state, "a", n), state);
  assert.equal(setTableDamage(state, "a", 1000).cards[0].damage, 1000);
  assert.equal(setTableDamage(state, "e", 10).cards[1].damage, 0);
});
test("Area Zero extends each player independently, rejects sixth slot without Tera and retains overflow after reduction", () => {
  const state = {
    marks: [],
    cards: [
      c("s", "you", "stadium", "Area Zero Underdepths", "stadium"),
      c("a", "you", "active", "Tera", "basic_ex", { tera: true }),
      c("b", "opponent", "active", "Normal", "basic"),
      ...Array.from({ length: 5 }, (_, i) =>
        c("bench" + i, "you", "bench", "B", "basic", { slot: i }),
      ),
      c("hand", "you", "hand", "New", "basic"),
    ],
  };
  assert.equal(benchCapacity(state, "you"), 8);
  assert.equal(benchCapacity(state, "opponent"), 5);
  const expanded = moveTableCard(state, "hand", "you", "bench", 7);
  assert.equal(expanded.cards.find((c) => c.id === "hand").slot, 7);
  const reduced = moveTableCard(expanded, "s", "you", "discard");
  assert.equal(benchCapacity(reduced, "you"), 5);
  assert.equal(reduced.cards.filter((c) => c.zone === "bench").length, 6);
  assert.equal(teraMetadata({ id: "sv06-025" }), true);
  assert.equal(teraMetadata({ id: "sv06-024" }), false);
  assert.equal(teraMetadata({ id: "unknown-001" }), undefined);
  assert.equal(printingTera({ set_code: "TWM", collector_number: "25" }), true);
  assert.equal(
    printingTera({ set_code: "TWM", collector_number: "24" }),
    false,
  );
});
test("deck preparation preserves known cards, consumes only remaining copies and rejects mismatched or incomplete lists", () => {
  const board = {
    marks: [],
    cards: [
      c("a", "you", "active", "Starter", "basic"),
      ...Array.from({ length: 59 }, (_, i) =>
        c("u" + i, "you", i < 6 ? "prizes" : "deck", null, undefined, {
          slot: i < 6 ? i : undefined,
        }),
      ),
      ...Array.from({ length: 60 }, (_, i) =>
        c("o" + i, "opponent", "deck", null),
      ),
    ],
  };
  const lists = {
    you: [
      { id: "a", name: "Starter", type: "basic", quantity: 1 },
      { id: "b", name: "Energy", type: "energy_basic", quantity: 59 },
    ],
    opponent: [{ id: "b", name: "Energy", type: "energy_basic", quantity: 60 }],
  };
  const snapshot = JSON.stringify(board),
    prepared = prepareTable(board, lists);
  assert.equal(prepared.errors.length, 0);
  assert.equal(prepared.state.cards.length, 120);
  assert(prepared.state.cards.every((c) => c.name));
  assert.equal(prepared.state.cards[0].id, "a");
  assert.equal(prepared.state.cards[0].zone, "active");
  assert.equal(JSON.stringify(board), snapshot);
  assert(
    prepareTable(board, { ...lists, you: lists.opponent }).errors.some((e) =>
      e.includes("Starter"),
    ),
  );
  assert(prepareTable(board, { you: lists.you }).errors.length);
  assert(prepareTable(board, { ...lists, you: [] }).errors.length);
});
