const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function load(file, fetch) {
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
      fetch,
      AbortSignal,
      Map,
      Array,
      Object,
      Number,
      require: (name) =>
        name === "@/types/domain" ? load("types/domain.ts") : require(name),
    },
  );
  return exports;
}
const parser = load("lib/domain/deck-import.ts");
test("resolves set codes and padded numbers, caches sets, preserves different arts and missing data", async () => {
  const calls = [];
  const api = load("lib/tcgdex.ts", async (url) => {
    calls.push(url);
    if (url.endsWith("sets/sv06"))
      return {
        ok: true,
        json: async () => ({
          id: "sv06",
          name: "Twilight Masquerade",
          serie: { name: "Scarlet & Violet" },
          cards: [
            { id: "sv06-025", localId: "025" },
            { id: "sv06-211", localId: "211" },
          ],
        }),
      };
    if (url.includes("cards/sv06-"))
      return {
        ok: true,
        json: async () => ({
          id: url.split("/").at(-1),
          localId: url.endsWith("025") ? "025" : "211",
          name: "Teal Mask Ogerpon ex",
          category: "Pokemon",
          stage: "Basic",
          suffix: "ex",
          regulationMark: "H",
          image: "https://assets.tcgdex.net/en/sv/sv06/025",
        }),
      };
    return { ok: false, status: 404 };
  });
  const result = await api.enrichDeck(
    parser.parseDeckList(
      "Pokémon: 4\n2 Teal Mask Ogerpon ex TWM 25\n2 Teal Mask Ogerpon ex TWM 211\nTrainer: 1\n1 Unknown XYZ 9",
    ),
  );
  assert.equal(result.cards[0].quantity, 4);
  assert.equal(result.cards[0].printings[0].regulation_mark, "H");
  assert.equal(result.cards[0].printings[0].collector_number, "025");
  assert.equal(result.cards[0].printings[1].tcgdex_id, "sv06-211");
  assert.equal(result.cards[0].printings[0].resolved_type, "basic_ex");
  assert.equal(result.cards[0].printings[0].set_name, "Twilight Masquerade");
  assert.match(result.cards[0].printings[0].image_url, /high\.webp$/);
  assert.equal(calls.filter((url) => url.endsWith("sets/sv06")).length, 1);
  assert.equal(result.cards[1].printings[0].set_code, "XYZ");
  assert.equal(result.warnings.length, 1);
});
test("printing counts resize with deck edits and reject unsafe URLs or inconsistent counts", () => {
  const printings = [
    { quantity: 2, set_code: "TWM", collector_number: "025" },
    { quantity: 2, set_code: "TWM", collector_number: "211" },
  ];
  assert.equal(parser.resizePrintings(printings, 3)[1].quantity, 1);
  assert.equal(parser.resizePrintings(printings, 1).length, 1);
  assert.equal(parser.validPrintings(printings, 4), true);
  assert.equal(parser.validPrintings(printings, 3), false);
  assert.equal(
    parser.validPrintings(
      [{ ...printings[0], image_url: "https://example.com/card.webp" }],
      2,
    ),
    false,
  );
  assert.equal(parser.validPrintings(null, 2), false);
  assert.equal(parser.validPrintings([], 2), true);
  assert.equal(
    parser.validPrintings(
      [
        {
          ...printings[0],
          manual_image_path:
            "10000000-0000-4000-8000-000000000001/cards/20000000-0000-4000-8000-000000000001.png",
        },
      ],
      2,
    ),
    true,
  );
  assert.equal(
    parser.validPrintings(
      [{ ...printings[0], manual_image_path: "../someone-else.png" }],
      2,
    ),
    false,
  );
});
test("maps Trainer, Energy and evolved ex types without guessing missing regulation marks", () => {
  const { cardType } = load("lib/tcgdex.ts");
  assert.equal(
    cardType({
      category: "Trainer",
      trainerType: "Item",
      rarity: "ACE SPEC Rare",
    }),
    "ace_spec",
  );
  assert.equal(
    cardType({
      category: "Pokemon",
      stage: "Stage2",
      suffix: "ex",
      name: "Charizard ex",
    }),
    "stage_2_ex",
  );
  assert.equal(
    cardType({ category: "Energy", energyType: "Normal" }),
    "energy_basic",
  );
  assert.equal(
    cardType({ category: "Energy", energyType: "Special" }),
    "energy_special",
  );
  assert.equal(
    cardType({ category: "Trainer", trainerType: "Pokemon Tool" }),
    "tool",
  );
  assert.equal(
    cardType({ category: "Trainer", trainerType: "Pokémon Tool" }),
    "tool",
  );
  assert.equal(
    cardType({
      category: "Pokemon",
      stage: "Stage 2",
      suffix: "EX",
      name: "Hydrapple ex",
    }),
    "stage_2_upper_ex",
  );
  assert.equal(cardType({ category: "Pokemon", name: "Unknown" }), undefined);
  assert.equal(
    cardType({ category: "Trainer", trainerType: "Unknown" }),
    undefined,
  );
});

test("every TCGdex stage and suffix maps to a selectable persisted type; EX and ex remain distinct", () => {
  const { cardType } = load("lib/tcgdex.ts");
  const { TCGDEX_STAGES, TCGDEX_SUFFIXES, TCGDEX_TRAINERS, CARD_TYPES } =
    load("types/domain.ts");
  for (const [stageKey, stage] of Object.entries(TCGDEX_STAGES)) {
    assert.equal(cardType({ category: "Pokemon", stage }), stageKey);
    for (const [suffixKey, suffix] of Object.entries(TCGDEX_SUFFIXES)) {
      const type = cardType({ category: "Pokemon", stage, suffix });
      assert.equal(type, `${stageKey}_${suffixKey}`);
      assert.ok(Object.hasOwn(CARD_TYPES, type));
    }
  }
  for (const [key, trainerType] of Object.entries(TCGDEX_TRAINERS))
    assert.equal(cardType({ category: "Trainer", trainerType }), key);
  assert.notEqual(
    cardType({ category: "Pokemon", stage: "Basic", suffix: "EX" }),
    cardType({ category: "Pokemon", stage: "Basic", suffix: "ex" }),
  );
});
test("deck export round-trips quantities, categories and alternate printings", () => {
  const cards = [
    {
      name: "Ogerpon ex",
      type: "basic_ex",
      quantity: 4,
      printings: [
        { quantity: 2, set_code: "TWM", collector_number: "025" },
        { quantity: 2, set_code: "TWM", collector_number: "211" },
      ],
    },
    {
      name: "Ultra Ball",
      type: "item",
      quantity: 2,
      printings: [{ quantity: 2, set_code: "MEG", collector_number: "131" }],
    },
    {
      name: "Basic {G} Energy",
      type: "energy_basic",
      quantity: 13,
      printings: [{ quantity: 13, set_code: "MEE", collector_number: "009" }],
    },
  ];
  const text = parser.exportDeckList(cards);
  assert.match(text, /Pok.mon: 2\n2 Ogerpon ex TWM 25\n2 Ogerpon ex TWM 211/);
  assert.match(text, /Trainer: 1\n2 Ultra Ball MEG 131/);
  assert.match(
    text,
    /Energy: 1\n13 Basic \{G\} Energy MEE 9\n\nTotal Cards: 19/,
  );
  const imported = parser.parseDeckList(text);
  assert.equal(imported.length, 3);
  assert.equal(imported[0].quantity, 4);
  assert.equal(imported[0].printings.length, 2);
  assert.equal(imported[2].category, "energy");
  assert.throws(
    () =>
      parser.exportDeckList([
        { name: "Unknown card", type: "basic", quantity: 1 },
      ]),
    /Missing expansion/,
  );
});
