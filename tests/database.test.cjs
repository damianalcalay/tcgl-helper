const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const USER = "10000000-0000-4000-8000-000000000001";
const OTHER = "10000000-0000-4000-8000-000000000002";
test("schema executes in PostgreSQL; RPCs enforce domain constraints, history and RLS", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
 grant usage on schema auth,storage,public to authenticated,anon;
 grant execute on function auth.uid() to authenticated,anon;
 insert into auth.users values('${USER}'),('${OTHER}');`);
  await db.exec(fs.readFileSync("supabase/schema.sql", "utf8"));
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [USER]);
  await db.exec("set role authenticated");
  const card = async (name, type = "basic") =>
    (
      await db.query(
        "insert into public.cards(name,type) values($1,$2) returning id",
        [name, type],
      )
    ).rows[0].id;
  const basic = await card("Starter");
  const item = await card("Item", "item");
  const stage = await card("Evolution", "stage_1");
  const many = [];
  for (let i = 0; i < 15; i++)
    many.push({ card_id: await card(`Card ${i}`), quantity: 4 });
  const rpc = async (fn, payload) =>
    (
      await db.query(`select public.${fn}($1::jsonb) as id`, [
        JSON.stringify(payload),
      ])
    ).rows[0].id;
  const deckPayload = (name, cards, extra = {}) => ({
    name,
    playstyle: "",
    notes: "",
    image_path: null,
    cards,
    variants: [],
    ...extra,
  });
  const mine = await rpc(
    "save_deck",
    deckPayload("Mine", [
      { card_id: basic, quantity: 2 },
      { card_id: item, quantity: 4 },
      { card_id: stage, quantity: 1 },
    ]),
  );
  const opponent = await rpc(
    "save_deck",
    deckPayload("Opponent", [{ card_id: basic, quantity: 1 }]),
  );
  await t.test("deck limits and failed transaction rollback", async () => {
    await rpc("save_deck", deckPayload("Full", many));
    await assert.rejects(
      rpc(
        "save_deck",
        deckPayload("Too many", [...many, { card_id: basic, quantity: 1 }]),
      ),
      /60/,
    );
    await assert.rejects(
      rpc(
        "save_deck",
        deckPayload("Five copies", [{ card_id: basic, quantity: 5 }]),
      ),
      /check constraint/,
    );
    await assert.rejects(
      rpc(
        "save_deck",
        deckPayload("Duplicate", [
          { card_id: basic, quantity: 1 },
          { card_id: basic, quantity: 1 },
        ]),
      ),
      /duplicate/,
    );
    await assert.rejects(rpc("save_deck", deckPayload("", [])), /name/);
    await assert.rejects(
      rpc("save_deck", deckPayload("Mine", [], { id: mine, variants: [mine] })),
      /check constraint/,
    );
    await assert.rejects(
      rpc(
        "save_deck",
        deckPayload("Mine", [], { id: mine, variants: [opponent, opponent] }),
      ),
      /duplicate/,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from public.deck_cards where deck_id=$1",
          [mine],
        )
      ).rows[0].n,
      3,
    );
    await assert.rejects(
      db.query(
        "insert into public.deck_cards(deck_id,card_id,user_id,quantity) values($1,$2,$3,1)",
        [mine, basic, USER],
      ),
      /permission denied/,
    );
  });
  const input = {
    deck_id: mine,
    opponent_deck_id: opponent,
    result: "win",
    my_prizes: 6,
    opponent_prizes: 3,
    starter_id: basic,
    opponent_starter_id: basic,
    played_at: "2026-10-04T10:00:00Z",
    notes: "Test",
    prizes: [basic, basic, item, item, item, item],
  };
  let mid;
  await t.test("starters, prize membership and per-copy limits", async () => {
    await assert.rejects(
      rpc("save_match", { ...input, starter_id: stage }),
      /Basic starter/,
    );
    await assert.rejects(
      rpc("save_match", { ...input, starter_id: item }),
      /Basic starter/,
    );
    await assert.rejects(
      rpc("save_match", { ...input, opponent_starter_id: stage }),
      /Basic starter/,
    );
    await assert.rejects(
      rpc("save_match", { ...input, prizes: [basic, basic, basic] }),
      /Prize copies/,
    );
    await assert.rejects(
      rpc("save_match", { ...input, prizes: [many[0].card_id] }),
      /Prize copies/,
    );
    await assert.rejects(
      rpc("save_match", {
        ...input,
        prizes: [basic, basic, item, item, item, item, item],
      }),
      /six/,
    );
    await assert.rejects(
      rpc("save_match", { ...input, my_prizes: 7 }),
      /check constraint/,
    );
    mid = await rpc("save_match", input);
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.match_prizes where match_id=$1",
          [mid],
        )
      ).rows[0].n,
      6,
    );
  });
  await t.test(
    "history survives editing deck/card; deletions respect relationships",
    async () => {
      await db.query(
        "update public.cards set name='Renamed',type='stage_2' where id=$1",
        [basic],
      );
      await rpc(
        "save_deck",
        deckPayload("Mine changed", [{ card_id: item, quantity: 1 }], {
          id: mine,
        }),
      );
      await rpc("save_match", { ...input, id: mid, result: "loss" });
      const snapshot = (
        await db.query(
          "select card_name,card_type,quantity from public.match_rosters where match_id=$1 and side='mine' and card_id=$2",
          [mid, basic],
        )
      ).rows[0];
      assert.equal(snapshot.card_name, "Starter");
      assert.equal(snapshot.card_type, "basic");
      assert.equal(snapshot.quantity, 2);
      await assert.rejects(
        db.query("select public.delete_entity('deck',$1)", [mine]),
        /foreign key/,
      );
      await assert.rejects(
        db.query("select public.delete_entity('card',$1)", [basic]),
        /foreign key/,
      );
    },
  );
  await t.test(
    "another user cannot read or mutate the first user data",
    async () => {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        OTHER,
      ]);
      assert.equal(
        (await db.query("select count(*)::int n from public.decks")).rows[0].n,
        0,
      );
      assert.equal(
        (await db.query("select count(*)::int n from public.cards")).rows[0].n,
        0,
      );
      await assert.rejects(
        rpc("save_deck", deckPayload("Stolen", [], { id: mine })),
        /not found/,
      );
      await assert.rejects(
        rpc(
          "save_deck",
          deckPayload("Foreign cards", [{ card_id: item, quantity: 1 }]),
        ),
        /Card not found/,
      );
      await assert.rejects(
        rpc("save_match", { ...input, id: mid }),
        /not found/,
      );
      await assert.rejects(
        db.query("select public.delete_entity('match',$1)", [mid]),
        /not found/,
      );
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        USER,
      ]);
    },
  );
  await t.test("match delete cascades roster and prizes", async () => {
    await db.query("select public.delete_entity('match',$1)", [mid]);
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.match_rosters where match_id=$1",
          [mid],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.match_prizes where match_id=$1",
          [mid],
        )
      ).rows[0].n,
      0,
    );
    await db.query("select public.delete_entity('deck',$1)", [mine]);
  });
});
