const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript");
const UID = "10000000-0000-4000-8000-000000000001";
function load(file, requireMock) {
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
      require: requireMock,
      Request,
      Response,
      File,
      FormData,
      URL,
      Uint8Array,
      AbortSignal,
      crypto: require("node:crypto").webcrypto,
      process,
    },
  );
  return exports;
}
test("shared image resolver applies only exact printing overrides with manual priority", async () => {
  const calls = [];
  const client = {
    from: () => ({
      select: () => ({
        in: async (_, ids) => {
          calls.push(ids);
          return { data: [{ tcgdex_id: "sv06-025", path: "shared/art.png" }] };
        },
      }),
    }),
    storage: {
      from: () => ({
        getPublicUrl: (path) => ({
          data: { publicUrl: "https://storage.example/" + path },
        }),
      }),
    },
  };
  const images = load("lib/card-images.ts", (n) =>
    n === "server-only"
      ? {}
      : n === "@/lib/supabase/server"
        ? { createClient: async () => client }
        : require(n),
  );
  const printings = [
    {
      tcgdex_id: "sv06-025",
      image_url: "https://assets.tcgdex.net/en/source/high.webp",
    },
    {
      tcgdex_id: "sv06-026",
      image_url: "https://assets.tcgdex.net/en/other/high.webp",
    },
  ];
  await images.applyManualImages(printings);
  assert.equal(
    printings[0].image_url,
    "https://storage.example/shared/art.png",
  );
  assert.equal(
    printings[1].image_url,
    "https://assets.tcgdex.net/en/other/high.webp",
  );
  assert.equal(calls[0].length, 2);
});
test("upload route validates contents and auth, generates safe paths and removes failed registrations", async () => {
  let signed = true,
    fail = false;
  const uploads = [],
    removed = [],
    rows = [];
  const client = {
    auth: {
      getUser: async () => ({ data: { user: signed ? { id: UID } : null } }),
    },
    from: () => ({
      upsert: async (row) => {
        rows.push(row);
        return { error: fail ? { message: "database unavailable" } : null };
      },
    }),
    storage: {
      from: () => ({
        upload: async (path, bytes) => {
          uploads.push({ path, bytes });
          return {};
        },
        remove: async (paths) => {
          removed.push(...paths);
          return {};
        },
        getPublicUrl: (path) => ({
          data: { publicUrl: "https://storage.example/" + path },
        }),
      }),
    },
  };
  const route = load("app/api/card-art/route.ts", (n) =>
    n === "@/lib/supabase/server"
      ? { createClient: async () => client }
      : n === "@/lib/tcgdex"
        ? { tcgdexGet: async () => ({ id: "sv06-025" }) }
        : require(n),
  );
  const request = (bytes, type = "image/png", id = "sv06-025") => {
    const form = new FormData();
    form.set("id", id);
    form.set("file", new File([bytes], "../../unsafe-file.png", { type }));
    return new Request("https://example.test/api/card-art", {
      method: "POST",
      body: form,
    });
  };
  signed = false;
  assert.equal((await route.POST(request(Buffer.from("bad")))).status, 401);
  signed = true;
  assert.equal((await route.POST(request(Buffer.from("bad")))).status, 400);
  assert.equal(uploads.length, 0);
  assert.equal(
    (await route.POST(request(Buffer.from("bad"), "image/svg+xml"))).status,
    400,
  );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
    "base64",
  );
  const response = await route.POST(request(png));
  assert.equal(response.status, 200);
  assert.match(
    uploads[0].path,
    new RegExp("^" + UID + "/sv06-025/[a-f0-9-]+\\.png$"),
  );
  assert.equal(rows[0].tcgdex_id, "sv06-025");
  fail = true;
  assert.equal((await route.POST(request(png))).status, 502);
  assert.equal(removed.length, 1);
});
