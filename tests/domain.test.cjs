const test = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const vm = require("node:vm");
function load(file, dependencies = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const testModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: testModule,
    exports: testModule.exports,
    require: (name) =>
      name === "@/lib/domain/combat-log"
        ? load("lib/domain/combat-log.ts")
        : name === "@/types/domain"
          ? load("types/domain.ts")
          : (dependencies[name] ??
            (name === "@/lib/domain/deck-import"
              ? load("lib/domain/deck-import.ts")
              : require(name))),
    Map,
    Set,
    Date,
    RegExp,
    Number,
    Object,
    Array,
  });
  return testModule.exports;
}
const domain = load("types/domain.ts");
const { validateQuantities, winRate, summarize, matchRoster, deckRoster } =
  load("lib/domain/logic.ts");
function game(index, result, opponent = "opponent-a") {
  return {
    id: String(index).padStart(3, "0"),
    deck_id: "mine",
    opponent_deck_id: opponent,
    opponent_deck_name: opponent,
    result,
    played_at: new Date(2026, 0, index + 1).toISOString(),
    created_at: new Date(2026, 0, index + 1).toISOString(),
  };
}
test("60-card limit, integer quantities, four copies and duplicate cards", () => {
  const full = Array.from({ length: 15 }, (_, i) => ({
    card_id: String(i),
    quantity: 4,
  }));
  assert.equal(validateQuantities(full), null);
  assert.match(
    validateQuantities([...full, { card_id: "extra", quantity: 1 }]),
    /60/,
  );
  for (const quantity of [0, 5, 1.5, NaN])
    assert.match(validateQuantities([{ card_id: "a", quantity }]), /1-4/);
  assert.match(
    validateQuantities([
      { card_id: "a", quantity: 1 },
      { card_id: "a", quantity: 2 },
    ]),
    /once/,
  );
});
test("draws count in denominator, and empty win rate is zero", () => {
  assert.equal(winRate([]), 0);
  assert.equal(
    winRate([game(0, "win"), game(1, "draw"), game(2, "loss"), game(3, "win")]),
    50,
  );
});
test("last 20 excludes older results and history is newest first", () => {
  const games = Array.from({ length: 25 }, (_, i) =>
    game(i, i < 5 ? "loss" : "win"),
  );
  const stats = summarize(games.reverse());
  assert.equal(stats.rate, 80);
  assert.equal(stats.recent, 100);
  assert.equal(stats.sorted[0].id, "024");
  assert.equal(stats.sorted.at(-1).id, "000");
  const few = summarize([game(1, "loss"), game(0, "win")]);
  assert.equal(few.recent, 50);
});
test("matchups rank extremes and preserve one-game samples", () => {
  const stats = summarize([
    game(1, "win", "A"),
    game(2, "loss", "B"),
    game(3, "draw", "C"),
    game(4, "win", "D"),
    game(5, "win", "D"),
  ]);
  assert.equal(stats.best[0].name, "D");
  assert.equal(stats.best[0].count, 2);
  assert.equal(stats.best[1].name, "A");
  assert.equal(stats.worst[0].rate, 0);
  assert.equal(stats.best.length, 3);
  assert.equal(stats.worst.length, 3);
});
test("editing a match uses the old roster for unchanged decks", () => {
  const data = {
    cards: [{ id: "c", name: "New name", type: "stage_1" }],
    deckCards: [{ deck_id: "mine", card_id: "c", quantity: 1 }],
    rosters: [
      {
        match_id: "m",
        side: "mine",
        card_id: "c",
        card_name: "Old name",
        card_type: "basic",
        quantity: 2,
      },
    ],
  };
  const match = { id: "m", deck_id: "mine", opponent_deck_id: "other" };
  assert.equal(matchRoster(data, match, "mine", "mine")[0].name, "Old name");
  assert.equal(matchRoster(data, match, "mine", "mine")[0].quantity, 2);
  assert.equal(deckRoster(data, "mine")[0].name, "New name");
});
test("valid regex and invalid regex return predictable feedback", () => {
  const rows = ["Basic ex", "Stage 1", "Item"];
  function regexFilter(items, query, label) {
    let result;
    const self = {
      postMessage: (value) => {
        result = value;
      },
    };
    vm.runInNewContext(fs.readFileSync("public/regex-worker.js", "utf8"), {
      self,
    });
    self.onmessage({
      data: {
        options: items.map((x) => ({ value: x, label: label(x) })),
        query,
      },
    });
    return { items: result.ids, error: result.error };
  }
  assert.equal(regexFilter(rows, "basic|item", (x) => x).items.length, 2);
  assert.match(regexFilter(rows, "[", (x) => x).error, /Invalid/);
  assert.ok(Object.hasOwn(domain.CARD_TYPES, "basic_v"));
  assert.ok(Object.hasOwn(domain.CARD_TYPES, "vstar"));
  assert.ok(Object.hasOwn(domain.CARD_TYPES, "energy_special"));
});

test("history sorts actual instants correctly across UTC offsets", () => {
  const early = { ...game(0, "win"), played_at: "2026-01-01T14:00:00Z" };
  const late = { ...game(1, "loss"), played_at: "2026-01-01T10:00:00-05:00" };
  assert.equal(summarize([early, late]).sorted[0].id, late.id);
});

test("server actions reject malformed payloads and unsupported card types before contacting Supabase", async () => {
  let contacted = false;
  const actions = load("app/actions.ts", {
    "@/types/domain": domain,
    "@/lib/domain/logic": { validateQuantities },
    "@/lib/supabase/server": {
      createClient: async () => {
        contacted = true;
        throw Error("Must not contact Supabase");
      },
    },
    "next/cache": { revalidatePath: () => {} },
  });
  assert.equal(
    (await actions.saveCard({ name: "Card", type: "toString" })).success,
    false,
  );
  assert.equal(
    (
      await actions.saveDeck({
        name: "Deck",
        playstyle: "",
        notes: "",
        image_path: null,
        cards: [null],
        variants: [],
      })
    ).success,
    false,
  );
  assert.equal((await actions.saveMatch({})).success, false);
  assert.equal(contacted, false);
});

test("RESTRICT deletion and missing-record errors become friendly messages", async () => {
  const uuid = "10000000-0000-4000-8000-000000000001";
  const actions = load("app/actions.ts", {
    "@/types/domain": domain,
    "@/lib/domain/logic": { validateQuantities },
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: uuid } } }) },
        rpc: async () => ({
          error: { code: "23001", message: "Internal constraint details" },
        }),
      }),
    },
    "next/cache": { revalidatePath: () => {} },
  });
  const result = await actions.deleteEntity("card", uuid);
  assert.equal(result.success, false);
  assert.match(result.error, /used by a deck or match/);
  assert.doesNotMatch(result.error, /constraint/);
  const deckResult = await actions.deleteEntity("deck", uuid);
  assert.equal(deckResult.success, false);
  assert.match(deckResult.error, /20261005_deck_history_cascade.sql/);
  assert.match(deckResult.error, /have not been deleted/);
});

test("imported images cannot silently disappear when Supabase is missing the migration", async () => {
  const uuid = "10000000-0000-4000-8000-000000000001";
  let saved = false;
  const query = {
    select: () => query,
    order: () => query,
    limit: async () => ({ error: { code: "42703" } }),
  };
  const actions = load("app/actions.ts", {
    "@/types/domain": domain,
    "@/lib/domain/logic": { validateQuantities },
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: uuid } } }) },
        from: () => query,
        rpc: async () => {
          saved = true;
          return { data: uuid };
        },
      }),
    },
    "next/cache": { revalidatePath: () => {} },
  });
  const result = await actions.saveDeck({
    name: "Deck",
    playstyle: "",
    notes: "",
    image_path: null,
    variants: [],
    cards: [
      {
        card_id: uuid,
        quantity: 1,
        printings: [{ quantity: 1, set_code: "TWM", collector_number: "025" }],
      },
    ],
  });
  assert.equal(result.success, false);
  assert.match(result.error, /20261005_tcgdex_printings.sql/);
  assert.equal(saved, false);
});

const { parseDeckList } = load("lib/domain/deck-import.ts");
test("deck import parses accents, apostrophes, duplicate printings and Energy quantities", () => {
  const rows = parseDeckList(
    "Pokémon: 4\r\n2 Ogerpon ex TWM 25\r\n2 Ogerpon ex TWM 99\r\n\r\nTrainer: 4\r\n4 Lillie's Determination MEG 119\r\nEnergy: 13\r\n13 Grass Energy MEE 9",
  );
  assert.equal(rows.length, 3);
  assert.equal(rows[0].quantity, 4);
  assert.equal(rows[0].printings.length, 2);
  assert.equal(rows[0].printings[0].set_code, "TWM");
  assert.equal(rows[0].printings[1].collector_number, "99");
  assert.equal(rows[1].name, "Lillie's Determination");
  assert.equal(rows[2].category, "energy");
  assert.equal(rows[2].quantity, 13);
  assert.equal(
    validateQuantities([{ card_id: "energy", quantity: 13 }], ["energy"]),
    null,
  );
  assert.match(
    validateQuantities([{ card_id: "trainer", quantity: 13 }], ["energy"]),
    /1-4/,
  );
});
test("deck import rejects invalid lines, missing categories, non-Energy excess and decks over 60", () => {
  for (const list of [
    "",
    "4 Card TWM 1",
    "Pokémon: 1\nwrong",
    "Trainer: 5\n5 Item TWM 1",
    "Energy: 61\n61 Grass Energy MEE 9",
    "Pokémon: 1\n0 Card TWM 1",
  ])
    assert.throws(() => parseDeckList(list));
});
