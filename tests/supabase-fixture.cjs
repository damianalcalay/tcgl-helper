// Test-only Supabase protocol fixture backed by the real application SQL in PGlite.
// Never used by the application or connected to a real Supabase project.
const { createServer } = require("node:http");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
if (process.env.TCGL_TEST_FIXTURE !== "1")
  throw new Error("This server is only for the isolated end-to-end suite.");
const UID = "10000000-0000-4000-8000-000000000001";
const user = {
  id: UID,
  aud: "authenticated",
  role: "authenticated",
  email: "fixture@example.test",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  confirmed_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
};
function token() {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: UID, aud: "authenticated", role: "authenticated", email: user.email, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}.Zml4dHVyZS1zaWduYXR1cmU`;
}
const db = new PGlite();
const images = new Map();
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
  "base64",
);
async function setup() {
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
 grant usage on schema auth,storage,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
 insert into auth.users values('${UID}');`);
  await db.exec(fs.readFileSync("supabase/schema.sql", "utf8"));
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [UID]);
  await db.exec("set role authenticated");
}
async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  if ((req.headers["content-type"] ?? "").includes("application/json"))
    return JSON.parse(bytes.toString() || "{}");
  return bytes;
}
function respond(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    ...headers,
  });
  res.end(JSON.stringify(data));
}
const tables = [
  "cards",
  "decks",
  "deck_cards",
  "deck_variants",
  "matches",
  "match_rosters",
  "match_prizes",
];
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost:54329");
    const route = url.pathname;
    if (req.method === "OPTIONS") return respond(res, 204, {});
    if (route === "/health") return respond(res, 200, { ready: true });
    if (route === "/auth/v1/token")
      return respond(res, 200, {
        access_token: token(),
        refresh_token: "fixture-refresh",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user,
      });
    if (route === "/auth/v1/user") {
      if ((req.headers.authorization ?? "").includes("Zml4dHVyZS1zaWduYXR1cmU"))
        return respond(res, 200, user);
      return respond(res, 401, { message: "No test session", code: "bad_jwt" });
    }
    if (route === "/auth/v1/logout") return respond(res, 200, {});
    if (route.startsWith("/rest/v1/rpc/")) {
      const name = route.split("/").at(-1);
      const payload = await body(req);
      let result;
      if (name === "save_deck" || name === "save_match")
        result = await db.query(`select public.${name}($1::jsonb) as value`, [
          JSON.stringify(payload.payload),
        ]);
      else if (name === "delete_entity")
        result = await db.query("select public.delete_entity($1,$2) as value", [
          payload.entity,
          payload.entity_id,
        ]);
      else return respond(res, 404, { message: "Unknown RPC" });
      return respond(res, 200, result.rows[0].value);
    }
    if (route.startsWith("/rest/v1/")) {
      const table = route.split("/").at(-1);
      if (!tables.includes(table))
        return respond(res, 404, { message: "Unknown table" });
      const params = [];
      let sql;
      if (req.method === "POST" && table === "cards") {
        const payload = await body(req);
        sql = "insert into public.cards(name,type) values($1,$2) returning *";
        params.push(payload.name, payload.type);
      } else if (req.method === "PATCH" && table === "cards") {
        const payload = await body(req);
        sql = "update public.cards set name=$1,type=$2 where id=$3 returning *";
        params.push(
          payload.name,
          payload.type,
          (url.searchParams.get("id") ?? "").replace("eq.", ""),
        );
      } else {
        const rawOrder = url.searchParams.get("order") ?? "id.asc";
        const order = rawOrder
          .split(",")
          .map((value) => {
            const [field, direction] = value.split(".");
            if (
              !/^[a-z_]+$/.test(field) ||
              !["asc", "desc"].includes(direction)
            )
              throw Error("Invalid order");
            return `${field} ${direction}`;
          })
          .join(",");
        const limit = Number(url.searchParams.get("limit") ?? 1000);
        const offset = Number(url.searchParams.get("offset") ?? 0);
        if (!Number.isInteger(limit) || !Number.isInteger(offset))
          throw Error("Invalid range");
        sql = `select * from public.${table} order by ${order} limit $1 offset $2`;
        params.push(limit, offset);
      }
      const result = await db.query(sql, params);
      const single = (req.headers.accept ?? "").includes("vnd.pgrst.object");
      if (single && result.rows.length !== 1)
        return respond(res, 406, {
          message: "Record not found",
          code: "PGRST116",
        });
      return respond(res, 200, single ? result.rows[0] : result.rows, {
        "Content-Range": `0-${Math.max(0, result.rows.length - 1)}/*`,
      });
    }
    if (route.startsWith("/storage/v1/object/sign/deck-images/")) {
      const path = decodeURIComponent(route.split("/deck-images/")[1]);
      if (req.method === "POST")
        return respond(res, 200, {
          signedURL: `/object/sign/deck-images/${path}?token=fixture`,
        });
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Access-Control-Allow-Origin": "*",
      });
      return res.end(pixel);
    }
    if (route.startsWith("/storage/v1/object/deck-images/")) {
      const path = decodeURIComponent(route.split("/deck-images/")[1]);
      images.set(path, await body(req));
      return respond(res, 200, {
        Key: `deck-images/${path}`,
        Id: "fixture-image",
      });
    }
    if (route === "/storage/v1/object/deck-images" && req.method === "DELETE") {
      const payload = await body(req);
      payload.prefixes.forEach((p) => images.delete(p));
      return respond(
        res,
        200,
        payload.prefixes.map((name) => ({ name })),
      );
    }
    respond(res, 404, { message: `Unknown fixture route ${route}` });
  } catch (error) {
    respond(res, 400, { code: error.code ?? "P0001", message: error.message });
  }
});
setup()
  .then(() =>
    server.listen(54329, "127.0.0.1", () =>
      console.log("Isolated Supabase fixture ready on 54329"),
    ),
  )
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close();
    db.close().finally(() => process.exit(0));
  });
