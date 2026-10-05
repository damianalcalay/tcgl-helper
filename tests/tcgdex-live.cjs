// Optional live smoke test. Not included in the offline npm test suite.
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
    { exports, fetch, AbortSignal, Map, Array, Object, Number },
  );
  return exports;
}
(async () => {
  const { parseDeckList } = load("lib/domain/deck-import.ts");
  const { enrichDeck } = load("lib/tcgdex.ts");
  const result = await enrichDeck(
    parseDeckList(
      "Pokémon: 4\n2 Teal Mask Ogerpon ex TWM 25\n2 Teal Mask Ogerpon ex TWM 211\nTrainer: 4\n4 Ultra Ball MEG 131\nEnergy: 13\n13 Basic Grass Energy MEE 9",
    ),
  );
  assert.equal(
    result.warnings.some((w) => w.startsWith("Could not resolve")),
    false,
    result.warnings.join("\n"),
  );
  for (const card of result.cards) {
    for (const p of card.printings) {
      assert.ok(p.tcgdex_id);
      if (!p.image_url) {
        assert.equal(
          p.set_code,
          "MEE",
          `Unexpected missing image: ${p.tcgdex_id}`,
        );
        console.log(
          JSON.stringify({
            name: card.name,
            expansion: p.set_name,
            number: p.collector_number,
            id: p.tcgdex_id,
            imageStatus: "Provider has no image; identifiers preserved",
          }),
        );
        continue;
      }
      const response = await fetch(p.image_url, {
        method: "HEAD",
        signal: AbortSignal.timeout(12000),
      });
      assert.equal(response.ok, true, `Image unavailable: ${p.tcgdex_id}`);
      console.log(
        JSON.stringify({
          name: card.name,
          quantity: p.quantity,
          expansion: p.set_name,
          code: p.set_code,
          number: p.collector_number,
          regulation: p.regulation_mark ?? null,
          id: p.tcgdex_id,
          type: p.resolved_type,
          imageStatus: response.status,
        }),
      );
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
