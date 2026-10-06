const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const UID = "10000000-0000-4000-8000-000000000001",
  OTHER = "10000000-0000-4000-8000-000000000002";
test("shared images and variant RPC: public reads, authenticated paths and atomic variant ownership", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;grant usage on schema auth,storage,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${UID}'),('${OTHER}');`,
  );
  // Test applying the migration to an existing installation, not only bootstrap.
  const schema = fs
    .readFileSync("supabase/schema.sql", "utf8")
    .split("create table if not exists public.card_image_overrides")[0]
    .replace(/begin;\s*$/, "");
  await db.exec(schema);
  await db.exec(
    fs.readFileSync("supabase/migrations/20261006_shared_card_art.sql", "utf8"),
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [UID]);
  await db.exec("set role authenticated");
  await db.query(
    "insert into public.card_image_overrides(tcgdex_id,path,uploaded_by) values($1,$2,$3)",
    ["sv06-025", `${UID}/sv06-025/art.png`, UID],
  );
  await assert.rejects(
    db.query(
      "insert into public.card_image_overrides(tcgdex_id,path,uploaded_by) values($1,$2,$3)",
      ["sv06-026", `${OTHER}/sv06-026/art.png`, UID],
    ),
    /row-level security/,
  );
  await assert.rejects(
    db.query(
      "insert into public.card_image_overrides(tcgdex_id,path,uploaded_by) values($1,$2,$3)",
      ["invalid/slash", `${UID}/invalid/slash/art.png`, UID],
    ),
  );
  await db.exec("reset role;set role anon");
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  assert.equal(
    (await db.query("select * from public.card_image_overrides")).rows.length,
    1,
  );
  await assert.rejects(
    db.exec(`update public.card_image_overrides set path='other'`),
    /permission denied/,
  );
  await db.exec("reset role;set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    OTHER,
  ]);
  await db.query(
    "update public.card_image_overrides set path=$1,uploaded_by=$2 where tcgdex_id=$3",
    [`${OTHER}/sv06-025/replacement.webp`, OTHER, "sv06-025"],
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [UID]);
  const card = (
    await db.query(
      "insert into public.cards(name,type) values('Basic Energy','energy_basic') returning id",
    )
  ).rows[0].id;
  const payload = {
    name: "Base",
    cards: [{ card_id: card, quantity: 60 }],
    variants: [],
  };
  const base = (
    await db.query("select public.save_deck($1::jsonb) id", [
      JSON.stringify(payload),
    ])
  ).rows[0].id;
  const variant = (
    await db.query("select public.save_deck_variant($1::jsonb,$2::uuid) id", [
      JSON.stringify({ ...payload, name: "Variant" }),
      base,
    ])
  ).rows[0].id;
  assert.equal(
    (
      await db.query(
        "select * from public.deck_variants where deck_id=$1 and variant_id=$2",
        [base, variant],
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (await db.query("select name from public.decks where id=$1", [base]))
      .rows[0].name,
    "Base",
  );
  const before = (await db.query("select count(*)::int n from public.decks"))
    .rows[0].n;
  await assert.rejects(
    db.query("select public.save_deck_variant($1::jsonb,$2::uuid)", [
      JSON.stringify({
        ...payload,
        name: "Bad variant",
        cards: [{ card_id: card, quantity: 61 }],
      }),
      base,
    ]),
  );
  assert.equal(
    (await db.query("select count(*)::int n from public.decks")).rows[0].n,
    before,
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    OTHER,
  ]);
  await assert.rejects(
    db.query("select public.save_deck_variant($1::jsonb,$2::uuid)", [
      JSON.stringify({ ...payload, name: "Foreign variant" }),
      base,
    ]),
    /one of your decks/,
  );
});
