const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript");
function route() {
  const exports = {};
  const calls = [];
  const cards = [
    { id: "sv01-1", name: "Old", localId: "1" },
    { id: "sv05-1", name: "Dreepy", localId: "1" },
    { id: "sv05-2", name: "Drakloak", localId: "2" },
    { id: "sv06-1", name: "Future", localId: "1" },
    { id: "mee-10", name: "Fire Energy", localId: "10" },
  ];
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync("app/api/card-catalog/route.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      Request,
      Response,
      URL,
      require: (name) => {
        if (name === "@/lib/supabase/server")
          return {
            createClient: async () => ({
              auth: {
                getUser: async () => ({ data: { user: { id: "user" } } }),
              },
            }),
          };
        if (name === "@/lib/tcgdex")
          return {
            tcgdexGet: async (path) => {
              calls.push(path);
              if (path === "cards") return cards;
              if (path === "sets")
                return [{ id: "sv01" }, { id: "sv05" }, { id: "sv06" }];
              if (path === "sets/sv05")
                return { id: "sv05", releaseDate: "2024-03-22" };
              if (path === "sets/sv06")
                return { id: "sv06", releaseDate: "2099-01-01" };
              throw Error(path);
            },
          };
        if (name === "@/lib/card-images") return {};
        if (name === "@/lib/domain/current-expansions")
          return {
            currentExpansionId: (id) => ["sv05", "sv06"].includes(id),
            releasedExpansion: (date) =>
              Date.parse(date) < Date.now() - 14 * 86400000,
          };
        return require(name);
      },
    },
  );
  return { GET: exports.GET, calls };
}
test("on-demand regex search includes released expansions and energy, rejects invalid patterns and excludes old/future sets", async () => {
  const { GET, calls } = route();
  let r = await GET(
    new Request("https://example.test/api/card-catalog?q=%5EDr"),
  );
  assert.equal(r.status, 200);
  assert.deepEqual(
    (await r.json()).cards.map((c) => c.name),
    ["Dreepy", "Drakloak"],
  );
  r = await GET(new Request("https://example.test/api/card-catalog?q=Energy"));
  assert.deepEqual(
    (await r.json()).cards.map((c) => c.id),
    ["mee-10"],
  );
  r = await GET(
    new Request("https://example.test/api/card-catalog?q=Old%7CFuture"),
  );
  assert.deepEqual((await r.json()).cards, []);
  assert.equal(
    (await GET(new Request("https://example.test/api/card-catalog?q=%5B")))
      .status,
    400,
  );
  const count = calls.length;
  assert.deepEqual(
    await (
      await GET(new Request("https://example.test/api/card-catalog?q="))
    ).json(),
    { cards: [] },
  );
  assert.equal(calls.length, count);
  assert(!calls.some((c) => c.includes("legal.standard")));
});
